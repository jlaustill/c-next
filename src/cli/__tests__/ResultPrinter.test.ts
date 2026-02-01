/**
 * Unit tests for ResultPrinter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ResultPrinter from "../ResultPrinter";

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
      ResultPrinter.print({
        success: true,
        filesProcessed: 1,
        symbolsCollected: 0,
        conflicts: [],
        errors: [],
        warnings: ["Unused variable 'x'", "Deprecated function"],
        outputFiles: ["output.c"],
      });

      expect(warnOutput).toContain("Warning: Unused variable 'x'");
      expect(warnOutput).toContain("Warning: Deprecated function");
    });

    it("prints conflicts to console.error", () => {
      ResultPrinter.print({
        success: true,
        filesProcessed: 1,
        symbolsCollected: 0,
        conflicts: ["Symbol 'foo' defined twice", "Type mismatch"],
        errors: [],
        warnings: [],
        outputFiles: ["output.c"],
      });

      expect(errorOutput).toContain("Conflict: Symbol 'foo' defined twice");
      expect(errorOutput).toContain("Conflict: Type mismatch");
    });

    it("prints errors with source path when available", () => {
      ResultPrinter.print({
        success: false,
        filesProcessed: 0,
        symbolsCollected: 0,
        conflicts: [],
        errors: [
          {
            line: 10,
            column: 5,
            message: "Syntax error",
            sourcePath: "src/main.cnx",
          },
        ],
        warnings: [],
        outputFiles: [],
      });

      expect(errorOutput).toContain("Error: src/main.cnx:10:5 Syntax error");
    });

    it("prints errors without source path", () => {
      ResultPrinter.print({
        success: false,
        filesProcessed: 0,
        symbolsCollected: 0,
        conflicts: [],
        errors: [
          {
            line: 15,
            column: 3,
            message: "Unknown type",
          },
        ],
        warnings: [],
        outputFiles: [],
      });

      expect(errorOutput).toContain("Error: 15:3 Unknown type");
    });

    it("prints success summary when compilation succeeds", () => {
      ResultPrinter.print({
        success: true,
        filesProcessed: 5,
        symbolsCollected: 42,
        conflicts: [],
        errors: [],
        warnings: [],
        outputFiles: ["a.c", "b.c", "c.c"],
      });

      const fullLog = logOutput.join("\n");
      expect(fullLog).toContain("Compiled 5 files");
      expect(fullLog).toContain("Collected 42 symbols");
      expect(fullLog).toContain("Generated 3 output files:");
      expect(fullLog).toContain("a.c");
      expect(fullLog).toContain("b.c");
      expect(fullLog).toContain("c.c");
    });

    it("prints failure message when compilation fails", () => {
      ResultPrinter.print({
        success: false,
        filesProcessed: 0,
        symbolsCollected: 0,
        conflicts: [],
        errors: [],
        warnings: [],
        outputFiles: [],
      });

      expect(errorOutput).toContain("Compilation failed");
    });

    it("prints all output files with indentation", () => {
      ResultPrinter.print({
        success: true,
        filesProcessed: 2,
        symbolsCollected: 10,
        conflicts: [],
        errors: [],
        warnings: [],
        outputFiles: ["/path/to/output/main.c", "/path/to/output/main.h"],
      });

      expect(logOutput).toContain("  /path/to/output/main.c");
      expect(logOutput).toContain("  /path/to/output/main.h");
    });

    it("prints empty line before summary", () => {
      ResultPrinter.print({
        success: true,
        filesProcessed: 1,
        symbolsCollected: 1,
        conflicts: [],
        errors: [],
        warnings: [],
        outputFiles: ["out.c"],
      });

      // First call should be empty string (blank line)
      expect(logOutput[0]).toBe("");
    });

    it("handles multiple errors", () => {
      ResultPrinter.print({
        success: false,
        filesProcessed: 0,
        symbolsCollected: 0,
        conflicts: [],
        errors: [
          { line: 1, column: 1, message: "Error 1", sourcePath: "a.cnx" },
          { line: 2, column: 2, message: "Error 2", sourcePath: "b.cnx" },
          { line: 3, column: 3, message: "Error 3" },
        ],
        warnings: [],
        outputFiles: [],
      });

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

      ResultPrinter.print({
        success: false,
        filesProcessed: 0,
        symbolsCollected: 0,
        conflicts: ["Conflict 1"],
        errors: [{ line: 1, column: 1, message: "Error 1" }],
        warnings: ["Warning 1"],
        outputFiles: [],
      });

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
