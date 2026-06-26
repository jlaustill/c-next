/**
 * Guard: every shipped example under examples/ must transpile cleanly.
 *
 * Issue #1048: example .cnx files are not part of the integration suite, so
 * they silently rotted to syntax the transpiler now rejects. This test runs in
 * the unit suite (CI) and fails the moment any example stops transpiling.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import Transpiler from "../../src/transpiler/Transpiler";
import FileScanner from "../utils/FileScanner";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const examplesDir = join(repoRoot, "examples");
const examples = FileScanner.findFiles(examplesDir, ".cnx").map(
  (absolutePath) => [relative(repoRoot, absolutePath), absolutePath] as const,
);

describe("examples transpile cleanly (Issue #1048)", () => {
  it("finds example .cnx files to check", () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  it.each(examples)("%s transpiles without errors", async (_label, file) => {
    const outDir = mkdtempSync(join(tmpdir(), "cnext-examples-"));
    const pipeline = new Transpiler({
      input: file,
      outDir,
      basePath: dirname(file),
    });

    const result = await pipeline.transpile({ kind: "files" });

    const errorText = result.errors
      .map((e) => `${e.line}:${e.column} ${e.message}`)
      .join("\n");
    expect(result.success, errorText).toBe(true);
  });
});
