/**
 * Unit tests for ResultPrinter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import ResultPrinter from "../ResultPrinter";
import ITranspilerResult from "../../transpiler/types/ITranspilerResult";

/**
 * Create a minimal ITranspilerResult with sensible defaults
 */
function createResult(
  overrides: Partial<ITranspilerResult> = {},
): ITranspilerResult {
  return {
    success: true,
    files: [],
    filesProcessed: 0,
    symbolsCollected: 0,
    errors: [],
    warnings: [],
    outputFiles: [],
    ...overrides,
  };
}

describe("ResultPrinter", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let logOutput: string[];
  let warnOutput: string[];
  let errorOutput: string[];

  beforeEach(() => {
    logOutput = [];
    warnOutput = [];
    errorOutput = [];

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
      logOutput.push(msg ?? "");
    });
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation((msg) => {
      warnOutput.push(msg ?? "");
    });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((msg) => {
      errorOutput.push(msg ?? "");
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("print", () => {
    it("prints warnings to console.warn", () => {
      ResultPrinter.print(
        createResult({
          filesProcessed: 1,
          warnings: ["Unused variable 'x'", "Deprecated function"],
          outputFiles: ["output.c"],
        }),
      );

      expect(warnOutput).toContain("Warning: Unused variable 'x'");
      expect(warnOutput).toContain("Warning: Deprecated function");
    });

    // #1334: the `Conflict:` channel is gone -- the field, its producer, and its
    // reader. A conflict used to arrive through it AND as a companion error with no
    // position, so one problem printed two lines and neither carried an error code.
    // #1345 review: the header rendered `error.sourcePath` raw while the message
    // BODY beside it went through DeclarationSite, so one diagnostic spelled the
    // same file two ways, one line apart -- an absolute machine-specific path
    // above a cwd-relative one. Nothing guarded it: the harness strips the header
    // path before snapshotting, so `.expected.error` cannot see this at all.
    it("renders the header path relative to the invocation directory", () => {
      ResultPrinter.print(
        createResult({
          success: false,
          errors: [
            {
              line: 16,
              column: 0,
              sourcePath: join(process.cwd(), "tests/bugs/collide.test.cnx"),
              message: "error[E0204]: External identifiers are not distinct",
              severity: "error",
            },
          ],
        }),
      );

      const printed = errorOutput.join("\n");
      expect(printed).toContain(
        "Error: tests/bugs/collide.test.cnx:16:0 error[E0204]:",
      );
      expect(printed).not.toContain(process.cwd());
    });

    it("prints a symbol conflict as a coded error at its real position", () => {
      ResultPrinter.print(
        createResult({
          success: false,
          errors: [
            {
              line: 24,
              column: 0,
              sourcePath: "dup.cnx",
              message:
                "error[E0425]: Symbol conflict: 'Lib.useIt' is defined multiple times in C-Next:\n  dup.cnx:24\n  dup.cnx:30",
              severity: "error",
            },
          ],
        }),
      );

      // errorOutput is string[], and the conflict is ONE multi-line entry --
      // that is the point: it used to be two separate outputs.
      const printed = errorOutput.join("\n");
      expect(printed).toContain("Error: dup.cnx:24:0 error[E0425]:");
      expect(printed).toContain("dup.cnx:30");
      // The property that matters: one diagnostic, not a `Conflict:` line plus a
      // companion error carrying no position.
      expect(printed).not.toContain("Conflict:");
      expect(printed).not.toContain("cannot proceed");
    });

    it("prints errors with source path when available", () => {
      ResultPrinter.print(
        createResult({
          success: false,
          errors: [
            {
              line: 10,
              column: 5,
              message: "Syntax error",
              sourcePath: "src/main.cnx",
              severity: "error",
            },
          ],
        }),
      );

      expect(errorOutput).toContain("Error: src/main.cnx:10:5 Syntax error");
    });

    it("prints errors without source path", () => {
      ResultPrinter.print(
        createResult({
          success: false,
          errors: [
            {
              line: 15,
              column: 3,
              message: "Unknown type",
              severity: "error",
            },
          ],
        }),
      );

      expect(errorOutput).toContain("Error: 15:3 Unknown type");
    });

    it("prints success summary when compilation succeeds", () => {
      ResultPrinter.print(
        createResult({
          filesProcessed: 5,
          symbolsCollected: 42,
          outputFiles: ["a.c", "b.c", "c.c"],
        }),
      );

      const fullLog = logOutput.join("\n");
      expect(fullLog).toContain("Compiled 5 files");
      expect(fullLog).toContain("Collected 42 symbols");
      expect(fullLog).toContain("Generated 3 output files:");
      expect(fullLog).toContain("a.c");
      expect(fullLog).toContain("b.c");
      expect(fullLog).toContain("c.c");
    });

    it("prints failure message when compilation fails", () => {
      ResultPrinter.print(createResult({ success: false }));

      expect(errorOutput).toContain("Compilation failed");
    });

    it("prints all output files with indentation", () => {
      ResultPrinter.print(
        createResult({
          filesProcessed: 2,
          symbolsCollected: 10,
          outputFiles: ["/path/to/output/main.c", "/path/to/output/main.h"],
        }),
      );

      expect(logOutput).toContain("  /path/to/output/main.c");
      expect(logOutput).toContain("  /path/to/output/main.h");
    });

    it("prints empty line before summary", () => {
      ResultPrinter.print(
        createResult({
          filesProcessed: 1,
          symbolsCollected: 1,
          outputFiles: ["out.c"],
        }),
      );

      // First call should be empty string (blank line)
      expect(logOutput[0]).toBe("");
    });

    it("handles multiple errors", () => {
      ResultPrinter.print(
        createResult({
          success: false,
          errors: [
            {
              line: 1,
              column: 1,
              message: "Error 1",
              sourcePath: "a.cnx",
              severity: "error",
            },
            {
              line: 2,
              column: 2,
              message: "Error 2",
              sourcePath: "b.cnx",
              severity: "error",
            },
            { line: 3, column: 3, message: "Error 3", severity: "error" },
          ],
        }),
      );

      expect(errorOutput).toContain("Error: a.cnx:1:1 Error 1");
      expect(errorOutput).toContain("Error: b.cnx:2:2 Error 2");
      expect(errorOutput).toContain("Error: 3:3 Error 3");
    });

    it("prints warnings before errors", () => {
      const allOutput: string[] = [];
      consoleWarnSpy.mockImplementation(((msg: string) =>
        allOutput.push(`warn:${msg}`)) as typeof console.warn);
      consoleErrorSpy.mockImplementation(((msg: string) =>
        allOutput.push(`error:${msg}`)) as typeof console.error);

      ResultPrinter.print(
        createResult({
          success: false,
          errors: [
            { line: 1, column: 1, message: "Error 1", severity: "error" },
          ],
          warnings: ["Warning 1"],
        }),
      );

      // #1334: warnings then errors. The conflicts channel between them is gone;
      // a conflict is now one of the errors.
      const warningIndex = allOutput.findIndex((s) => s.includes("Warning 1"));
      const errorIndex = allOutput.findIndex((s) => s.includes("Error 1"));

      expect(warningIndex).toBeLessThan(errorIndex);
      expect(allOutput.some((s) => s.includes("Conflict 1"))).toBe(false);
    });
  });
});
