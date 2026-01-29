/**
 * Unit tests for SymbolCollectorContext.
 * Tests the shared context for C and C++ symbol collectors.
 */

import { describe, expect, it } from "vitest";
import SymbolCollectorContext from "../SymbolCollectorContext";
import SymbolTable from "../SymbolTable";
import ESymbolKind from "../../types/ESymbolKind";
import ESourceLanguage from "../../types/ESourceLanguage";
import ISymbol from "../../types/ISymbol";

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

    it("creates context with different source file paths", () => {
      const ctxC = SymbolCollectorContext.create("/path/to/file.c");
      const ctxCpp = SymbolCollectorContext.create("/path/to/file.cpp");
      const ctxH = SymbolCollectorContext.create("/path/to/file.h");

      expect(ctxC.sourceFile).toBe("/path/to/file.c");
      expect(ctxCpp.sourceFile).toBe("/path/to/file.cpp");
      expect(ctxH.sourceFile).toBe("/path/to/file.h");
    });

    it("creates independent contexts", () => {
      const ctx1 = SymbolCollectorContext.create("/file1.h");
      const ctx2 = SymbolCollectorContext.create("/file2.h");

      ctx1.symbols.push(createMockSymbol("sym1"));
      ctx2.warnings.push("warning2");

      expect(ctx1.symbols).toHaveLength(1);
      expect(ctx2.symbols).toHaveLength(0);
      expect(ctx1.warnings).toHaveLength(0);
      expect(ctx2.warnings).toHaveLength(1);
    });
  });

  describe("reset", () => {
    it("clears symbols and warnings arrays", () => {
      const ctx = SymbolCollectorContext.create("/path/to/file.h");
      ctx.symbols.push(createMockSymbol("test"));
      ctx.warnings.push("some warning");

      SymbolCollectorContext.reset(ctx);

      expect(ctx.symbols).toEqual([]);
      expect(ctx.warnings).toEqual([]);
    });

    it("preserves sourceFile after reset", () => {
      const ctx = SymbolCollectorContext.create("/path/to/file.h");
      ctx.symbols.push(createMockSymbol("test"));

      SymbolCollectorContext.reset(ctx);

      expect(ctx.sourceFile).toBe("/path/to/file.h");
    });

    it("preserves symbolTable after reset", () => {
      const symbolTable = new SymbolTable();
      const ctx = SymbolCollectorContext.create("/path/to/file.h", symbolTable);
      ctx.symbols.push(createMockSymbol("test"));

      SymbolCollectorContext.reset(ctx);

      expect(ctx.symbolTable).toBe(symbolTable);
    });

    it("clears multiple symbols and warnings", () => {
      const ctx = SymbolCollectorContext.create("/path/to/file.h");
      ctx.symbols.push(createMockSymbol("func1"));
      ctx.symbols.push(createMockSymbol("func2"));
      ctx.symbols.push(createMockSymbol("var1"));
      ctx.warnings.push("warning1");
      ctx.warnings.push("warning2");

      SymbolCollectorContext.reset(ctx);

      expect(ctx.symbols).toEqual([]);
      expect(ctx.warnings).toEqual([]);
    });

    it("allows reuse after reset", () => {
      const ctx = SymbolCollectorContext.create("/path/to/file.h");
      ctx.symbols.push(createMockSymbol("original"));
      ctx.warnings.push("original warning");

      SymbolCollectorContext.reset(ctx);

      ctx.symbols.push(createMockSymbol("new"));
      ctx.warnings.push("new warning");

      expect(ctx.symbols).toHaveLength(1);
      expect(ctx.symbols[0].name).toBe("new");
      expect(ctx.warnings).toEqual(["new warning"]);
    });
  });

  describe("integration patterns", () => {
    it("supports C symbol collection pattern", () => {
      const symbolTable = new SymbolTable();
      const ctx = SymbolCollectorContext.create("/path/to/file.c", symbolTable);

      // Simulate C collector adding symbols
      ctx.symbols.push({
        name: "main",
        kind: ESymbolKind.Function,
        type: "int",
        sourceFile: ctx.sourceFile,
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      });

      expect(ctx.symbols).toHaveLength(1);
      expect(ctx.symbols[0].sourceLanguage).toBe(ESourceLanguage.C);
    });

    it("supports C++ symbol collection pattern", () => {
      const symbolTable = new SymbolTable();
      const ctx = SymbolCollectorContext.create(
        "/path/to/file.cpp",
        symbolTable,
      );

      // Simulate C++ collector adding namespace and class
      ctx.symbols.push({
        name: "MyNamespace",
        kind: ESymbolKind.Namespace,
        sourceFile: ctx.sourceFile,
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      });

      ctx.symbols.push({
        name: "MyNamespace::MyClass",
        kind: ESymbolKind.Class,
        sourceFile: ctx.sourceFile,
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
        parent: "MyNamespace",
      });

      expect(ctx.symbols).toHaveLength(2);
      expect(ctx.symbols[1].parent).toBe("MyNamespace");
    });

    it("supports warning collection for reserved field names", () => {
      const ctx = SymbolCollectorContext.create("/path/to/file.h");

      // Simulate warning for reserved field name
      ctx.warnings.push(
        "Warning: C header struct 'MyStruct' has field 'length' which conflicts with C-Next's .length property.",
      );

      expect(ctx.warnings).toHaveLength(1);
      expect(ctx.warnings[0]).toContain("length");
    });

    it("supports symbolTable operations through context", () => {
      const symbolTable = new SymbolTable();
      const ctx = SymbolCollectorContext.create("/path/to/file.h", symbolTable);

      // Simulate adding struct field through symbolTable
      ctx.symbolTable!.addStructField("MyStruct", "x", "int");
      ctx.symbolTable!.addStructField("MyStruct", "y", "int");

      const fields = ctx.symbolTable!.getStructFields("MyStruct");
      expect(fields).toHaveLength(2);
    });
  });
});

/**
 * Helper to create mock symbol for testing
 */
function createMockSymbol(name: string): ISymbol {
  return {
    name,
    kind: ESymbolKind.Function,
    sourceFile: "/path/to/file.h",
    sourceLine: 1,
    sourceLanguage: ESourceLanguage.C,
    isExported: true,
  };
}
