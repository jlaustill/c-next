/**
 * Unit tests for SymbolTable
 * Issue #221: Function parameters should not cause conflicts
 */
import { describe, it, expect, beforeEach } from "vitest";
import SymbolTable from "../SymbolTable";
import ESymbolKind from "../../../../utils/types/ESymbolKind";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ISymbol from "../../../../utils/types/ISymbol";

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
        kind: ESymbolKind.Variable,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      };

      symbolTable.addSymbol(symbol);
      const retrieved = symbolTable.getSymbol("myVar");

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("myVar");
      expect(retrieved?.kind).toBe(ESymbolKind.Variable);
    });

    it("should return undefined for non-existent symbol", () => {
      const retrieved = symbolTable.getSymbol("nonExistent");
      expect(retrieved).toBeUndefined();
    });

    it("should return first symbol when multiple exist with same name", () => {
      symbolTable.addSymbol({
        name: "duplicate",
        kind: ESymbolKind.Variable,
        sourceFile: "first.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "duplicate",
        kind: ESymbolKind.Variable,
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
          kind: ESymbolKind.Variable,
          sourceFile: "test.cnx",
          sourceLine: 1,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        },
        {
          name: "var2",
          kind: ESymbolKind.Variable,
          sourceFile: "test.cnx",
          sourceLine: 2,
          sourceLanguage: ESourceLanguage.CNext,
          isExported: true,
        },
        {
          name: "func1",
          kind: ESymbolKind.Function,
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
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Function,
        signature: "int(int)",
        sourceFile: "test.cpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "overloaded",
        kind: ESymbolKind.Function,
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
        kind: ESymbolKind.Variable,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "b",
        kind: ESymbolKind.Function,
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
        kind: ESymbolKind.Variable,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "sym1",
        kind: ESymbolKind.Variable,
        sourceFile: "test2.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "sym2",
        kind: ESymbolKind.Function,
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
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Variable,
        sourceFile: "file1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "alsoInFile1",
        kind: ESymbolKind.Function,
        sourceFile: "file1.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "inFile2",
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Variable,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "cVar",
        kind: ESymbolKind.Variable,
        sourceFile: "test.c",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "cppVar",
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Struct,
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
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Variable,
        sourceFile: "file1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "conflicted",
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Variable,
        sourceFile: "file1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "counter",
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Function,
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
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Function,
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
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Variable,
        sourceFile: "file1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      symbolTable.addSymbol({
        name: "Math_counter",
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Function,
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "x",
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Function,
        type: "f32",
        sourceFile: "math.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      symbolTable.addSymbol({
        name: "x",
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Variable,
        sourceFile: "module.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "sharedVar",
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Function,
        sourceFile: "module.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "sharedFunc",
        kind: ESymbolKind.Function,
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
        kind: ESymbolKind.Variable,
        sourceFile: "shared.c",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "commonSymbol",
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Function,
        signature: "void(int)",
        sourceFile: "utils.cpp",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "process",
        kind: ESymbolKind.Function,
        signature: "void(int, int)",
        sourceFile: "utils.cpp",
        sourceLine: 10,
        sourceLanguage: ESourceLanguage.Cpp,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "process",
        kind: ESymbolKind.Function,
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
        kind: ESymbolKind.Variable,
        sourceFile: "header.h",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
        isDeclaration: true, // extern declaration
      });

      symbolTable.addSymbol({
        name: "externVar",
        kind: ESymbolKind.Variable,
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
        kind: ESymbolKind.Function,
        type: "i32",
        sourceFile: "math1.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "Math",
      });

      symbolTable.addSymbol({
        name: "Math_calculate",
        kind: ESymbolKind.Function,
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
        kind: ESymbolKind.Variable,
        sourceFile: "file1.c",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        isExported: true,
      });

      symbolTable.addSymbol({
        name: "cOnlyVar",
        kind: ESymbolKind.Variable,
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
  // resolveExternalEnumArrayDimensions
  // ========================================================================

  describe("resolveExternalEnumArrayDimensions", () => {
    it("resolves cross-file enum member in variable array dimensions", () => {
      // Enum defined in one file
      symbolTable.addSymbol({
        name: "EColor_COUNT",
        kind: ESymbolKind.EnumMember,
        sourceFile: "colors.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "EColor",
      });

      // Variable with unresolved dimension from another file
      symbolTable.addSymbol({
        name: "DATA",
        kind: ESymbolKind.Variable,
        type: "u8",
        sourceFile: "main.cnx",
        sourceLine: 3,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        isArray: true,
        arrayDimensions: ["COUNT"],
      });

      symbolTable.resolveExternalEnumArrayDimensions();

      const symbol = symbolTable.getSymbol("DATA");
      expect(symbol?.arrayDimensions).toEqual(["EColor_COUNT"]);
    });

    it("resolves cross-file enum member in function parameter dimensions", () => {
      symbolTable.addSymbol({
        name: "ESize_MAX",
        kind: ESymbolKind.EnumMember,
        sourceFile: "sizes.cnx",
        sourceLine: 3,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "ESize",
      });

      symbolTable.addSymbol({
        name: "process",
        kind: ESymbolKind.Function,
        sourceFile: "main.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parameters: [
          {
            name: "buf",
            type: "u8",
            isArray: true,
            arrayDimensions: ["MAX"],
            isConst: false,
          },
        ],
      });

      symbolTable.resolveExternalEnumArrayDimensions();

      const symbol = symbolTable.getSymbol("process");
      expect(symbol?.parameters?.[0].arrayDimensions).toEqual(["ESize_MAX"]);
    });

    it("does not double-prefix already resolved dimensions", () => {
      symbolTable.addSymbol({
        name: "EColor_COUNT",
        kind: ESymbolKind.EnumMember,
        sourceFile: "colors.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "EColor",
      });

      symbolTable.addSymbol({
        name: "DATA",
        kind: ESymbolKind.Variable,
        type: "u8",
        sourceFile: "main.cnx",
        sourceLine: 3,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        isArray: true,
        arrayDimensions: ["EColor_COUNT"],
      });

      symbolTable.resolveExternalEnumArrayDimensions();

      const symbol = symbolTable.getSymbol("DATA");
      expect(symbol?.arrayDimensions).toEqual(["EColor_COUNT"]);
    });

    it("leaves ambiguous members unresolved (same name in multiple enums)", () => {
      symbolTable.addSymbol({
        name: "EColor_COUNT",
        kind: ESymbolKind.EnumMember,
        sourceFile: "colors.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "EColor",
      });

      symbolTable.addSymbol({
        name: "ESize_COUNT",
        kind: ESymbolKind.EnumMember,
        sourceFile: "sizes.cnx",
        sourceLine: 3,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "ESize",
      });

      symbolTable.addSymbol({
        name: "DATA",
        kind: ESymbolKind.Variable,
        type: "u8",
        sourceFile: "main.cnx",
        sourceLine: 3,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        isArray: true,
        arrayDimensions: ["COUNT"],
      });

      symbolTable.resolveExternalEnumArrayDimensions();

      // Ambiguous: COUNT exists in both EColor and ESize
      const symbol = symbolTable.getSymbol("DATA");
      expect(symbol?.arrayDimensions).toEqual(["COUNT"]);
    });

    it("does not modify numeric dimensions", () => {
      symbolTable.addSymbol({
        name: "EColor_COUNT",
        kind: ESymbolKind.EnumMember,
        sourceFile: "colors.cnx",
        sourceLine: 5,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        parent: "EColor",
      });

      symbolTable.addSymbol({
        name: "DATA",
        kind: ESymbolKind.Variable,
        type: "u8",
        sourceFile: "main.cnx",
        sourceLine: 3,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        isArray: true,
        arrayDimensions: ["10"],
      });

      symbolTable.resolveExternalEnumArrayDimensions();

      const symbol = symbolTable.getSymbol("DATA");
      expect(symbol?.arrayDimensions).toEqual(["10"]);
    });

    it("is a no-op when no enum members exist", () => {
      symbolTable.addSymbol({
        name: "DATA",
        kind: ESymbolKind.Variable,
        type: "u8",
        sourceFile: "main.cnx",
        sourceLine: 3,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
        isArray: true,
        arrayDimensions: ["COUNT"],
      });

      symbolTable.resolveExternalEnumArrayDimensions();

      const symbol = symbolTable.getSymbol("DATA");
      expect(symbol?.arrayDimensions).toEqual(["COUNT"]);
    });
  });
});
