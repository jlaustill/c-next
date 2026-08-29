/**
 * Issue #1307 review: Stage 4c must report against the budget the *build* asks
 * for, not against whatever codegen left in a static.
 *
 * `CodeGenState.targetCapabilities` is assigned only inside
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
import CodeGenState from "../state/CodeGenState";
import DEFAULT_TARGET from "../constants/DEFAULT_TARGET";

/** Two members that are distinct at 31 characters but collide at 6. */
const NARROW_COLLIDER = `scope Tiny {
    public u8 alpha <- 1;
    public u8 omega <- 2;
}

i32 main() {
    return 0;
}`;

describe("External identifier significance (#1307)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnext-e0204-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    CodeGenState.targetCapabilities = DEFAULT_TARGET;
  });

  async function transpile(source: string, target?: string) {
    const sourcePath = join(tempDir, "sample.cnx");
    writeFileSync(sourcePath, source);
    return new Transpiler({
      input: sourcePath,
      includeDirs: [tempDir],
      outDir: tempDir,
      headerOutDir: tempDir,
      noCache: true,
      ...(target ? { target } : {}),
    }).transpile({ kind: "source", source, workingDir: tempDir, sourcePath });
  }

  it("ignores a narrower budget left behind by an earlier run", async () => {
    const clean = await transpile(NARROW_COLLIDER);
    expect(clean.success).toBe(true);

    // Exactly what generating a file for a 6-significant-character target
    // would leave in the static that Stage 4c used to read.
    CodeGenState.targetCapabilities = {
      ...DEFAULT_TARGET,
      significantExternalIdentifierChars: 6,
    };

    const afterPoisoning = await transpile(NARROW_COLLIDER);
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
