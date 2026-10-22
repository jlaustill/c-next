import { describe, it, expect } from "vitest";
import SymbolLookupHelper from "../SymbolLookupHelper";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import type TSymbolKind from "../../../types/symbol-kinds/TSymbolKind";

/**
 * Build an ISymbolTable stub for these tests.
 *
 * Keyed by transpiled C name, because that is the only lookup this layer is
 * allowed to make (#1139). Stubbing a closure that ignores its argument
 * would make every test here pass against the bare-name index too, which is the
 * defect the layer exists to prevent — see the "resolves by transpiled C name"
 * test below, which fails if the lookup key regresses.
 */
const makeSymbolTable = <
  T extends { kind: TSymbolKind; sourceLanguage: ESourceLanguage },
>(
  symbols: T[] = [],
  extras: { getStructFields?: (name: string) => unknown } = {},
) => ({
  getOverloadsByCName: (_cName: string) => symbols,
  ...extras,
});

describe("SymbolLookupHelper", () => {
  describe("hasSymbolWithKindAndLanguage", () => {
    it("returns false when symbolTable is null", () => {
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          null,
          "test",
          "function",
          [ESourceLanguage.C],
        ),
      ).toBe(false);
    });

    it("returns false when symbolTable is undefined", () => {
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          undefined,
          "test",
          "function",
          [ESourceLanguage.C],
        ),
      ).toBe(false);
    });

    it("returns false when no matching symbol found", () => {
      const mockTable = makeSymbolTable();
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          mockTable,
          "test",
          "function",
          [ESourceLanguage.C],
        ),
      ).toBe(false);
    });

    it("returns false when kind doesn't match", () => {
      const mockTable = makeSymbolTable([
        { kind: "variable" as const, sourceLanguage: ESourceLanguage.C },
      ]);
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          mockTable,
          "test",
          "function",
          [ESourceLanguage.C],
        ),
      ).toBe(false);
    });

    it("returns false when language doesn't match", () => {
      const mockTable = makeSymbolTable([
        { kind: "function" as const, sourceLanguage: ESourceLanguage.Cnx },
      ]);
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          mockTable,
          "test",
          "function",
          [ESourceLanguage.C],
        ),
      ).toBe(false);
    });

    it("returns true when matching symbol found", () => {
      const mockTable = makeSymbolTable([
        { kind: "function" as const, sourceLanguage: ESourceLanguage.C },
      ]);
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          mockTable,
          "test",
          "function",
          [ESourceLanguage.C],
        ),
      ).toBe(true);
    });

    it("returns true when any language in list matches", () => {
      const mockTable = makeSymbolTable([
        { kind: "function" as const, sourceLanguage: ESourceLanguage.Cpp },
      ]);
      expect(
        SymbolLookupHelper.hasSymbolWithKindAndLanguage(
          mockTable,
          "test",
          "function",
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
      const mockTable = makeSymbolTable([
        { kind: "enum" as const, sourceLanguage: ESourceLanguage.Cpp },
      ]);
      expect(SymbolLookupHelper.isCppEnumClass(mockTable, "MyEnum")).toBe(true);
    });

    it("returns false for C enum", () => {
      const mockTable = makeSymbolTable([
        { kind: "enum" as const, sourceLanguage: ESourceLanguage.C },
      ]);
      expect(SymbolLookupHelper.isCppEnumClass(mockTable, "MyEnum")).toBe(
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
      const mockTable = makeSymbolTable([
        {
          kind: "namespace" as const,
          sourceLanguage: ESourceLanguage.Cnx,
        },
      ]);
      expect(SymbolLookupHelper.isNamespace(mockTable, "MyNS")).toBe(true);
    });

    it("returns false when no namespace symbol", () => {
      const mockTable = makeSymbolTable([
        { kind: "function" as const, sourceLanguage: ESourceLanguage.Cnx },
      ]);
      expect(SymbolLookupHelper.isNamespace(mockTable, "MyNS")).toBe(false);
    });
  });

  describe("isCnxFunction", () => {
    it("returns false when symbolTable is null", () => {
      expect(SymbolLookupHelper.isCnxFunction(null, "myFunc")).toBe(false);
    });

    it("returns false when symbolTable is undefined", () => {
      expect(SymbolLookupHelper.isCnxFunction(undefined, "myFunc")).toBe(false);
    });

    it("returns true for cnx function", () => {
      const mockTable = makeSymbolTable([
        { kind: "function" as const, sourceLanguage: ESourceLanguage.Cnx },
      ]);
      expect(SymbolLookupHelper.isCnxFunction(mockTable, "myFunc")).toBe(true);
    });

    it("returns false for C function", () => {
      const mockTable = makeSymbolTable([
        { kind: "function" as const, sourceLanguage: ESourceLanguage.C },
      ]);
      expect(SymbolLookupHelper.isCnxFunction(mockTable, "myFunc")).toBe(false);
    });

    // Issue #1139 regression guard. The two indexes answer different questions:
    // the bare-name index needs ADR-057 scope context, the C-name index is an
    // exact canonical identity. Codegen holds the latter. This is the only test
    // in the file where the two disagree, so it is the one that fails if the
    // lookup key regresses — the rest assert kind/language filtering and would
    // stay green either way.
    it("resolves a scoped function by its transpiled C name, not its bare name", () => {
      const fn = {
        kind: "function" as const,
        sourceLanguage: ESourceLanguage.Cnx,
      };
      const table = {
        getOverloadsByCName: (cName: string) =>
          cName === "Sensors__readValue" ? [fn] : [],
      };

      expect(
        SymbolLookupHelper.isCnxFunction(table, "Sensors__readValue"),
      ).toBe(true);
      // The bare name is not this symbol's identity, so it must not resolve.
      expect(SymbolLookupHelper.isCnxFunction(table, "readValue")).toBe(false);
    });

    it("returns false for C++ function", () => {
      const mockTable = makeSymbolTable([
        { kind: "function" as const, sourceLanguage: ESourceLanguage.Cpp },
      ]);
      expect(SymbolLookupHelper.isCnxFunction(mockTable, "myFunc")).toBe(false);
    });

    it("returns false for cnx struct", () => {
      const mockTable = makeSymbolTable([
        { kind: "struct" as const, sourceLanguage: ESourceLanguage.Cnx },
      ]);
      expect(SymbolLookupHelper.isCnxFunction(mockTable, "MyStruct")).toBe(
        false,
      );
    });
  });

  describe("isCnxFunctionCombined", () => {
    it("returns true when in knownFunctions set", () => {
      const knownFunctions = new Set(["myFunc"]);
      expect(
        SymbolLookupHelper.isCnxFunctionCombined(
          knownFunctions,
          null,
          "myFunc",
        ),
      ).toBe(true);
    });

    it("returns true when in symbol table as cnx function", () => {
      const mockTable = makeSymbolTable([
        { kind: "function" as const, sourceLanguage: ESourceLanguage.Cnx },
      ]);
      expect(
        SymbolLookupHelper.isCnxFunctionCombined(
          new Set(),
          mockTable,
          "myFunc",
        ),
      ).toBe(true);
    });

    it("returns false when not in knownFunctions and not in symbol table", () => {
      const mockTable = makeSymbolTable([]);
      expect(
        SymbolLookupHelper.isCnxFunctionCombined(
          new Set(),
          mockTable,
          "myFunc",
        ),
      ).toBe(false);
    });

    it("returns false when knownFunctions is undefined and not in symbol table", () => {
      expect(
        SymbolLookupHelper.isCnxFunctionCombined(undefined, null, "myFunc"),
      ).toBe(false);
    });

    it("prioritizes knownFunctions over symbol table", () => {
      const knownFunctions = new Set(["myFunc"]);
      const mockTable = makeSymbolTable([
        { kind: "function" as const, sourceLanguage: ESourceLanguage.C },
      ]);
      expect(
        SymbolLookupHelper.isCnxFunctionCombined(
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
      const mockTable = makeSymbolTable([
        {
          kind: "namespace" as const,
          sourceLanguage: ESourceLanguage.Cnx,
        },
      ]);
      expect(
        SymbolLookupHelper.isKnownScope(new Set(), mockTable, "MyScope"),
      ).toBe(true);
    });

    it("returns false when not in knownScopes and not in symbol table", () => {
      const mockTable = makeSymbolTable([]);
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
      const mockTable = makeSymbolTable([]);
      expect(
        SymbolLookupHelper.isKnownScope(knownScopes, mockTable, "MyScope"),
      ).toBe(true);
    });
  });
});
