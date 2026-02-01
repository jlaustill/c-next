/**
 * Unit tests for ResultPrinter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
    conflicts: [],
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

    it("prints conflicts to console.error", () => {
      ResultPrinter.print(
        createResult({
          filesProcessed: 1,
          conflicts: ["Symbol 'foo' defined twice", "Type mismatch"],
          outputFiles: ["output.c"],
        }),
      );

      expect(errorOutput).toContain("Conflict: Symbol 'foo' defined twice");
      expect(errorOutput).toContain("Conflict: Type mismatch");
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

    it("prints warnings, conflicts, and errors in order", () => {
      const allOutput: string[] = [];
      consoleWarnSpy.mockImplementation((msg) => allOutput.push(`warn:${msg}`));
      consoleErrorSpy.mockImplementation((msg) =>
        allOutput.push(`error:${msg}`),
      );

      ResultPrinter.print(
        createResult({
          success: false,
          conflicts: ["Conflict 1"],
          errors: [
            { line: 1, column: 1, message: "Error 1", severity: "error" },
          ],
          warnings: ["Warning 1"],
        }),
      );

      // Warnings come first, then conflicts, then errors
      const warningIndex = allOutput.findIndex((s) => s.includes("Warning 1"));
      const conflictIndex = allOutput.findIndex((s) =>
        s.includes("Conflict 1"),
      );
      const errorIndex = allOutput.findIndex((s) => s.includes("Error 1"));

      expect(warningIndex).toBeLessThan(conflictIndex);
      expect(conflictIndex).toBeLessThan(errorIndex);
    });
  });
});
