import { describe, it, expect } from "vitest";
import SymbolLookupHelper from "../SymbolLookupHelper.js";
import ESymbolKind from "../../../../../utils/types/ESymbolKind.js";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage.js";

describe("SymbolLookupHelper", () => {
  describe("hasSymbolWithKindAndLanguage", () => {
    it("returns false when symbolTable is null", () => {
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          null,
          "test",
          ESymbolKind.Function,
          [ESourceLanguage.C],
        ),
      ).toBe(false);
    });

    it("returns false when symbolTable is undefined", () => {
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          undefined,
          "test",
          ESymbolKind.Function,
          [ESourceLanguage.C],
        ),
      ).toBe(false);
    });

    it("returns false when no matching symbol found", () => {
      const mockTable = {
        getOverloads: () => [],
      };
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          mockTable,
          "test",
          ESymbolKind.Function,
          [ESourceLanguage.C],
        ),
      ).toBe(false);
    });

    it("returns false when kind doesn't match", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Variable, sourceLanguage: ESourceLanguage.C },
        ],
      };
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          mockTable,
          "test",
          ESymbolKind.Function,
          [ESourceLanguage.C],
        ),
      ).toBe(false);
    });

    it("returns false when language doesn't match", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.CNext },
        ],
      };
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          mockTable,
          "test",
          ESymbolKind.Function,
          [ESourceLanguage.C],
        ),
      ).toBe(false);
    });

    it("returns true when matching symbol found", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.C },
        ],
      };
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          mockTable,
          "test",
          ESymbolKind.Function,
          [ESourceLanguage.C],
        ),
      ).toBe(true);
    });

    it("returns true when any language in list matches", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.Cpp },
        ],
      };
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          mockTable,
          "test",
          ESymbolKind.Function,
          [ESourceLanguage.C, ESourceLanguage.Cpp],
        ),
      ).toBe(true);
    });
  });

  describe("isCppEnumClass", () => {
    it("returns false when symbolTable is null", () => {
      expect(SymbolLookupHelper.isCppEnumClass(null, "MyEnum")).toBe(false);
    });

    it("returns true for C++ enum", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Enum, sourceLanguage: ESourceLanguage.Cpp },
        ],
      };
      expect(SymbolLookupHelper.isCppEnumClass(mockTable, "MyEnum")).toBe(true);
    });

    it("returns false for C enum", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Enum, sourceLanguage: ESourceLanguage.C },
        ],
      };
      expect(SymbolLookupHelper.isCppEnumClass(mockTable, "MyEnum")).toBe(
        false,
      );
    });
  });

  describe("isExternalCFunction", () => {
    it("returns false when symbolTable is null", () => {
      expect(SymbolLookupHelper.isExternalCFunction(null, "myFunc")).toBe(
        false,
      );
    });

    it("returns true for C function", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.C },
        ],
      };
      expect(SymbolLookupHelper.isExternalCFunction(mockTable, "myFunc")).toBe(
        true,
      );
    });

    it("returns true for C++ function", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.Cpp },
        ],
      };
      expect(SymbolLookupHelper.isExternalCFunction(mockTable, "myFunc")).toBe(
        true,
      );
    });

    it("returns false for C-Next function", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.CNext },
        ],
      };
      expect(SymbolLookupHelper.isExternalCFunction(mockTable, "myFunc")).toBe(
        false,
      );
    });
  });

  describe("isNamespace", () => {
    it("returns false when symbolTable is null", () => {
      expect(SymbolLookupHelper.isNamespace(null, "MyNS")).toBe(false);
    });

    it("returns false when symbolTable is undefined", () => {
      expect(SymbolLookupHelper.isNamespace(undefined, "MyNS")).toBe(false);
    });

    it("returns true when namespace symbol found", () => {
      const mockTable = {
        getOverloads: () => [
          {
            kind: ESymbolKind.Namespace,
            sourceLanguage: ESourceLanguage.CNext,
          },
        ],
      };
      expect(SymbolLookupHelper.isNamespace(mockTable, "MyNS")).toBe(true);
    });

    it("returns false when no namespace symbol", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.CNext },
        ],
      };
      expect(SymbolLookupHelper.isNamespace(mockTable, "MyNS")).toBe(false);
    });
  });

  describe("isCppType", () => {
    it("returns false when symbolTable is null", () => {
      expect(SymbolLookupHelper.isCppType(null, "MyType")).toBe(false);
    });

    it("returns false when symbolTable is undefined", () => {
      expect(SymbolLookupHelper.isCppType(undefined, "MyType")).toBe(false);
    });

    it("returns true for C++ struct", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Struct, sourceLanguage: ESourceLanguage.Cpp },
        ],
      };
      expect(SymbolLookupHelper.isCppType(mockTable, "MyStruct")).toBe(true);
    });

    it("returns true for C++ class", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Class, sourceLanguage: ESourceLanguage.Cpp },
        ],
      };
      expect(SymbolLookupHelper.isCppType(mockTable, "MyClass")).toBe(true);
    });

    it("returns true for C++ type alias", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Type, sourceLanguage: ESourceLanguage.Cpp },
        ],
      };
      expect(SymbolLookupHelper.isCppType(mockTable, "MyType")).toBe(true);
    });

    it("returns false for C struct", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Struct, sourceLanguage: ESourceLanguage.C },
        ],
      };
      expect(SymbolLookupHelper.isCppType(mockTable, "MyStruct")).toBe(false);
    });

    it("returns false for C++ function", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.Cpp },
        ],
      };
      expect(SymbolLookupHelper.isCppType(mockTable, "myFunc")).toBe(false);
    });

    it("returns false for C++ enum", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Enum, sourceLanguage: ESourceLanguage.Cpp },
        ],
      };
      expect(SymbolLookupHelper.isCppType(mockTable, "MyEnum")).toBe(false);
    });
  });

  describe("isCNextFunction", () => {
    it("returns false when symbolTable is null", () => {
      expect(SymbolLookupHelper.isCNextFunction(null, "myFunc")).toBe(false);
    });

    it("returns false when symbolTable is undefined", () => {
      expect(SymbolLookupHelper.isCNextFunction(undefined, "myFunc")).toBe(
        false,
      );
    });

    it("returns true for C-Next function", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.CNext },
        ],
      };
      expect(SymbolLookupHelper.isCNextFunction(mockTable, "myFunc")).toBe(
        true,
      );
    });

    it("returns false for C function", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.C },
        ],
      };
      expect(SymbolLookupHelper.isCNextFunction(mockTable, "myFunc")).toBe(
        false,
      );
    });

    it("returns false for C++ function", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.Cpp },
        ],
      };
      expect(SymbolLookupHelper.isCNextFunction(mockTable, "myFunc")).toBe(
        false,
      );
    });

    it("returns false for C-Next struct", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Struct, sourceLanguage: ESourceLanguage.CNext },
        ],
      };
      expect(SymbolLookupHelper.isCNextFunction(mockTable, "MyStruct")).toBe(
        false,
      );
    });
  });

  describe("isCNextFunctionCombined", () => {
    it("returns true when in knownFunctions set", () => {
      const knownFunctions = new Set(["myFunc"]);
      expect(
        SymbolLookupHelper.isCNextFunctionCombined(
          knownFunctions,
          null,
          "myFunc",
        ),
      ).toBe(true);
    });

    it("returns true when in symbol table as C-Next function", () => {
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.CNext },
        ],
      };
      expect(
        SymbolLookupHelper.isCNextFunctionCombined(
          new Set(),
          mockTable,
          "myFunc",
        ),
      ).toBe(true);
    });

    it("returns false when not in knownFunctions and not in symbol table", () => {
      const mockTable = {
        getOverloads: () => [],
      };
      expect(
        SymbolLookupHelper.isCNextFunctionCombined(
          new Set(),
          mockTable,
          "myFunc",
        ),
      ).toBe(false);
    });

    it("returns false when knownFunctions is undefined and not in symbol table", () => {
      expect(
        SymbolLookupHelper.isCNextFunctionCombined(undefined, null, "myFunc"),
      ).toBe(false);
    });

    it("prioritizes knownFunctions over symbol table", () => {
      const knownFunctions = new Set(["myFunc"]);
      const mockTable = {
        getOverloads: () => [
          { kind: ESymbolKind.Function, sourceLanguage: ESourceLanguage.C },
        ],
      };
      expect(
        SymbolLookupHelper.isCNextFunctionCombined(
          knownFunctions,
          mockTable,
          "myFunc",
        ),
      ).toBe(true);
    });
  });

  describe("isKnownScope", () => {
    it("returns true when in knownScopes set", () => {
      const knownScopes = new Set(["MyScope"]);
      expect(
        SymbolLookupHelper.isKnownScope(knownScopes, null, "MyScope"),
      ).toBe(true);
    });

    it("returns true when in symbol table as namespace", () => {
      const mockTable = {
        getOverloads: () => [
          {
            kind: ESymbolKind.Namespace,
            sourceLanguage: ESourceLanguage.CNext,
          },
        ],
      };
      expect(
        SymbolLookupHelper.isKnownScope(new Set(), mockTable, "MyScope"),
      ).toBe(true);
    });

    it("returns false when not in knownScopes and not in symbol table", () => {
      const mockTable = {
        getOverloads: () => [],
      };
      expect(
        SymbolLookupHelper.isKnownScope(new Set(), mockTable, "MyScope"),
      ).toBe(false);
    });

    it("returns false when knownScopes is undefined and not in symbol table", () => {
      expect(SymbolLookupHelper.isKnownScope(undefined, null, "MyScope")).toBe(
        false,
      );
    });

    it("prioritizes knownScopes over symbol table", () => {
      const knownScopes = new Set(["MyScope"]);
      const mockTable = {
        getOverloads: () => [],
      };
      expect(
        SymbolLookupHelper.isKnownScope(knownScopes, mockTable, "MyScope"),
      ).toBe(true);
    });
  });
});
