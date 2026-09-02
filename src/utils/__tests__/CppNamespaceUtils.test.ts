/**
 * Unit tests for CppNamespaceUtils
 * Tests C++ namespace detection and conversion utilities.
 */
import { describe, it, expect, beforeEach } from "vitest";
import CppNamespaceUtils from "../CppNamespaceUtils";
import SymbolTable from "../../transpiler/logic/symbols/SymbolTable";
import ESourceLanguage from "../types/ESourceLanguage";
import ScopeUtils from "../ScopeUtils";
import type TCppSymbol from "../../transpiler/types/symbols/cpp/TCppSymbol";
import type TCSymbol from "../../transpiler/types/symbols/c/TCSymbol";
import type IScopeSymbol from "../../transpiler/types/symbols/IScopeSymbol";

describe("CppNamespaceUtils", () => {
  let symbolTable: SymbolTable;

  // Helper to create a C++ namespace symbol
  function makeCppNamespace(name: string, sourceFile: string): TCppSymbol {
    return {
      kind: "namespace",
      name,
      sourceFile,
      sourceLine: 1,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: false,
    };
  }

  // Helper to create a C++ class symbol
  function makeCppClass(name: string, sourceFile: string): TCppSymbol {
    return {
      kind: "class",
      name,
      sourceFile,
      sourceLine: 1,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: false,
    };
  }

  // Helper to create a C++ enum symbol
  function makeCppEnum(name: string, sourceFile: string): TCppSymbol {
    return {
      kind: "enum",
      name,
      sourceFile,
      sourceLine: 1,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: false,
    };
  }

  // Helper to create a C++ function symbol
  function makeCppFunction(name: string, sourceFile: string): TCppSymbol {
    return {
      kind: "function",
      name,
      sourceFile,
      sourceLine: 1,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: false,
      type: "void",
    };
  }

  // Helper to create a C struct symbol
  function makeCStruct(name: string, sourceFile: string): TCSymbol {
    return {
      kind: "struct",
      name,
      sourceFile,
      sourceLine: 1,
      sourceLanguage: ESourceLanguage.C,
      isExported: false,
      isUnion: false,
    };
  }

  // Helper to create a C-Next scope symbol.
  //
  // Built through the real factories so the parent chain terminates. The
  // previous version was self-parented under a non-empty name — a shape no
  // factory produces, since only the global scope is its own parent and its
  // name is empty. Walking that chain never reaches global, so it hung any
  // caller that resolves a scope path.
  function makeCNextScope(name: string, sourceFile: string): IScopeSymbol {
    return { ...ScopeUtils.createScope(name, ""), sourceFile };
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
      symbolTable.addCppSymbol(makeCppNamespace("SeaDash", "SeaDash.hpp"));
      expect(CppNamespaceUtils.isCppNamespace("SeaDash", symbolTable)).toBe(
        true,
      );
    });

    it("should return true for C++ class", () => {
      symbolTable.addCppSymbol(makeCppClass("MyClass", "MyClass.hpp"));
      expect(CppNamespaceUtils.isCppNamespace("MyClass", symbolTable)).toBe(
        true,
      );
    });

    it("should return true for C++ enum (scoped enum)", () => {
      symbolTable.addCppSymbol(makeCppEnum("MyEnum", "MyEnum.hpp"));
      expect(CppNamespaceUtils.isCppNamespace("MyEnum", symbolTable)).toBe(
        true,
      );
    });

    it("should return false for C-Next namespace (scope)", () => {
      symbolTable.addTSymbol(makeCNextScope("MyScope", "MyScope.cnx"));
      expect(CppNamespaceUtils.isCppNamespace("MyScope", symbolTable)).toBe(
        false,
      );
    });

    it("should return false for C struct", () => {
      symbolTable.addCSymbol(makeCStruct("MyStruct", "MyStruct.h"));
      expect(CppNamespaceUtils.isCppNamespace("MyStruct", symbolTable)).toBe(
        false,
      );
    });

    it("should return false for C++ function", () => {
      symbolTable.addCppSymbol(makeCppFunction("myFunction", "funcs.hpp"));
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
        CppNamespaceUtils.isCppNamespaceType(
          "SeaDash__Parse__Result",
          undefined,
        ),
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
      symbolTable.addCppSymbol(makeCppNamespace("SeaDash", "SeaDash.hpp"));
      expect(
        CppNamespaceUtils.isCppNamespaceType(
          "SeaDash__Parse__ParseResult",
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
      symbolTable.addTSymbol(makeCNextScope("MyScope", "MyScope.cnx"));
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
          "SeaDash__Parse__Result",
          undefined,
        ),
      ).toBe("SeaDash__Parse__Result");
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
      symbolTable.addCppSymbol(makeCppNamespace("SeaDash", "SeaDash.hpp"));
      expect(
        CppNamespaceUtils.convertToCppNamespace(
          "SeaDash__Parse__ParseResult",
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
      symbolTable.addTSymbol(makeCNextScope("MyScope", "MyScope.cnx"));
      expect(
        CppNamespaceUtils.convertToCppNamespace("MyScope_MyType", symbolTable),
      ).toBe("MyScope_MyType");
    });

    it("should handle deeply nested namespace", () => {
      symbolTable.addCppSymbol(makeCppNamespace("Lib", "Lib.hpp"));
      expect(
        CppNamespaceUtils.convertToCppNamespace(
          "Lib__Sub__Deep__Type",
          symbolTable,
        ),
      ).toBe("Lib::Sub::Deep::Type");
    });
  });
});
