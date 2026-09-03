import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Transpiler from "../Transpiler";
import HeaderGenerator from "../output/headers/HeaderGenerator";
import CodeGenState from "../state/CodeGenState";
import SymbolRegistry from "../state/SymbolRegistry";

/**
 * Issue #1323: `_renderHeaders` (Stage 5.5) promotes a header-render failure
 * to `fileResult.success = false` and `result.errors`/`result.success`. That
 * promotion has no test of its own -- `HeaderEmissionPlanner.test.ts` covers
 * the planner's per-file ISOLATION of a render failure
 * (`errorsBySourcePath`), not the Transpiler's PROMOTION of one, which is the
 * half that decides whether a failed header fails the build at all. Replacing
 * `_renderHeaders`'s promotion branch with a bare `continue` would leave every
 * other test in the suite green.
 */
describe("header render failure promotion (#1323)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-header-render-failure-"));
    SymbolRegistry.reset();
    CodeGenState.reset();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("fails the run, prefixes the message, and attaches sourcePath, without aborting a sibling file's render", async () => {
    writeFileSync(join(dir, "helper.cnx"), "u32 helper() { return 1; }\n");
    writeFileSync(
      join(dir, "entry.cnx"),
      '#include "helper.cnx"\n' +
        "u32 addOne(u32 x) { return x + 1; }\n" +
        "u32 main() { return helper() + addOne(1); }\n",
    );

    // The first header rendered throws; every later one renders for real.
    // Mirrors HeaderEmissionPlanner.test.ts's own "does not let one file's
    // render failure abort another file's render".
    const generateSpy = vi.spyOn(HeaderGenerator.prototype, "generate");
    generateSpy.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    generateSpy.mockImplementationOnce(function (
      this: HeaderGenerator,
      ...args: Parameters<HeaderGenerator["generate"]>
    ) {
      return HeaderGenerator.prototype.generate.apply(this, args);
    });

    const transpiler = new Transpiler({
      input: join(dir, "entry.cnx"),
      outDir: dir,
      noCache: true,
    });
    const result = await transpiler.transpile({ kind: "files" });

    expect(result.success).toBe(false);

    const failedFile = result.files.find((f) => !f.success);
    expect(failedFile).toBeDefined();
    expect(failedFile?.errors[0]?.message).toMatch(
      /^Header generation failed: boom/,
    );

    // Promoted to the run-level list, sourcePath attached -- replacing the
    // promotion branch with `continue` would leave this array empty.
    const runLevelError = result.errors.find(
      (e) => e.sourcePath === failedFile?.sourcePath,
    );
    expect(runLevelError).toBeDefined();
    expect(runLevelError?.message).toMatch(/^Header generation failed: boom/);

    // The property errorsBySourcePath exists for: the OTHER file's header
    // still rendered, and that file is still reported as successful.
    const survivingFile = result.files.find(
      (f) => f.sourcePath !== failedFile?.sourcePath,
    );
    expect(survivingFile?.success).toBe(true);
    expect(survivingFile?.headerCode).toBeDefined();
    expect(survivingFile?.code.length).toBeGreaterThan(0);
  });
});
