import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import CodeGenState from "../state/CodeGenState";
import SymbolRegistry from "../state/SymbolRegistry";
import Transpiler from "../Transpiler";

/**
 * Issue #1233: a failed multi-file transpile still wrote the `.c` of every file
 * that happened to succeed before the failure. Headers were already gated on
 * `result.success` (Stage 6), so the output was not merely partial, it was
 * inconsistent -- a `.c` that `#include`s a header the same run refused to
 * write. On a clean tree that translation unit cannot compile; on a dirty one
 * it compiles against whatever stale header is lying around.
 *
 * Uses the real filesystem because the defect IS the disk write; a mock that
 * records calls would pass against a transpiler that still emitted the file.
 */
describe("a failed transpile writes no .c to disk (#1233)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-1233-"));
    SymbolRegistry.reset();
    CodeGenState.reset();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  async function run(entryBody: string): Promise<boolean> {
    writeFileSync(join(dir, "good.cnx"), "u32 helper() { return 1; }\n");
    writeFileSync(join(dir, "entry.cnx"), entryBody);
    const transpiler = new Transpiler({
      input: join(dir, "entry.cnx"),
      outDir: dir,
      noCache: true,
    });
    const result = await transpiler.transpile({ kind: "files" });
    return result.success;
  }

  it("leaves no .c behind when a later file fails", async () => {
    // good.cnx transpiles fine on its own; the run as a whole does not.
    const success = await run(
      '#include "good.cnx"\nu32 main() { u32 r <- helper() / 0; return r; }\n',
    );

    expect(success).toBe(false);
    expect(existsSync(join(dir, "good.c"))).toBe(false);
    expect(existsSync(join(dir, "entry.c"))).toBe(false);
    // The header was already gated; asserted so the pair cannot drift apart.
    expect(existsSync(join(dir, "good.h"))).toBe(false);
  });

  it("still writes the .c when the run succeeds", async () => {
    const success = await run(
      '#include "good.cnx"\nu32 main() { return helper(); }\n',
    );

    expect(success).toBe(true);
    expect(existsSync(join(dir, "good.c"))).toBe(true);
    expect(existsSync(join(dir, "entry.c"))).toBe(true);
  });
});
