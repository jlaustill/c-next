/**
 * Unit tests for SymbolCollectorContext.
 * Tests the shared context for C and C++ symbol collectors.
 */

import { describe, expect, it } from "vitest";
import SymbolCollectorContext from "../SymbolCollectorContext";
import SymbolTable from "../SymbolTable";

describe("SymbolCollectorContext", () => {
  describe("create", () => {
    it("creates context with sourceFile and empty collections", () => {
      const ctx = SymbolCollectorContext.create("/path/to/file.h");

      expect(ctx.sourceFile).toBe("/path/to/file.h");
      expect(ctx.symbols).toEqual([]);
      expect(ctx.warnings).toEqual([]);
      expect(ctx.symbolTable).toBeNull();
    });

    it("creates context with optional symbolTable", () => {
      const symbolTable = new SymbolTable();
      const ctx = SymbolCollectorContext.create("/path/to/file.h", symbolTable);

      expect(ctx.symbolTable).toBe(symbolTable);
    });
  });

  describe("reset", () => {
    it("clears symbols and warnings arrays", () => {
      const ctx = SymbolCollectorContext.create("/path/to/file.h");
      ctx.symbols.push({
        name: "test",
        kind: "function",
        sourceFile: "/path/to/file.h",
        sourceLine: 1,
        sourceLanguage: "c",
        isExported: true,
      } as any);
      ctx.warnings.push("some warning");

      SymbolCollectorContext.reset(ctx);

      expect(ctx.symbols).toEqual([]);
      expect(ctx.warnings).toEqual([]);
    });
  });
});
