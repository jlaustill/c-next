/**
 * Unit tests for CppNamespaceUtils
 * Tests C++ namespace detection and conversion utilities.
 */
import { describe, it, expect, beforeEach } from "vitest";
import CppNamespaceUtils from "./CppNamespaceUtils";
import SymbolTable from "../transpiler/logic/symbols/SymbolTable";
import ESourceLanguage from "./types/ESourceLanguage";
import ESymbolKind from "./types/ESymbolKind";
import ISymbol from "./types/ISymbol";

describe("CppNamespaceUtils", () => {
  let symbolTable: SymbolTable;

  // Helper to create a minimal valid ISymbol
  function makeSymbol(
    name: string,
    kind: ESymbolKind,
    sourceLanguage: ESourceLanguage,
    sourceFile: string,
  ): ISymbol {
    return {
      name,
      kind,
      sourceLanguage,
      sourceFile,
      sourceLine: 1,
      isExported: false,
    };
  }

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  // ========================================================================
  // isCppNamespace
  // ========================================================================

  describe("isCppNamespace", () => {
    it("should return false with no symbol table", () => {
      expect(CppNamespaceUtils.isCppNamespace("SeaDash", undefined)).toBe(
        false,
      );
    });

    it("should return false for unknown symbol", () => {
      expect(CppNamespaceUtils.isCppNamespace("Unknown", symbolTable)).toBe(
        false,
      );
    });

    it("should return true for C++ namespace", () => {
      symbolTable.addSymbol(
        makeSymbol(
          "SeaDash",
          ESymbolKind.Namespace,
          ESourceLanguage.Cpp,
          "SeaDash.hpp",
        ),
      );
      expect(CppNamespaceUtils.isCppNamespace("SeaDash", symbolTable)).toBe(
        true,
      );
    });

    it("should return true for C++ class", () => {
      symbolTable.addSymbol(
        makeSymbol(
          "MyClass",
          ESymbolKind.Class,
          ESourceLanguage.Cpp,
          "MyClass.hpp",
        ),
      );
      expect(CppNamespaceUtils.isCppNamespace("MyClass", symbolTable)).toBe(
        true,
      );
    });

    it("should return true for C++ enum (scoped enum)", () => {
      symbolTable.addSymbol(
        makeSymbol(
          "MyEnum",
          ESymbolKind.Enum,
          ESourceLanguage.Cpp,
          "MyEnum.hpp",
        ),
      );
      expect(CppNamespaceUtils.isCppNamespace("MyEnum", symbolTable)).toBe(
        true,
      );
    });

    it("should return false for C-Next namespace (scope)", () => {
      symbolTable.addSymbol(
        makeSymbol(
          "MyScope",
          ESymbolKind.Namespace,
          ESourceLanguage.CNext,
          "MyScope.cnx",
        ),
      );
      expect(CppNamespaceUtils.isCppNamespace("MyScope", symbolTable)).toBe(
        false,
      );
    });

    it("should return false for C struct", () => {
      symbolTable.addSymbol(
        makeSymbol(
          "MyStruct",
          ESymbolKind.Struct,
          ESourceLanguage.C,
          "MyStruct.h",
        ),
      );
      expect(CppNamespaceUtils.isCppNamespace("MyStruct", symbolTable)).toBe(
        false,
      );
    });

    it("should return false for C++ function", () => {
      symbolTable.addSymbol(
        makeSymbol(
          "myFunction",
          ESymbolKind.Function,
          ESourceLanguage.Cpp,
          "funcs.hpp",
        ),
      );
      expect(CppNamespaceUtils.isCppNamespace("myFunction", symbolTable)).toBe(
        false,
      );
    });
  });

  // ========================================================================
  // isCppNamespaceType
  // ========================================================================

  describe("isCppNamespaceType", () => {
    it("should return false with no symbol table", () => {
      expect(
        CppNamespaceUtils.isCppNamespaceType("SeaDash_Parse_Result", undefined),
      ).toBe(false);
    });

    it("should return true for type already in :: format", () => {
      expect(
        CppNamespaceUtils.isCppNamespaceType(
          "SeaDash::Parse::Result",
          undefined,
        ),
      ).toBe(true);
    });

    it("should return false for type without underscores", () => {
      expect(
        CppNamespaceUtils.isCppNamespaceType("SimpleType", symbolTable),
      ).toBe(false);
    });

    it("should return true for underscore type with C++ namespace prefix", () => {
      symbolTable.addSymbol(
        makeSymbol(
          "SeaDash",
          ESymbolKind.Namespace,
          ESourceLanguage.Cpp,
          "SeaDash.hpp",
        ),
      );
      expect(
        CppNamespaceUtils.isCppNamespaceType(
          "SeaDash_Parse_ParseResult",
          symbolTable,
        ),
      ).toBe(true);
    });

    it("should return false for underscore type without C++ namespace prefix", () => {
      // snake_case name that is NOT a C++ namespace
      expect(
        CppNamespaceUtils.isCppNamespaceType("some_c_struct", symbolTable),
      ).toBe(false);
    });

    it("should return false for C-Next scope underscore type", () => {
      symbolTable.addSymbol(
        makeSymbol(
          "MyScope",
          ESymbolKind.Namespace,
          ESourceLanguage.CNext,
          "MyScope.cnx",
        ),
      );
      expect(
        CppNamespaceUtils.isCppNamespaceType("MyScope_MyType", symbolTable),
      ).toBe(false);
    });
  });

  // ========================================================================
  // convertToCppNamespace
  // ========================================================================

  describe("convertToCppNamespace", () => {
    it("should return original if no symbol table", () => {
      expect(
        CppNamespaceUtils.convertToCppNamespace(
          "SeaDash_Parse_Result",
          undefined,
        ),
      ).toBe("SeaDash_Parse_Result");
    });

    it("should return original for type already in :: format", () => {
      expect(
        CppNamespaceUtils.convertToCppNamespace(
          "SeaDash::Parse::Result",
          symbolTable,
        ),
      ).toBe("SeaDash::Parse::Result");
    });

    it("should return original for type without underscores", () => {
      expect(
        CppNamespaceUtils.convertToCppNamespace("SimpleType", symbolTable),
      ).toBe("SimpleType");
    });

    it("should convert underscore type with C++ namespace prefix", () => {
      symbolTable.addSymbol(
        makeSymbol(
          "SeaDash",
          ESymbolKind.Namespace,
          ESourceLanguage.Cpp,
          "SeaDash.hpp",
        ),
      );
      expect(
        CppNamespaceUtils.convertToCppNamespace(
          "SeaDash_Parse_ParseResult",
          symbolTable,
        ),
      ).toBe("SeaDash::Parse::ParseResult");
    });

    it("should NOT convert underscore type without C++ namespace prefix", () => {
      // snake_case name that is NOT a C++ namespace - preserve underscores
      expect(
        CppNamespaceUtils.convertToCppNamespace("some_c_struct", symbolTable),
      ).toBe("some_c_struct");
    });

    it("should NOT convert C-Next scope underscore type", () => {
      symbolTable.addSymbol(
        makeSymbol(
          "MyScope",
          ESymbolKind.Namespace,
          ESourceLanguage.CNext,
          "MyScope.cnx",
        ),
      );
      expect(
        CppNamespaceUtils.convertToCppNamespace("MyScope_MyType", symbolTable),
      ).toBe("MyScope_MyType");
    });

    it("should handle deeply nested namespace", () => {
      symbolTable.addSymbol(
        makeSymbol(
          "Lib",
          ESymbolKind.Namespace,
          ESourceLanguage.Cpp,
          "Lib.hpp",
        ),
      );
      expect(
        CppNamespaceUtils.convertToCppNamespace(
          "Lib_Sub_Deep_Type",
          symbolTable,
        ),
      ).toBe("Lib::Sub::Deep::Type");
    });
  });
});
