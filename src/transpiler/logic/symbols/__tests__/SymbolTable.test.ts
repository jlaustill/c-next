/**
 * Unit tests for SymbolTable
 * Issue #221: Function parameters should not cause conflicts
 * ADR-055 Phase 5: TSymbol storage and query methods
 */
import { describe, it, expect, beforeEach } from "vitest";
import SymbolTable from "../SymbolTable";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ISymbol from "../../../../utils/types/ISymbol";
import TSymbol from "../../../types/symbols/TSymbol";
import IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import IStructSymbol from "../../../types/symbols/IStructSymbol";
import IEnumSymbol from "../../../types/symbols/IEnumSymbol";
import TestScopeUtils from "../cnext/__tests__/testUtils";
import TTypeUtils from "../../../../utils/TTypeUtils";

describe("SymbolTable", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  // ========================================================================
  // Basic Symbol Operations
  // ========================================================================

  describe("addSymbol and getSymbol", () => {
    it("should add and retrieve a symbol by name", () => {
      const symbol: ISymbol = {
        name: "myVar",
        kind: "variable",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      };

      symbolTable.addSymbol(symbol);
      const retrieved = symbolTable.getSymbol("myVar");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("myVar");
      expect(retrieved?.kind).toBe("variable");
    });

    it("should return undefined for non-existent symbol", () => {
      const retrieved = symbolTable.getSymbol("nonExistent");
      expect(retrieved).toBeUndefined();
    });

    it("should return first symbol when multiple exist with same name", () => {
      symbolTable.addSymbol({
        name: "duplicate",
        kind: "variable",
        sourceFile: "first.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "duplicate",
        kind: "variable",
        sourceFile: "second.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      const retrieved = symbolTable.getSymbol("duplicate");
      expect(retrieved?.sourceFile).toBe("first.cnx");
    });
  });

  describe("addSymbols", () => {
    it("should add multiple symbols at once", () => {
      const symbols: ISymbol[] = [
        {
          name: "var1",
          kind: "variable",
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        },
        {
          name: "var2",
          kind: "variable",
          sourceFile: "test.cnx",
          sourceLine: 2,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        },
        {
          name: "func1",
          kind: "function",
          sourceFile: "test.cnx",
          sourceLine: 3,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        },
      ];

      symbolTable.addSymbols(symbols);

      expect(symbolTable.getSymbol("var1")).toBeDefined();
      expect(symbolTable.getSymbol("var2")).toBeDefined();
      expect(symbolTable.getSymbol("func1")).toBeDefined();
      expect(symbolTable.size).toBe(3);
    });
  });

  describe("hasSymbol", () => {
    it("should return true for existing symbol", () => {
      symbolTable.addSymbol({
        name: "exists",
        kind: "variable",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      expect(symbolTable.hasSymbol("exists")).toBe(true);
    });

    it("should return false for non-existent symbol", () => {
      expect(symbolTable.hasSymbol("notHere")).toBe(false);
    });
  });

  describe("getOverloads", () => {
    it("should return all symbols with same name", () => {
      symbolTable.addSymbol({
        name: "overloaded",
        kind: "function",
        signature: "int(int)",
        sourceFile: "test.cpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "overloaded",
        kind: "function",
        signature: "int(int, int)",
        sourceFile: "test.cpp",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      });

      const overloads = symbolTable.getOverloads("overloaded");
      expect(overloads.length).toBe(2);
      expect(overloads[0].signature).toBe("int(int)");
      expect(overloads[1].signature).toBe("int(int, int)");
    });

    it("should return empty array for non-existent symbol", () => {
      const overloads = symbolTable.getOverloads("noSuchFunction");
      expect(overloads).toEqual([]);
    });
  });

  describe("getAllSymbols", () => {
    it("should return all symbols in the table", () => {
      symbolTable.addSymbol({
        name: "a",
        kind: "variable",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "b",
        kind: "function",
        sourceFile: "test.cnx",
        sourceLine: 2,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      const all = symbolTable.getAllSymbols();
      expect(all.length).toBe(2);
      expect(all.map((s) => s.name).sort()).toEqual(["a", "b"]);
    });

    it("should return empty array for empty table", () => {
      expect(symbolTable.getAllSymbols()).toEqual([]);
    });
  });

  describe("size", () => {
    it("should return 0 for empty table", () => {
      expect(symbolTable.size).toBe(0);
    });

    it("should return correct count including duplicates", () => {
      symbolTable.addSymbol({
        name: "sym1",
        kind: "variable",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "sym1",
        kind: "variable",
        sourceFile: "test2.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "sym2",
        kind: "function",
        sourceFile: "test.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      expect(symbolTable.size).toBe(3);
    });
  });

  describe("clear", () => {
    it("should remove all symbols", () => {
      symbolTable.addSymbol({
        name: "toBeCleared",
        kind: "variable",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addStructField("MyStruct", "field1", "uint32_t");
      symbolTable.markNeedsStructKeyword("CStruct");
      symbolTable.addEnumBitWidth("MyEnum", 8);

      symbolTable.clear();

      expect(symbolTable.size).toBe(0);
      expect(symbolTable.getSymbol("toBeCleared")).toBeUndefined();
      expect(
        symbolTable.getStructFieldType("MyStruct", "field1"),
      ).toBeUndefined();
      expect(symbolTable.checkNeedsStructKeyword("CStruct")).toBe(false);
      expect(symbolTable.getEnumBitWidth("MyEnum")).toBeUndefined();
    });
  });

  // ========================================================================
  // File-based and Language-based Queries
  // ========================================================================

  describe("getSymbolsByFile", () => {
    it("should return symbols from a specific file", () => {
      symbolTable.addSymbol({
        name: "inFile1",
        kind: "variable",
        sourceFile: "file1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "alsoInFile1",
        kind: "function",
        sourceFile: "file1.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "inFile2",
        kind: "variable",
        sourceFile: "file2.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      const file1Symbols = symbolTable.getSymbolsByFile("file1.cnx");
      expect(file1Symbols.length).toBe(2);
      expect(file1Symbols.map((s) => s.name).sort()).toEqual([
        "alsoInFile1",
        "inFile1",
      ]);
    });

    it("should return empty array for unknown file", () => {
      expect(symbolTable.getSymbolsByFile("unknown.cnx")).toEqual([]);
    });
  });

  describe("getSymbolsByLanguage", () => {
    it("should return symbols from a specific language", () => {
      symbolTable.addSymbol({
        name: "cnextVar",
        kind: "variable",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "cVar",
        kind: "variable",
        sourceFile: "test.c",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "cppVar",
        kind: "variable",
        sourceFile: "test.cpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      });

      const cnextSymbols = symbolTable.getSymbolsByLanguage(
        ESourceLanguage.CNext,
      );
      expect(cnextSymbols.length).toBe(1);
      expect(cnextSymbols[0].name).toBe("cnextVar");

      const cSymbols = symbolTable.getSymbolsByLanguage(ESourceLanguage.C);
      expect(cSymbols.length).toBe(1);
      expect(cSymbols[0].name).toBe("cVar");
    });

    it("should return empty array when no symbols match language", () => {
      symbolTable.addSymbol({
        name: "cnextOnly",
        kind: "variable",
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      expect(symbolTable.getSymbolsByLanguage(ESourceLanguage.C)).toEqual([]);
    });
  });

  // ========================================================================
  // Struct Field Operations
  // ========================================================================

  describe("struct field operations", () => {
    it("should add and retrieve struct field type", () => {
      symbolTable.addStructField("Point", "x", "int32_t");
      symbolTable.addStructField("Point", "y", "int32_t");

      expect(symbolTable.getStructFieldType("Point", "x")).toBe("int32_t");
      expect(symbolTable.getStructFieldType("Point", "y")).toBe("int32_t");
    });

    it("should return undefined for unknown struct or field", () => {
      symbolTable.addStructField("Point", "x", "int32_t");

      expect(symbolTable.getStructFieldType("Unknown", "x")).toBeUndefined();
      expect(symbolTable.getStructFieldType("Point", "z")).toBeUndefined();
    });

    it("should add struct field with array dimensions", () => {
      symbolTable.addStructField("Buffer", "data", "uint8_t", [256]);
      symbolTable.addStructField("Matrix", "values", "float", [4, 4]);

      const bufferField = symbolTable.getStructFieldInfo("Buffer", "data");
      expect(bufferField?.type).toBe("uint8_t");
      expect(bufferField?.arrayDimensions).toEqual([256]);

      const matrixField = symbolTable.getStructFieldInfo("Matrix", "values");
      expect(matrixField?.type).toBe("float");
      expect(matrixField?.arrayDimensions).toEqual([4, 4]);
    });

    it("should get all fields for a struct", () => {
      symbolTable.addStructField("Person", "name", "char*");
      symbolTable.addStructField("Person", "age", "uint8_t");
      symbolTable.addStructField("Person", "id", "uint32_t");

      const fields = symbolTable.getStructFields("Person");
      expect(fields).toBeDefined();
      expect(fields?.size).toBe(3);
      expect(fields?.get("name")?.type).toBe("char*");
      expect(fields?.get("age")?.type).toBe("uint8_t");
    });

    it("should return undefined for unknown struct in getStructFields", () => {
      expect(symbolTable.getStructFields("Unknown")).toBeUndefined();
    });

    it("should get all struct fields for serialization", () => {
      symbolTable.addStructField("A", "x", "int");
      symbolTable.addStructField("B", "y", "float");

      const allFields = symbolTable.getAllStructFields();
      expect(allFields.size).toBe(2);
      expect(allFields.has("A")).toBe(true);
      expect(allFields.has("B")).toBe(true);
    });

    it("should restore struct fields from cache", () => {
      const cached = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const pointFields = new Map();
      pointFields.set("x", { type: "int32_t" });
      pointFields.set("y", { type: "int32_t" });
      cached.set("Point", pointFields);

      symbolTable.restoreStructFields(cached);

      expect(symbolTable.getStructFieldType("Point", "x")).toBe("int32_t");
      expect(symbolTable.getStructFieldType("Point", "y")).toBe("int32_t");
    });

    it("should merge restored struct fields with existing", () => {
      symbolTable.addStructField("Point", "x", "int32_t");

      const cached = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const pointFields = new Map();
      pointFields.set("z", { type: "int32_t" });
      cached.set("Point", pointFields);

      symbolTable.restoreStructFields(cached);

      expect(symbolTable.getStructFieldType("Point", "x")).toBe("int32_t");
      expect(symbolTable.getStructFieldType("Point", "z")).toBe("int32_t");
    });
  });

  describe("getStructNamesByFile", () => {
    it("should return struct names defined in a file", () => {
      // Add a symbol for the struct
      symbolTable.addSymbol({
        name: "Point",
        kind: "struct",
        sourceFile: "geometry.h",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      });

      // Register struct fields (which marks it as having struct data)
      symbolTable.addStructField("Point", "x", "int");
      symbolTable.addStructField("Point", "y", "int");

      const structNames = symbolTable.getStructNamesByFile("geometry.h");
      expect(structNames).toContain("Point");
    });

    it("should return empty array for file with no structs", () => {
      symbolTable.addSymbol({
        name: "someVar",
        kind: "variable",
        sourceFile: "vars.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      expect(symbolTable.getStructNamesByFile("vars.cnx")).toEqual([]);
    });

    it("should return empty array for unknown file", () => {
      expect(symbolTable.getStructNamesByFile("nonexistent.cnx")).toEqual([]);
    });
  });

  // ========================================================================
  // Struct Keyword Tracking (Issue #196)
  // ========================================================================

  describe("struct keyword tracking", () => {
    it("should mark and check if struct needs keyword", () => {
      symbolTable.markNeedsStructKeyword("NamedPoint");

      expect(symbolTable.checkNeedsStructKeyword("NamedPoint")).toBe(true);
      expect(symbolTable.checkNeedsStructKeyword("OtherStruct")).toBe(false);
    });

    it("should get all structs needing keyword", () => {
      symbolTable.markNeedsStructKeyword("Struct1");
      symbolTable.markNeedsStructKeyword("Struct2");
      symbolTable.markNeedsStructKeyword("Struct3");

      const all = symbolTable.getAllNeedsStructKeyword();
      expect(all.length).toBe(3);
      expect(all.sort()).toEqual(["Struct1", "Struct2", "Struct3"]);
    });

    it("should restore struct keyword set from cache", () => {
      symbolTable.restoreNeedsStructKeyword(["CachedStruct1", "CachedStruct2"]);

      expect(symbolTable.checkNeedsStructKeyword("CachedStruct1")).toBe(true);
      expect(symbolTable.checkNeedsStructKeyword("CachedStruct2")).toBe(true);
      expect(symbolTable.checkNeedsStructKeyword("NotCached")).toBe(false);
    });
  });

  // ========================================================================
  // Enum Bit Width Tracking (Issue #208)
  // ========================================================================

  describe("enum bit width tracking", () => {
    it("should add and get enum bit width", () => {
      symbolTable.addEnumBitWidth("EPressureType", 8);
      symbolTable.addEnumBitWidth("ELargeEnum", 32);

      expect(symbolTable.getEnumBitWidth("EPressureType")).toBe(8);
      expect(symbolTable.getEnumBitWidth("ELargeEnum")).toBe(32);
    });

    it("should return undefined for unknown enum", () => {
      expect(symbolTable.getEnumBitWidth("UnknownEnum")).toBeUndefined();
    });

    it("should get all enum bit widths for serialization", () => {
      symbolTable.addEnumBitWidth("Enum8", 8);
      symbolTable.addEnumBitWidth("Enum16", 16);

      const allWidths = symbolTable.getAllEnumBitWidths();
      expect(allWidths.size).toBe(2);
      expect(allWidths.get("Enum8")).toBe(8);
      expect(allWidths.get("Enum16")).toBe(16);
    });

    it("should restore enum bit widths from cache", () => {
      const cached = new Map<string, number>();
      cached.set("CachedEnum1", 8);
      cached.set("CachedEnum2", 16);

      symbolTable.restoreEnumBitWidths(cached);

      expect(symbolTable.getEnumBitWidth("CachedEnum1")).toBe(8);
      expect(symbolTable.getEnumBitWidth("CachedEnum2")).toBe(16);
    });
  });

  // ========================================================================
  // hasConflict Method
  // ========================================================================

  describe("hasConflict", () => {
    it("should return true when symbol has conflicts", () => {
      symbolTable.addSymbol({
        name: "conflicted",
        kind: "variable",
        sourceFile: "file1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "conflicted",
        kind: "variable",
        sourceFile: "file2.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      expect(symbolTable.hasConflict("conflicted")).toBe(true);
    });

    it("should return false when symbol has no conflicts", () => {
      symbolTable.addSymbol({
        name: "unique",
        kind: "variable",
        sourceFile: "file1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      expect(symbolTable.hasConflict("unique")).toBe(false);
    });

    it("should return false for non-existent symbol", () => {
      expect(symbolTable.hasConflict("doesNotExist")).toBe(false);
    });
  });

  // ========================================================================
  // Conflict Detection (existing tests)
  // ========================================================================

  describe("conflict detection", () => {
    it("should detect conflicts between two global variables with same name", () => {
      // Two global variables with same name = conflict
      symbolTable.addSymbol({
        name: "counter",
        kind: "variable",
        sourceFile: "file1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "counter",
        kind: "variable",
        sourceFile: "file2.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].symbolName).toBe("counter");
    });

    it("should NOT detect conflicts between function parameters with same name (Issue #221)", () => {
      // This is the bug: parameters 'x' in different functions should NOT conflict

      // Add function Math_add
      symbolTable.addSymbol({
        name: "Math_add",
        kind: "function",
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      // Add parameter 'x' for Math_add
      symbolTable.addSymbol({
        name: "x",
        kind: "variable",
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        parent: "Math_add", // Parent is the function
        isExported: false,
      });

      // Add parameter 'y' for Math_add
      symbolTable.addSymbol({
        name: "y",
        kind: "variable",
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        parent: "Math_add",
        isExported: false,
      });

      // Add function Math_multiply
      symbolTable.addSymbol({
        name: "Math_multiply",
        kind: "function",
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      // Add parameter 'x' for Math_multiply - same name as Math_add's x
      symbolTable.addSymbol({
        name: "x",
        kind: "variable",
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        parent: "Math_multiply", // Different parent function
        isExported: false,
      });

      // Add parameter 'y' for Math_multiply
      symbolTable.addSymbol({
        name: "y",
        kind: "variable",
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        parent: "Math_multiply",
        isExported: false,
      });

      // There should be NO conflicts - parameters are scoped to their functions
      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(0);
    });

    it("should still detect conflicts for scope-level variables with same qualified name", () => {
      // Two scope-level variables with same qualified name = conflict
      symbolTable.addSymbol({
        name: "Math_counter",
        kind: "variable",
        sourceFile: "file1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      symbolTable.addSymbol({
        name: "Math_counter",
        kind: "variable",
        sourceFile: "file2.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].symbolName).toBe("Math_counter");
    });

    it("should not conflict when a global function and scope function have same parameter names", () => {
      // Global function 'divide' with parameter 'x'
      symbolTable.addSymbol({
        name: "divide",
        kind: "function",
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "x",
        kind: "variable",
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        parent: "divide",
        isExported: false,
      });

      // Scope function 'Math_add' with parameter 'x'
      symbolTable.addSymbol({
        name: "Math_add",
        kind: "function",
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      symbolTable.addSymbol({
        name: "x",
        kind: "variable",
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        parent: "Math_add",
        isExported: false,
      });

      // No conflicts - both 'x' are function parameters with different parents
      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(0);
    });

    it("should detect cross-language conflict between C-Next and C", () => {
      // Same symbol in C-Next and C = ERROR
      symbolTable.addSymbol({
        name: "sharedVar",
        kind: "variable",
        sourceFile: "module.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "sharedVar",
        kind: "variable",
        sourceFile: "legacy.c",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      });

      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].symbolName).toBe("sharedVar");
      expect(conflicts[0].severity).toBe("error");
      expect(conflicts[0].message).toContain("defined in multiple languages");
    });

    it("should detect cross-language conflict between C-Next and C++", () => {
      // Same symbol in C-Next and C++ = ERROR
      symbolTable.addSymbol({
        name: "sharedFunc",
        kind: "function",
        sourceFile: "module.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "sharedFunc",
        kind: "function",
        sourceFile: "driver.cpp",
        sourceLine: 20,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      });

      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].symbolName).toBe("sharedFunc");
      expect(conflicts[0].severity).toBe("error");
    });

    it("should allow same symbol in C and C++ (common pattern)", () => {
      // Same symbol in C and C++ is typically OK (e.g., header included by both)
      symbolTable.addSymbol({
        name: "commonSymbol",
        kind: "variable",
        sourceFile: "shared.c",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "commonSymbol",
        kind: "variable",
        sourceFile: "wrapper.cpp",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      });

      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(0);
    });

    it("should allow C++ function overloads with different signatures", () => {
      symbolTable.addSymbol({
        name: "process",
        kind: "function",
        signature: "void(int)",
        sourceFile: "utils.cpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "process",
        kind: "function",
        signature: "void(int, int)",
        sourceFile: "utils.cpp",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "process",
        kind: "function",
        signature: "void(float)",
        sourceFile: "utils.cpp",
        sourceLine: 20,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      });

      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(0);
    });

    it("should not count extern declarations as conflicts", () => {
      // extern declarations are not definitions
      symbolTable.addSymbol({
        name: "externVar",
        kind: "variable",
        sourceFile: "header.h",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        isDeclaration: true, // extern declaration
      });

      symbolTable.addSymbol({
        name: "externVar",
        kind: "variable",
        sourceFile: "impl.c",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        isDeclaration: false, // actual definition
      });

      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(0);
    });

    it("should detect conflicts for scope functions with same qualified name", () => {
      // Two scope functions (non-variable with parent) with same name = conflict
      symbolTable.addSymbol({
        name: "Math_calculate",
        kind: "function",
        type: "i32",
        sourceFile: "math1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      symbolTable.addSymbol({
        name: "Math_calculate",
        kind: "function",
        type: "i32",
        sourceFile: "math2.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].symbolName).toBe("Math_calculate");
    });

    it("should allow multiple C definitions (fallback case)", () => {
      // Multiple C definitions - no conflict detection for C-only (handled by C compiler)
      symbolTable.addSymbol({
        name: "cOnlyVar",
        kind: "variable",
        sourceFile: "file1.c",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "cOnlyVar",
        kind: "variable",
        sourceFile: "file2.c",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      });

      // C-only conflicts are left to the C compiler to detect
      const conflicts = symbolTable.getConflicts();
      expect(conflicts.length).toBe(0);
    });
  });

  // ========================================================================
  // ADR-055 Phase 5: TSymbol Storage and Query Methods
  // ========================================================================

  describe("TSymbol storage (ADR-055)", () => {
    const globalScope = TestScopeUtils.createMockGlobalScope();

    it("should add and retrieve a TSymbol by name", () => {
      const tSymbol: IVariableSymbol = {
        kind: "variable",
        name: "myTVar",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      };

      symbolTable.addTSymbol(tSymbol);
      const retrieved = symbolTable.getTSymbol("myTVar");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("myTVar");
      expect(retrieved?.kind).toBe("variable");
    });

    it("should return undefined for non-existent TSymbol", () => {
      expect(symbolTable.getTSymbol("nonExistent")).toBeUndefined();
    });

    it("should add multiple TSymbols at once", () => {
      const tSymbols: TSymbol[] = [
        {
          kind: "variable",
          name: "tVar1",
          scope: globalScope,
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          type: TTypeUtils.createPrimitive("u32"),
          isConst: false,
          isAtomic: false,
          isArray: false,
        },
        {
          kind: "variable",
          name: "tVar2",
          scope: globalScope,
          sourceFile: "test.cnx",
          sourceLine: 2,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
          type: TTypeUtils.createPrimitive("i32"),
          isConst: true,
          isAtomic: false,
          isArray: false,
        },
      ];

      symbolTable.addTSymbols(tSymbols);

      expect(symbolTable.getTSymbol("tVar1")).toBeDefined();
      expect(symbolTable.getTSymbol("tVar2")).toBeDefined();
      expect(symbolTable.getTSize()).toBe(2);
    });

    it("should get TOverloads for same name", () => {
      const func1: IFunctionSymbol = {
        kind: "function",
        name: "process",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
      };

      const func2: IFunctionSymbol = {
        kind: "function",
        name: "process",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parameters: [
          {
            name: "x",
            type: TTypeUtils.createPrimitive("i32"),
            isConst: false,
            isArray: false,
          },
        ],
        returnType: TTypeUtils.createPrimitive("i32"),
        visibility: "public",
        body: null,
      };

      symbolTable.addTSymbol(func1);
      symbolTable.addTSymbol(func2);

      const overloads = symbolTable.getTOverloads("process");
      expect(overloads.length).toBe(2);
    });

    it("should get TSymbols by file", () => {
      const var1: IVariableSymbol = {
        kind: "variable",
        name: "fileVar1",
        scope: globalScope,
        sourceFile: "file1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      };

      const var2: IVariableSymbol = {
        kind: "variable",
        name: "fileVar2",
        scope: globalScope,
        sourceFile: "file2.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("i32"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      };

      symbolTable.addTSymbol(var1);
      symbolTable.addTSymbol(var2);

      const file1Symbols = symbolTable.getTSymbolsByFile("file1.cnx");
      expect(file1Symbols.length).toBe(1);
      expect(file1Symbols[0].name).toBe("fileVar1");
    });

    it("should get all TSymbols", () => {
      symbolTable.addTSymbol({
        kind: "variable",
        name: "allVar1",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      });

      symbolTable.addTSymbol({
        kind: "variable",
        name: "allVar2",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 2,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("i32"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      });

      const all = symbolTable.getAllTSymbols();
      expect(all.length).toBe(2);
    });

    it("should check hasTSymbol", () => {
      symbolTable.addTSymbol({
        kind: "variable",
        name: "existsVar",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      });

      expect(symbolTable.hasTSymbol("existsVar")).toBe(true);
      expect(symbolTable.hasTSymbol("notExists")).toBe(false);
    });

    it("should clear TSymbols along with ISymbols", () => {
      symbolTable.addTSymbol({
        kind: "variable",
        name: "toBeCleared",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      });

      symbolTable.clear();

      expect(symbolTable.getTSize()).toBe(0);
      expect(symbolTable.getTSymbol("toBeCleared")).toBeUndefined();
    });
  });

  describe("type-safe TSymbol queries (ADR-055)", () => {
    const globalScope = TestScopeUtils.createMockGlobalScope();

    it("should get struct symbols only", () => {
      const struct: IStructSymbol = {
        kind: "struct",
        name: "Point",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "x",
            {
              name: "x",
              type: TTypeUtils.createPrimitive("i32"),
              isConst: false,
              isAtomic: false,
              isArray: false,
            },
          ],
        ]),
      };

      const variable: IVariableSymbol = {
        kind: "variable",
        name: "count",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      };

      symbolTable.addTSymbols([struct, variable]);

      const structs = symbolTable.getStructSymbols();
      expect(structs.length).toBe(1);
      expect(structs[0].name).toBe("Point");
      expect(structs[0].kind).toBe("struct");
    });

    it("should get enum symbols only", () => {
      const enumSym: IEnumSymbol = {
        kind: "enum",
        name: "EColor",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        members: new Map([
          ["RED", 0],
          ["GREEN", 1],
          ["BLUE", 2],
        ]),
      };

      const variable: IVariableSymbol = {
        kind: "variable",
        name: "color",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createEnum("EColor"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      };

      symbolTable.addTSymbols([enumSym, variable]);

      const enums = symbolTable.getEnumSymbols();
      expect(enums.length).toBe(1);
      expect(enums[0].name).toBe("EColor");
      expect(enums[0].members.get("RED")).toBe(0);
    });

    it("should get function symbols only", () => {
      const func: IFunctionSymbol = {
        kind: "function",
        name: "calculate",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("i32"),
        visibility: "public",
        body: null,
      };

      const variable: IVariableSymbol = {
        kind: "variable",
        name: "result",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("i32"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      };

      symbolTable.addTSymbols([func, variable]);

      const functions = symbolTable.getFunctionSymbols();
      expect(functions.length).toBe(1);
      expect(functions[0].name).toBe("calculate");
    });

    it("should get variable symbols only", () => {
      const func: IFunctionSymbol = {
        kind: "function",
        name: "init",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        body: null,
      };

      const variable: IVariableSymbol = {
        kind: "variable",
        name: "counter",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        type: TTypeUtils.createPrimitive("u32"),
        isConst: false,
        isAtomic: false,
        isArray: false,
      };

      symbolTable.addTSymbols([func, variable]);

      const variables = symbolTable.getVariableSymbols();
      expect(variables.length).toBe(1);
      expect(variables[0].name).toBe("counter");
    });
  });

  describe("getTStructFieldType (ADR-055)", () => {
    const globalScope = TestScopeUtils.createMockGlobalScope();

    it("should get struct field type from TSymbol storage", () => {
      const struct: IStructSymbol = {
        kind: "struct",
        name: "Point",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "x",
            {
              name: "x",
              type: TTypeUtils.createPrimitive("i32"),
              isConst: false,
              isAtomic: false,
              isArray: false,
            },
          ],
          [
            "y",
            {
              name: "y",
              type: TTypeUtils.createPrimitive("f32"),
              isConst: false,
              isAtomic: false,
              isArray: false,
            },
          ],
        ]),
      };

      symbolTable.addTSymbol(struct);

      expect(symbolTable.getTStructFieldType("Point", "x")).toBe("i32");
      expect(symbolTable.getTStructFieldType("Point", "y")).toBe("f32");
    });

    it("should return undefined for unknown struct", () => {
      expect(
        symbolTable.getTStructFieldType("NonExistent", "field"),
      ).toBeUndefined();
    });

    it("should return undefined for unknown field", () => {
      const struct: IStructSymbol = {
        kind: "struct",
        name: "MyStruct",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "knownField",
            {
              name: "knownField",
              type: TTypeUtils.createPrimitive("u32"),
              isConst: false,
              isAtomic: false,
              isArray: false,
            },
          ],
        ]),
      };

      symbolTable.addTSymbol(struct);

      expect(
        symbolTable.getTStructFieldType("MyStruct", "unknownField"),
      ).toBeUndefined();
    });

    it("should handle struct with string type field", () => {
      const struct: IStructSymbol = {
        kind: "struct",
        name: "Person",
        scope: globalScope,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        fields: new Map([
          [
            "name",
            {
              name: "name",
              type: TTypeUtils.createString(32),
              isConst: false,
              isAtomic: false,
              isArray: false,
            },
          ],
        ]),
      };

      symbolTable.addTSymbol(struct);

      expect(symbolTable.getTStructFieldType("Person", "name")).toBe(
        "string<32>",
      );
    });
  });
});
