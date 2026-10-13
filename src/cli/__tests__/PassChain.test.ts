import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";
import Discover from "../../cnx/PARSE/1-Discover/Discover";
import Parse from "../../cnx/PARSE/2-Parse/Parse";
import Declare from "../../cnx/PARSE/3-Declare/Declare";
import Resolve from "../../cnx/PARSE/4-Resolve/Resolve";
import Analyze from "../../cnx/TRANSPILE/1-Analyze/Analyze";
import CodeGenWalker from "../../cnx/TRANSPILE/CodeGenWalker";
import HeaderRenderer from "../../cnx/TRANSPILE/3-Render/headers/HeaderRenderer";
import Write from "../../cnx/WRITE/1-Write/Write";

/**
 * #1991, owner ruling: "each step should ONLY use the output of the previous
 * step". Every pass entry is watched through one real run, and each artifact
 * argument it receives must be the previous entry's return value or reachable
 * from it. A host that hands a pass anything it rebuilt or kept for itself --
 * a copy, a field, a skipped pass's result -- fails here.
 *
 * Arguments that are not artifacts are named per entry: the filesystem port,
 * 1.1's run inputs, and the walker's per-file options. The symbol table and
 * registry are 1.3's artifact data (#1991 part B): 1.3 builds them from the
 * headers 1.2 parsed, and 1.4 reads them off 1.3's result.
 *
 * Mutation-checked: handing each of 1.2 through 2.3 a copy of its artifact,
 * or 3.1 text 2.3 did not render, fails one test here per boundary.
 */
interface ICall {
  readonly pass: string;
  readonly args: readonly unknown[];
  readonly returned: unknown;
}

/** Every object `root` reaches through fields, arrays, maps and sets. */
function reachable(root: unknown): Set<unknown> {
  const seen = new Set<unknown>();
  const pending = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || typeof value !== "object" || seen.has(value)) {
      continue;
    }
    seen.add(value);
    if (value instanceof Map) {
      pending.push(...value.keys(), ...value.values());
    } else if (value instanceof Set || Array.isArray(value)) {
      pending.push(...value);
    } else {
      pending.push(...Object.values(value));
    }
  }
  return seen;
}

describe("#1991: each pass takes only what the pass before it returned", () => {
  let tempDir: string;
  let calls: ICall[];

  function watch<T extends object>(
    owner: T,
    name: keyof T & string,
    pass: string,
  ): void {
    const original = owner[name] as (...args: unknown[]) => unknown;
    vi.spyOn(owner, name as never).mockImplementation(function (
      this: unknown,
      ...args: unknown[]
    ) {
      const returned = original.apply(this, args);
      if (returned instanceof Promise) {
        return returned.then((value) => {
          calls.push({ pass, args, returned: value });
          return value;
        });
      }
      calls.push({ pass, args, returned });
      return returned;
    } as never);
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnext-pass-chain-"));
    calls = [];
    watch(Discover, "run", "1.1");
    watch(Parse, "sources", "1.2");
    watch(Declare, "sources", "1.3");
    watch(Resolve, "program", "1.4");
    watch(Analyze, "run", "2.1");
    watch(CodeGenWalker.prototype, "plan", "2.2");
    watch(CodeGenWalker.prototype, "render", "2.3");
    watch(HeaderRenderer, "render", "2.3 headers");
    watch(Write, "outputs", "3.1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function run(): Promise<void> {
    writeFileSync(
      join(tempDir, "lib.cnx"),
      `struct Point {\n    u32 x;\n}\n\nscope Lib {\n    public u32 double(u32 v) { return v * 2; }\n    public u32 xOf(Point p) { return p.x; }\n}\n`,
    );
    const entry = join(tempDir, "app.cnx");
    writeFileSync(
      entry,
      `#include "lib.cnx"\n\nu32 total <- 0;\n\nu32 readX(Point p) {\n    return p.x;\n}\n\nvoid main() {\n    Point pt <- { x: 3 };\n    total <- Lib.double(21) + readX(pt) + Lib.xOf(pt);\n}\n`,
    );
    const transpiler = new Transpiler(
      {
        input: entry,
        includeDirs: [tempDir],
        outDir: tempDir,
        headerOutDir: tempDir,
        target: "host",
      },
      NodeFileSystem.instance,
    );
    const result = await transpiler.transpile({ kind: "files" });
    expect(result.success).toBe(true);
  }

  function of(pass: string): ICall[] {
    return calls.filter((call) => call.pass === pass);
  }

  function only(pass: string): ICall {
    const found = of(pass);
    expect(found, `${pass} ran ${found.length} times`).toHaveLength(1);
    return found[0];
  }

  function expectFrom(
    pass: string,
    argument: unknown,
    previous: readonly ICall[],
  ): void {
    const held = new Set<unknown>();
    for (const call of previous) {
      for (const value of reachable(call.returned)) held.add(value);
    }
    expect(
      held.has(argument),
      `${pass} received an artifact that ${previous[0]?.pass} did not return`,
    ).toBe(true);
  }

  it("runs the eight passes in order", async () => {
    await run();
    const order = [...new Set(calls.map((call) => call.pass))];
    expect(order).toEqual([
      "1.1",
      "1.2",
      "1.3",
      "1.4",
      "2.1",
      "2.2",
      "2.3",
      "2.3 headers",
      "3.1",
    ]);
    // Whole-program passes finish before any file is planned, and every file
    // is rendered before anything is written.
    const index = (pass: string): number[] =>
      calls.flatMap((call, i) => (call.pass === pass ? [i] : []));
    expect(Math.max(...index("2.1"))).toBeLessThan(Math.min(...index("2.2")));
    expect(Math.max(...index("2.3"))).toBeLessThan(Math.min(...index("3.1")));
  });

  it("1.2 Parse takes 1.1's graph", async () => {
    await run();
    expectFrom("1.2", only("1.2").args[0], [only("1.1")]);
  });

  it("1.3 Declare takes 1.2's artifact itself", async () => {
    await run();
    // #1991 part B: the table and registry are 1.3's own, not handed in
    const declare = only("1.3");
    expect(declare.args).toHaveLength(1);
    expect(declare.args[0]).toBe(only("1.2").returned);
  });

  it("1.4 Resolve takes 1.3's artifact itself", async () => {
    await run();
    expect(only("1.4").args[0]).toBe(only("1.3").returned);
  });

  it("2.1 Analyze takes 1.4's program, sources and 1.1 facts", async () => {
    await run();
    const analyze = only("2.1");
    for (const argument of analyze.args.slice(0, 3)) {
      expectFrom("2.1", argument, [only("1.4")]);
    }
  });

  it("2.2 Plan takes each file's program from 2.1", async () => {
    await run();
    const plans = of("2.2");
    expect(plans.length).toBeGreaterThan(1);
    for (const plan of plans) {
      expectFrom("2.2", plan.args[0], [only("2.1")]);
      expectFrom("2.2", (plan.args[1] as { program: unknown }).program, [
        only("2.1"),
      ]);
    }
  });

  it("2.3 Render takes a plan 2.2 returned, itself", async () => {
    await run();
    const planned = new Set(of("2.2").map((call) => call.returned));
    const renders = of("2.3");
    expect(renders).toHaveLength(of("2.2").length);
    for (const render of renders) {
      expect(planned.has(render.args[0])).toBe(true);
    }
  });

  it("2.2 Plan needs nothing but 2.1's file and its options", async () => {
    await run();
    const plans = of("2.2");
    expect(plans.length).toBeGreaterThan(1);
    for (const plan of plans) {
      // A walker that planned no earlier file: nothing another file left behind
      expect(
        new CodeGenWalker().plan(plan.args[0] as never, plan.args[1] as never),
      ).toEqual(plan.returned);
    }
  });

  it("2.3 Render needs nothing but the plan", async () => {
    await run();
    const renders = of("2.3");
    expect(renders.length).toBeGreaterThan(0);
    for (const render of renders) {
      // A walker that never planned anything: no state 2.2 left behind
      expect(new CodeGenWalker().render(render.args[0] as never)).toEqual(
        render.returned,
      );
    }
  });

  it("3.1 Write writes exactly what 2.3 rendered", async () => {
    await run();
    const rendered = [
      ...of("2.3").map((call) => (call.returned as { code: string }).code),
      ...of("2.3 headers").flatMap((call) => [
        ...(
          call.returned as { headersBySourcePath: Map<string, string> }
        ).headersBySourcePath.values(),
      ]),
    ];
    const outputs = only("3.1").args[1] as readonly { content: string }[];
    expect(outputs.map((output) => output.content).sort()).toEqual(
      [...rendered].sort(),
    );
  });

  it("2.3's header step takes the header input 2.3 returned, itself", async () => {
    await run();
    const returned = of("2.3").map(
      (call) => (call.returned as { headerFacts: unknown }).headerFacts,
    );
    expect(returned).not.toContain(null);
    const taken = only("2.3 headers").args[0] as ReadonlyMap<string, unknown>;
    expect(taken.size).toBe(returned.length);
    for (const facts of taken.values()) {
      expect(returned).toContain(facts);
    }
  });
});
