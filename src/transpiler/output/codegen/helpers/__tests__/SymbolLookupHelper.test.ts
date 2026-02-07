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
});
