/**
 * Guard: every shipped example under examples/ must transpile cleanly AND its
 * generated C must compile (gcc -fsyntax-only).
 *
 * Issue #1048: example .cnx files are not part of the integration suite, so
 * they silently rotted. The transpile check alone is not enough — codegen can
 * succeed yet emit C that does not compile, so we also compile-check the output.
 * Examples that pull in platform headers (e.g. <Arduino.h>) can't compile
 * standalone, so a *missing-header* error is tolerated; any other compile error
 * fails the test.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import Transpiler from "../../src/transpiler/Transpiler";
import FileScanner from "../utils/FileScanner";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const examplesDir = join(repoRoot, "examples");
const examples = FileScanner.findFiles(examplesDir, ".cnx").map(
  (absolutePath) => [relative(repoRoot, absolutePath), absolutePath] as const,
);

const gccAvailable =
  spawnSync("gcc", ["--version"], { encoding: "utf-8" }).status === 0;

/**
 * Compile-check one generated C file. Returns null on success (or a tolerated
 * missing-platform-header failure), or the gcc stderr on a real failure.
 */
function compileCheck(cPath: string, includeDir: string): string | null {
  const gcc = spawnSync(
    "gcc",
    [
      "-fsyntax-only",
      "-std=c99",
      "-I",
      join(repoRoot, "tests/include"),
      "-I",
      includeDir,
      cPath,
    ],
    { encoding: "utf-8" },
  );
  if (gcc.status === 0) {
    return null;
  }
  const errorLines = (gcc.stderr || "")
    .split("\n")
    .filter((line) => /error:/i.test(line));
  const onlyMissingHeaders =
    errorLines.length > 0 &&
    errorLines.every((line) => /No such file or directory/.test(line));
  return onlyMissingHeaders ? null : gcc.stderr;
}

describe("examples transpile and compile cleanly (Issue #1048)", () => {
  it("finds example .cnx files to check", () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  it.each(examples)("%s transpiles and compiles", async (_label, file) => {
    const outDir = mkdtempSync(join(tmpdir(), "cnext-examples-"));
    try {
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

      if (!gccAvailable) {
        return;
      }

      for (const fileResult of result.files) {
        if (!fileResult.code) {
          continue;
        }
        const base = basename(fileResult.sourcePath).replace(/\.cnx$/, "");
        const cPath = join(outDir, `${base}.c`);
        writeFileSync(cPath, fileResult.code);
        if (fileResult.headerCode) {
          writeFileSync(join(outDir, `${base}.h`), fileResult.headerCode);
        }
        const failure = compileCheck(cPath, outDir);
        expect(
          failure,
          `Generated C from ${base} does not compile:\n${failure}`,
        ).toBeNull();
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
