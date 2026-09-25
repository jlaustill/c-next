/**
 * Issue #1307 review: Stage 4c must report against the budget the *build* asks
 * for, not against whatever codegen left in a static.
 *
 * `state.targetCapabilities` is assigned only inside
 * `CodeGenerator.generate()` — Stage 5, per file — so reading it at Stage 4c
 * yields the module default on a fresh process and the previously generated
 * file's target in a long-lived one (`cnext serve`, the VS Code path, any API
 * consumer). That made E0204 reject programs declaring no target at all, on a
 * budget belonging to an earlier run.
 *
 * It was invisible because all eight TARGET_CAPABILITIES entries carry the same
 * 31/63 — the check and the target agreed by coincidence rather than by wiring.
 * These tests poison the static deliberately, which is the only way the
 * difference is observable.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Transpiler from "../Transpiler";
import type CodeGenWalker from "../../TRANSPILE/CodeGenWalker";
import DEFAULT_TARGET from "../constants/DEFAULT_TARGET";

/** Two members that are distinct at 31 characters but collide at 6. */
const NARROW_COLLIDER = `scope Tiny {
    public u8 alpha <- 1;
    public u8 omega <- 2;
}

i32 main() {
    return 0;
}`;

/**
 * The render state of a given transpiler, which is where a previous run's
 * budget would be left behind.
 *
 * #1452: this was `CodeGenState.targetCapabilities`, a static, so poisoning it
 * from anywhere poisoned the instance Stage 4c read. With the state an instance
 * owned by each `Transpiler`, a module-level `new TranspileState()` is a
 * different object from the one under test -- so the trap this file sets has to
 * be set on the transpiler that will run, the way
 * `CrossRunDiscoveryFacts.test.ts` reaches a private field.
 */
function stateOf(transpiler: Transpiler) {
  return (transpiler as unknown as { codeGenerator: CodeGenWalker })
    .codeGenerator.transpileState;
}

describe("External identifier significance (#1307)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnext-e0204-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  /** A transpiler for `source`, reusable across runs so state can persist. */
  function transpilerFor(source: string, target?: string) {
    const sourcePath = join(tempDir, "sample.cnx");
    writeFileSync(sourcePath, source);
    return {
      transpiler: new Transpiler({
        input: sourcePath,
        includeDirs: [tempDir],
        outDir: tempDir,
        headerOutDir: tempDir,
        noCache: true,
        ...(target ? { target } : {}),
      }),
      sourcePath,
    };
  }

  async function transpile(source: string, target?: string) {
    const { transpiler, sourcePath } = transpilerFor(source, target);
    return transpiler.transpile({
      kind: "source",
      source,
      workingDir: tempDir,
      sourcePath,
    });
  }

  it("ignores a narrower budget left behind by an earlier run", async () => {
    // ONE transpiler for both runs, which is the shape the defect needs: a
    // fresh one per run cannot carry anything between them, so the poison below
    // would be written to an object nothing reads and the test would pass
    // whatever Stage 4c does.
    const { transpiler, sourcePath } = transpilerFor(NARROW_COLLIDER);
    const run = () =>
      transpiler.transpile({
        kind: "source",
        source: NARROW_COLLIDER,
        workingDir: tempDir,
        sourcePath,
      });

    const clean = await run();
    expect(clean.success).toBe(true);

    // Exactly what generating a file for a 6-significant-character target
    // leaves on the state Stage 4c used to read -- on THIS transpiler's
    // instance, so the second run below actually sees it.
    stateOf(transpiler).targetCapabilities = {
      ...DEFAULT_TARGET,
      significantExternalIdentifierChars: 6,
    };
    expect(
      stateOf(transpiler).targetCapabilities.significantExternalIdentifierChars,
    ).toBe(6);

    const afterPoisoning = await run();
    expect(afterPoisoning.errors.map((e) => e.message)).toEqual([]);
    expect(afterPoisoning.success).toBe(true);
  });

  it("still rejects a genuine collision at the resolved budget", async () => {
    // The negative control for the test above: proving the check is not simply
    // silent now. These two collide at 31, which is what the build asks for.
    const result = await transpile(`scope TemperatureSensorController {
    public u8 calibrationOffsetValue <- 1;
    public u8 calibrationOffsetLimit <- 2;
}

i32 main() {
    return 0;
}`);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.message.includes("E0204"))).toBe(true);
  });

  it("reports the budget of the target the build actually named", async () => {
    const result = await transpile(NARROW_COLLIDER, "avr");
    expect(result.success).toBe(true);
  });
});
