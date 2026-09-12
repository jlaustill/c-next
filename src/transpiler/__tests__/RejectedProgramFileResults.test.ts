import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Transpiler from "../Transpiler";
import CodeGenState from "../state/CodeGenState";
import SymbolRegistry from "../state/SymbolRegistry";

/**
 * #1320: 2.1 Analyze decides "is this PROGRAM legal?" once, whole-program,
 * before Stage 5 plans anything. A program it rejects is not planned at all
 * -- not even the files 2.1 found nothing wrong with.
 *
 * That is a real, deliberate change from before the hoist: analysis used to
 * be decided per file inside the same loop that planned and rendered, so a
 * clean file was planned and rendered even while a sibling failed. This pins
 * the new behavior explicitly (see the review discussion on PR #1549) rather
 * than leaving it to be discovered by whatever first depends on it.
 */
describe("a rejected program plans no file, including a clean one (#1320)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-rejected-program-"));
    SymbolRegistry.reset();
    CodeGenState.reset();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports success:true, empty code, and no headerCode for a 2.1-clean file when a sibling is rejected", async () => {
    writeFileSync(join(dir, "clean.cnx"), "u32 cleanFn() { return 1; }\n");
    writeFileSync(
      join(dir, "entry.cnx"),
      '#include "clean.cnx"\n' +
        "u32 byZero() { return 10 / 0; }\n" +
        "u32 main() { return cleanFn(); }\n",
    );

    const transpiler = new Transpiler({
      input: join(dir, "entry.cnx"),
      outDir: dir,
      noCache: true,
    });
    const result = await transpiler.transpile({ kind: "files" });

    expect(result.success).toBe(false);

    const rejectedFile = result.files.find((f) =>
      f.sourcePath.endsWith("entry.cnx"),
    );
    expect(rejectedFile?.success).toBe(false);
    expect(rejectedFile?.errors.length).toBeGreaterThan(0);

    const cleanFile = result.files.find((f) =>
      f.sourcePath.endsWith("clean.cnx"),
    );
    // NOT the pre-#1320 behavior. Before the hoist, a clean file was planned
    // and rendered regardless of a sibling's fate, so `code` and `headerCode`
    // carried real content here. Reverting Transpiler.ts's dispatch on
    // `diagnostics.hasErrors()` back to unconditionally calling
    // `_transpileFile` reddens exactly these four assertions.
    expect(cleanFile?.success).toBe(true);
    expect(cleanFile?.errors).toEqual([]);
    expect(cleanFile?.code).toBe("");
    expect(cleanFile?.headerCode).toBeUndefined();
  });
});
