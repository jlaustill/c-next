/**
 * Unit tests for SymbolTable
 * Issue #221: Function parameters should not cause conflicts
 * ADR-055 Phase 7: Fully typed symbol storage using TSymbol, TCSymbol, TCppSymbol
 */
import { describe, it, expect, beforeEach } from "vitest";
import SymbolTable from "../SymbolTable";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import TSymbol from "../../../types/symbols/TSymbol";
import IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import IStructSymbol from "../../../types/symbols/IStructSymbol";
import IEnumSymbol from "../../../types/symbols/IEnumSymbol";
import TestScopeUtils from "../cnext/__tests__/testUtils";
import TTypeUtils from "../../../../utils/TTypeUtils";
import TCSymbol from "../../../types/symbols/c/TCSymbol";
import TCppSymbol from "../../../types/symbols/cpp/TCppSymbol";

describe("SymbolTable", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  // ========================================================================
  // TSymbol (C-Next) Operations
  // ========================================================================

  describe("addTSymbol and getTSymbol", () => {
    it("should add and retrieve a TSymbol by name", () => {
      const symbol: IVariableSymbol = {
        kind: "variable",
        name: "myVar",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        scope: TestScopeUtils.createMockGlobalScope(),
      };

      symbolTable.addTSymbol(symbol);
      const retrieved = symbolTable.getTSymbol("myVar");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("myVar");
      expect(retrieved?.kind).toBe("variable");
    });

    it("should return undefined for non-existent symbol", () => {
      const retrieved = symbolTable.getTSymbol("nonExistent");
      expect(retrieved).toBeUndefined();
    });

    it("should return first symbol when multiple exist with same name", () => {
      symbolTable.addTSymbol({
        kind: "variable",
        name: "duplicate",
        sourceFile: "first.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        scope: TestScopeUtils.createMockGlobalScope(),
      });

      symbolTable.addTSymbol({
        kind: "variable",
        name: "duplicate",
        sourceFile: "second.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        scope: TestScopeUtils.createMockGlobalScope(),
      });

      const retrieved = symbolTable.getTSymbol("duplicate");
      expect(retrieved?.sourceFile).toBe("first.cnx");
    });
  });

  describe("addTSymbols", () => {
    it("should add multiple TSymbols at once", () => {
      const symbols: TSymbol[] = [
        {
          kind: "variable",
          name: "var1",
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          type: TTypeUtils.createPrimitive("u32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          scope: TestScopeUtils.createMockGlobalScope(),
        },
        {
          kind: "variable",
          name: "var2",
          sourceFile: "test.cnx",
          sourceLine: 2,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          type: TTypeUtils.createPrimitive("i32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          scope: TestScopeUtils.createMockGlobalScope(),
        },
      ];

      symbolTable.addTSymbols(symbols);

      expect(symbolTable.getTSymbol("var1")).toBeDefined();
      expect(symbolTable.getTSymbol("var2")).toBeDefined();
    });
  });

  // ========================================================================
  // TCSymbol (C) Operations
  // ========================================================================

  describe("addCSymbol and getCSymbol", () => {
    it("should add and retrieve a C symbol", () => {
      const symbol: TCSymbol = {
        kind: "function",
        name: "c_function",
        sourceFile: "test.h",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        type: "int",
        parameters: [
          { name: "x", type: "int", isConst: false, isArray: false },
        ],
      };

      symbolTable.addCSymbol(symbol);
      const retrieved = symbolTable.getCSymbol("c_function");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("c_function");
      expect(retrieved?.kind).toBe("function");
      expect(retrieved?.sourceLanguage).toBe(ESourceLanguage.C);
    });
  });

  // ========================================================================
  // TCppSymbol (C++) Operations
  // ========================================================================

  describe("addCppSymbol and getCppSymbol", () => {
    it("should add and retrieve a C++ symbol", () => {
      const symbol: TCppSymbol = {
        kind: "class",
        name: "MyClass",
        sourceFile: "test.hpp",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      };

      symbolTable.addCppSymbol(symbol);
      const retrieved = symbolTable.getCppSymbol("MyClass");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("MyClass");
      expect(retrieved?.kind).toBe("class");
      expect(retrieved?.sourceLanguage).toBe(ESourceLanguage.Cpp);
    });
  });

  // ========================================================================
  // Cross-Language Operations
  // ========================================================================

  describe("getAllSymbols", () => {
    it("should return symbols from all languages", () => {
      symbolTable.addTSymbol({
        kind: "variable",
        name: "cnextVar",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        scope: TestScopeUtils.createMockGlobalScope(),
      });

      symbolTable.addCSymbol({
        kind: "variable",
        name: "cVar",
        sourceFile: "test.h",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        type: "int",
      });

      symbolTable.addCppSymbol({
        kind: "variable",
        name: "cppVar",
        sourceFile: "test.hpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
        type: "int",
      });

      const all = symbolTable.getAllSymbols();
      expect(all.length).toBe(3);
    });
  });

  describe("getOverloads", () => {
    it("should return overloads from all languages", () => {
      symbolTable.addTSymbol({
        kind: "function",
        name: "process",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        returnType: TTypeUtils.createPrimitive("void"),
        parameters: [],
        scope: TestScopeUtils.createMockGlobalScope(),
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      symbolTable.addCppSymbol({
        kind: "function",
        name: "process",
        sourceFile: "test.hpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
        type: "void",
        parameters: [
          { name: "x", type: "int", isConst: false, isArray: false },
        ],
      });

      const overloads = symbolTable.getOverloads("process");
      expect(overloads.length).toBe(2);
    });
  });

  // ========================================================================
  // Conflict Detection
  // ========================================================================

  describe("hasConflict", () => {
    it("should detect cross-language conflicts between C-Next and C", () => {
      symbolTable.addTSymbol({
        kind: "function",
        name: "conflictFunc",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        returnType: TTypeUtils.createPrimitive("void"),
        parameters: [],
        scope: TestScopeUtils.createMockGlobalScope(),
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      symbolTable.addCSymbol({
        kind: "function",
        name: "conflictFunc",
        sourceFile: "test.h",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        type: "void",
        parameters: [],
      });

      expect(symbolTable.hasConflict("conflictFunc")).toBe(true);
    });

    it("should not detect conflict for C++ function overloads with different signatures", () => {
      symbolTable.addCppSymbol({
        kind: "function",
        name: "overloaded",
        sourceFile: "test.hpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
        type: "void",
        parameters: [],
      });

      symbolTable.addCppSymbol({
        kind: "function",
        name: "overloaded",
        sourceFile: "test.hpp",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
        type: "void",
        parameters: [
          { name: "x", type: "int", isConst: false, isArray: false },
        ],
      });

      expect(symbolTable.hasConflict("overloaded")).toBe(false);
    });

    // Issue #817: Scope-private members should NOT conflict across scopes
    it("should NOT detect conflict for same-named members in different scopes", () => {
      // Create two different named scopes
      const globalScope = TestScopeUtils.createMockGlobalScope();
      const fooScope = TestScopeUtils.createMockScope("Foo", globalScope);
      const barScope = TestScopeUtils.createMockScope("Bar", globalScope);

      // Add 'enabled' variable in scope Foo
      symbolTable.addTSymbol({
        kind: "variable",
        name: "enabled",
        sourceFile: "test.cnx",
        sourceLine: 2,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: false,
        type: TTypeUtils.createPrimitive("bool"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        scope: fooScope,
      });

      // Add 'enabled' variable in scope Bar
      symbolTable.addTSymbol({
        kind: "variable",
        name: "enabled",
        sourceFile: "test.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: false,
        type: TTypeUtils.createPrimitive("bool"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        scope: barScope,
      });

      // These are NOT conflicts - they generate Foo_enabled and Bar_enabled
      expect(symbolTable.hasConflict("enabled")).toBe(false);
    });

    // Issue #817: Same-named functions in different scopes are not conflicts
    it("should NOT detect conflict for same-named functions in different scopes", () => {
      const globalScope = TestScopeUtils.createMockGlobalScope();
      const fooScope = TestScopeUtils.createMockScope("Foo", globalScope);
      const barScope = TestScopeUtils.createMockScope("Bar", globalScope);

      // Add 'initialize' function in scope Foo
      symbolTable.addTSymbol({
        kind: "function",
        name: "initialize",
        sourceFile: "test.cnx",
        sourceLine: 4,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        returnType: TTypeUtils.createPrimitive("void"),
        parameters: [],
        scope: fooScope,
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      // Add 'initialize' function in scope Bar
      symbolTable.addTSymbol({
        kind: "function",
        name: "initialize",
        sourceFile: "test.cnx",
        sourceLine: 12,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        returnType: TTypeUtils.createPrimitive("void"),
        parameters: [],
        scope: barScope,
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      // These generate Foo_initialize and Bar_initialize - no conflict
      expect(symbolTable.hasConflict("initialize")).toBe(false);
    });

    // True conflicts: same name in same scope should still be detected
    it("should detect conflict for same-named symbols in same scope", () => {
      const globalScope = TestScopeUtils.createMockGlobalScope();
      const fooScope = TestScopeUtils.createMockScope("Foo", globalScope);

      // Add 'duplicate' variable in scope Foo twice
      symbolTable.addTSymbol({
        kind: "variable",
        name: "duplicate",
        sourceFile: "test.cnx",
        sourceLine: 2,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: false,
        type: TTypeUtils.createPrimitive("bool"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        scope: fooScope,
      });

      symbolTable.addTSymbol({
        kind: "variable",
        name: "duplicate",
        sourceFile: "test.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: false,
        type: TTypeUtils.createPrimitive("bool"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        scope: fooScope,
      });

      // Same name in SAME scope IS a conflict
      expect(symbolTable.hasConflict("duplicate")).toBe(true);
    });

    // Global scope conflicts should still be detected
    it("should detect conflict for same-named globals", () => {
      const globalScope = TestScopeUtils.createMockGlobalScope();

      // Add two global variables with same name
      symbolTable.addTSymbol({
        kind: "variable",
        name: "globalVar",
        sourceFile: "first.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        scope: globalScope,
      });

      symbolTable.addTSymbol({
        kind: "variable",
        name: "globalVar",
        sourceFile: "second.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        scope: globalScope,
      });

      // Two globals with same name IS a conflict
      expect(symbolTable.hasConflict("globalVar")).toBe(true);
    });
  });

  // ========================================================================
  // Type-Safe Symbol Queries
  // ========================================================================

  describe("type-safe queries", () => {
    it("getStructSymbols should return only struct symbols", () => {
      symbolTable.addTSymbol({
        kind: "struct",
        name: "MyStruct",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map(),
        scope: TestScopeUtils.createMockGlobalScope(),
      } as IStructSymbol);

      symbolTable.addTSymbol({
        kind: "variable",
        name: "myVar",
        sourceFile: "test.cnx",
        sourceLine: 2,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        scope: TestScopeUtils.createMockGlobalScope(),
      });

      const structs = symbolTable.getStructSymbols();
      expect(structs.length).toBe(1);
      expect(structs[0].name).toBe("MyStruct");
    });

    it("getEnumSymbols should return only enum symbols", () => {
      symbolTable.addTSymbol({
        kind: "enum",
        name: "MyEnum",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        members: new Map([["VALUE1", 0]]),
        scope: TestScopeUtils.createMockGlobalScope(),
      } as IEnumSymbol);

      const enums = symbolTable.getEnumSymbols();
      expect(enums.length).toBe(1);
      expect(enums[0].name).toBe("MyEnum");
    });

    it("getFunctionSymbols should return only function symbols", () => {
      symbolTable.addTSymbol({
        kind: "function",
        name: "myFunc",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        returnType: TTypeUtils.createPrimitive("void"),
        parameters: [],
        scope: TestScopeUtils.createMockGlobalScope(),
        visibility: "public",
        body: null,
      } as IFunctionSymbol);

      const functions = symbolTable.getFunctionSymbols();
      expect(functions.length).toBe(1);
      expect(functions[0].name).toBe("myFunc");
    });
  });

  // ========================================================================
  // Struct Field Information
  // ========================================================================

  describe("struct fields", () => {
    it("should add and retrieve struct field information", () => {
      symbolTable.addStructField("Point", "x", "int");
      symbolTable.addStructField("Point", "y", "int");

      expect(symbolTable.getStructFieldType("Point", "x")).toBe("int");
      expect(symbolTable.getStructFieldType("Point", "y")).toBe("int");
    });

    it("should return undefined for non-existent struct or field", () => {
      expect(
        symbolTable.getStructFieldType("NonExistent", "x"),
      ).toBeUndefined();
    });

    it("should get all fields for a struct", () => {
      symbolTable.addStructField("Point", "x", "int");
      symbolTable.addStructField("Point", "y", "int");

      const fields = symbolTable.getStructFields("Point");
      expect(fields?.size).toBe(2);
    });
  });

  // ========================================================================
  // Needs Struct Keyword Tracking
  // ========================================================================

  describe("needsStructKeyword", () => {
    it("should track structs requiring struct keyword", () => {
      symbolTable.markNeedsStructKeyword("RawStruct");

      expect(symbolTable.checkNeedsStructKeyword("RawStruct")).toBe(true);
      expect(symbolTable.checkNeedsStructKeyword("OtherStruct")).toBe(false);
    });
  });

  // ========================================================================
  // Enum Bit Width Tracking
  // ========================================================================

  describe("enumBitWidth", () => {
    it("should track enum bit widths", () => {
      symbolTable.addEnumBitWidth("SmallEnum", 8);
      symbolTable.addEnumBitWidth("LargeEnum", 32);

      expect(symbolTable.getEnumBitWidth("SmallEnum")).toBe(8);
      expect(symbolTable.getEnumBitWidth("LargeEnum")).toBe(32);
      expect(symbolTable.getEnumBitWidth("UnknownEnum")).toBeUndefined();
    });
  });

  // ========================================================================
  // Opaque Type Tracking (Issue #948)
  // ========================================================================

  describe("Opaque Type Tracking", () => {
    it("should mark and check opaque types", () => {
      symbolTable.markOpaqueType("widget_t");
      expect(symbolTable.isOpaqueType("widget_t")).toBe(true);
      expect(symbolTable.isOpaqueType("other_t")).toBe(false);
    });

    it("should unmark opaque types when full definition found", () => {
      symbolTable.markOpaqueType("point_t");
      expect(symbolTable.isOpaqueType("point_t")).toBe(true);
      symbolTable.unmarkOpaqueType("point_t");
      expect(symbolTable.isOpaqueType("point_t")).toBe(false);
    });

    it("should get all opaque types", () => {
      symbolTable.markOpaqueType("handle_t");
      symbolTable.markOpaqueType("context_t");
      const all = symbolTable.getAllOpaqueTypes();
      expect(all).toContain("handle_t");
      expect(all).toContain("context_t");
      expect(all).toHaveLength(2);
    });

    it("should clear opaque types on clear()", () => {
      symbolTable.markOpaqueType("widget_t");
      symbolTable.clear();
      expect(symbolTable.isOpaqueType("widget_t")).toBe(false);
    });

    it("should restore opaque types from cache", () => {
      symbolTable.restoreOpaqueTypes(["widget_t", "handle_t"]);
      expect(symbolTable.isOpaqueType("widget_t")).toBe(true);
      expect(symbolTable.isOpaqueType("handle_t")).toBe(true);
      expect(symbolTable.getAllOpaqueTypes()).toHaveLength(2);
    });
  });

  // ========================================================================
  // Clear
  // ========================================================================

  describe("clear", () => {
    it("should clear all symbols", () => {
      symbolTable.addTSymbol({
        kind: "variable",
        name: "test",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        scope: TestScopeUtils.createMockGlobalScope(),
      });

      symbolTable.addStructField("Point", "x", "int");
      symbolTable.markNeedsStructKeyword("RawStruct");
      symbolTable.markOpaqueType("widget_t");
      symbolTable.addEnumBitWidth("SmallEnum", 8);

      symbolTable.clear();

      expect(symbolTable.getAllSymbols().length).toBe(0);
      expect(symbolTable.getStructFieldType("Point", "x")).toBeUndefined();
      expect(symbolTable.checkNeedsStructKeyword("RawStruct")).toBe(false);
      expect(symbolTable.isOpaqueType("widget_t")).toBe(false);
      expect(symbolTable.getEnumBitWidth("SmallEnum")).toBeUndefined();
    });
  });
});
