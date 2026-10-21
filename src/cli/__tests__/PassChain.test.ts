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
 * step". Every pass entry is watched through real runs, and each artifact
 * argument it receives must be the previous entry's return value or reachable
 * from it. A host that hands a pass anything it rebuilt or kept for itself --
 * a copy, a field, a skipped pass's result -- fails here. Identity alone can't
 * catch a value kept in a static or on the host, so 2.2, 2.3 and the header
 * step must also give one run's answers again, on fresh objects, after a
 * second run whose included file changes what the first file's C must be.
 *
 * Arguments that are not artifacts are named per entry: the filesystem port,
 * 1.1's run inputs, and 2.2's file key. The symbol table and
 * registry are 1.3's artifact data (#1991 part B): 1.3 builds them from the
 * headers 1.2 parsed, and 1.4 reads them off 1.3's result.
 *
 * Mutation-checked: handing each of 1.2 through 2.3 a copy of its artifact,
 * or 3.1 text 2.3 did not render, fails one test here per boundary. So does
 * a host that keeps run 1's program, a 2.2 cache keyed by path, a static the
 * host sets and 2.2 reads, a write to a path 1.1 didn't name, and a copy of
 * 2.1's artifact (`{ ...analysis }`) handed to 2.2.
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
    tempDir = mkdtempSync(join(tmpdir(), "cnx-pass-chain-"));
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

  /** `Lib.echo` takes `v` by value until it declares it `mut` (ADR-071) */
  const ECHO_READS = { mut: "", body: "return v;" };
  const ECHO_WRITES = { mut: "mut ", body: "v <- v + 1;\n        return v;" };

  function newTranspiler(): Transpiler {
    return new Transpiler(
      {
        input: join(tempDir, "app.cnx"),
        includeDirs: [tempDir],
        outDir: tempDir,
        headerOutDir: tempDir,
        target: "host",
      },
      NodeFileSystem.instance,
    );
  }

  async function run(
    echo = ECHO_READS,
    transpiler = newTranspiler(),
  ): Promise<void> {
    writeFileSync(
      join(tempDir, "lib.cnx"),
      `struct Point {\n    u32 x;\n}\n\nscope Lib {\n    public u32 double(u32 v) { return v * 2; }\n    public u32 xOf(Point p) { return p.x; }\n    public u32 echo(${echo.mut}u32 v) {\n        ${echo.body}\n    }\n}\n`,
    );
    writeFileSync(
      join(tempDir, "app.cnx"),
      `#include "lib.cnx"\n\nmut u32 total <- 0;\n\nu32 readX(Point p) {\n    return p.x;\n}\n\nvoid main() {\n    Point pt <- { x: 3 };\n    ${echo.mut}u32 n <- 4;\n    total <- Lib.double(21) + readX(pt) + Lib.xOf(pt) + Lib.echo(n);\n}\n`,
    );
    const result = await transpiler.transpile({ kind: "files" });
    expect(result.success).toBe(true);
  }

  /** The C 2.3 rendered for app.cnx */
  function appCode(): string {
    const codes = of("2.3").map(
      (call) => (call.returned as { code: string }).code,
    );
    const app = codes.find((code) => code.includes("total"));
    expect(app).toBeDefined();
    return app as string;
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

  it("2.1 Analyze takes 1.4's program, sources and 1.1 facts, and nothing else", async () => {
    await run();
    const analyze = only("2.1");
    expect(analyze.args).toHaveLength(3);
    for (const argument of analyze.args) {
      expectFrom("2.1", argument, [only("1.4")]);
    }
  });

  it("2.2 Plan takes one of 2.1's file keys and 2.1's artifact itself, and nothing else", async () => {
    await run();
    const analysis = only("2.1").returned as {
      files: ReadonlyMap<string, unknown>;
    };
    const files = [...analysis.files.keys()];
    const plans = of("2.2");
    expect(plans.length).toBeGreaterThan(1);
    for (const plan of plans) {
      expect(plan.args).toHaveLength(2);
      expect(files).toContain(plan.args[0]);
      // Nothing the host computes reaches 2.2: no options object, no copy
      expect(plan.args[1]).toBe(analysis);
    }
    expect(new Set(plans.map((plan) => plan.args[0])).size).toBe(plans.length);
  });

  it("1.3, 1.4, 2.3 and the header step take one argument each, and 1.2 1.1's graph and the compiler port", async () => {
    await run();
    // #1713: 1.2 reads the headers with the target's compiler, which the host
    // runs for it, as 3.1 writes through the host's filesystem port
    const graph = (only("1.1").returned as { graph: unknown }).graph;
    for (const call of of("1.2")) {
      expect(call.args, "1.2's arguments").toHaveLength(2);
      expect(call.args[0]).toBe(graph);
    }
    for (const pass of ["1.3", "1.4", "2.3", "2.3 headers"]) {
      expect(of(pass).length, `${pass} ran`).toBeGreaterThan(0);
      for (const call of of(pass)) {
        expect(call.args, `${pass}'s arguments`).toHaveLength(1);
      }
    }
  });

  it("a second run on one host takes the second run's sources", async () => {
    const transpiler = newTranspiler();
    await run(ECHO_READS, transpiler);
    expect(appCode()).not.toContain("Lib__echo(&n)");
    calls = [];
    await run(ECHO_WRITES, transpiler);
    expect(appCode()).toContain("Lib__echo(&n)");
  });

  it("2.2, 2.3 and the header step give a run's answers after another run", async () => {
    await run(ECHO_READS);
    const first = calls;
    calls = [];
    // Another host, other sources: anything static now holds this run's facts
    await run(ECHO_WRITES);
    for (const plan of first.filter((call) => call.pass === "2.2")) {
      expect(
        new CodeGenWalker().plan(plan.args[0] as never, plan.args[1] as never),
      ).toEqual(plan.returned);
    }
    for (const render of first.filter((call) => call.pass === "2.3")) {
      expect(new CodeGenWalker().render(render.args[0] as never)).toEqual(
        render.returned,
      );
    }
    for (const headers of first.filter((call) => call.pass === "2.3 headers")) {
      expect(HeaderRenderer.render(headers.args[0] as never)).toEqual(
        headers.returned,
      );
    }
  });

  it("3.1 Write writes to the paths 1.1 named", async () => {
    await run();
    const named = new Set<string>();
    const discovered = only("1.1").returned as {
      graph: {
        outputs: Readonly<
          Record<
            "c" | "cpp",
            ReadonlyMap<string, { source: string; header: string }>
          >
        >;
      };
    };
    const byMode = discovered.graph.outputs;
    for (const paths of [...byMode.c.values(), ...byMode.cpp.values()]) {
      named.add(paths.source);
      named.add(paths.header);
    }
    const outputs = only("3.1").args[1] as readonly { path: string }[];
    expect(outputs.length).toBeGreaterThan(2);
    const written = outputs.map((output) => output.path);
    expect(new Set(written).size).toBe(written.length);
    for (const path of written) {
      expect(named.has(path), `3.1 wrote to ${path}`).toBe(true);
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

  it("2.2 Plan needs nothing but 2.1's file and artifact", async () => {
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
