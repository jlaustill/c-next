/**
 * Unit tests for SymbolTable
 */

import { describe, it, expect, beforeEach } from "vitest";
import SymbolTable from "../SymbolTable";
import ESymbolKind from "../../../../utils/types/ESymbolKind";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import ISymbol from "../../../../utils/types/ISymbol";

/**
 * Create a minimal symbol for testing
 */
function createSymbol(overrides: Partial<ISymbol>): ISymbol {
  return {
    name: "test",
    kind: ESymbolKind.Variable,
    sourceFile: "test.cnx",
    sourceLine: 1,
    sourceLanguage: ESourceLanguage.CNext,
    isExported: false,
    ...overrides,
  };
}

describe("SymbolTable", () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  describe("resolveExternalArrayDimensions", () => {
    it("resolves array dimension from const value", () => {
      // Add a const symbol
      symbolTable.addSymbol(
        createSymbol({
          name: "BUFFER_SIZE",
          isConst: true,
          initialValue: "32",
        }),
      );

      // Add an array with unresolved dimension
      const arraySymbol = createSymbol({
        name: "buffer",
        isArray: true,
        arrayDimensions: ["BUFFER_SIZE"],
      });
      symbolTable.addSymbol(arraySymbol);

      // Resolve dimensions
      symbolTable.resolveExternalArrayDimensions();

      // Verify dimension was resolved
      const symbols = symbolTable.getOverloads("buffer");
      expect(symbols[0].arrayDimensions).toEqual(["32"]);
    });

    it("resolves multiple dimensions", () => {
      // Add const symbols
      symbolTable.addSymbol(
        createSymbol({
          name: "ROWS",
          isConst: true,
          initialValue: "10",
        }),
      );
      symbolTable.addSymbol(
        createSymbol({
          name: "COLS",
          isConst: true,
          initialValue: "20",
        }),
      );

      // Add a 2D array
      const arraySymbol = createSymbol({
        name: "matrix",
        isArray: true,
        arrayDimensions: ["ROWS", "COLS"],
      });
      symbolTable.addSymbol(arraySymbol);

      symbolTable.resolveExternalArrayDimensions();

      const symbols = symbolTable.getOverloads("matrix");
      expect(symbols[0].arrayDimensions).toEqual(["10", "20"]);
    });

    it("preserves numeric dimensions", () => {
      const arraySymbol = createSymbol({
        name: "buffer",
        isArray: true,
        arrayDimensions: ["100"],
      });
      symbolTable.addSymbol(arraySymbol);

      symbolTable.resolveExternalArrayDimensions();

      const symbols = symbolTable.getOverloads("buffer");
      expect(symbols[0].arrayDimensions).toEqual(["100"]);
    });

    it("preserves unresolved macro references", () => {
      // Add an array with a dimension that can't be resolved (C macro)
      const arraySymbol = createSymbol({
        name: "buffer",
        isArray: true,
        arrayDimensions: ["EXTERNAL_MACRO"],
      });
      symbolTable.addSymbol(arraySymbol);

      symbolTable.resolveExternalArrayDimensions();

      // Dimension should be unchanged
      const symbols = symbolTable.getOverloads("buffer");
      expect(symbols[0].arrayDimensions).toEqual(["EXTERNAL_MACRO"]);
    });

    it("handles mixed resolved and unresolved dimensions", () => {
      symbolTable.addSymbol(
        createSymbol({
          name: "SIZE",
          isConst: true,
          initialValue: "5",
        }),
      );

      const arraySymbol = createSymbol({
        name: "data",
        isArray: true,
        arrayDimensions: ["SIZE", "UNKNOWN_MACRO", "10"],
      });
      symbolTable.addSymbol(arraySymbol);

      symbolTable.resolveExternalArrayDimensions();

      const symbols = symbolTable.getOverloads("data");
      expect(symbols[0].arrayDimensions).toEqual(["5", "UNKNOWN_MACRO", "10"]);
    });

    it("handles hex const values", () => {
      symbolTable.addSymbol(
        createSymbol({
          name: "SIZE",
          isConst: true,
          initialValue: "0x10",
        }),
      );

      const arraySymbol = createSymbol({
        name: "buffer",
        isArray: true,
        arrayDimensions: ["SIZE"],
      });
      symbolTable.addSymbol(arraySymbol);

      symbolTable.resolveExternalArrayDimensions();

      const symbols = symbolTable.getOverloads("buffer");
      expect(symbols[0].arrayDimensions).toEqual(["16"]);
    });

    it("handles binary const values", () => {
      symbolTable.addSymbol(
        createSymbol({
          name: "SIZE",
          isConst: true,
          initialValue: "0b1000",
        }),
      );

      const arraySymbol = createSymbol({
        name: "buffer",
        isArray: true,
        arrayDimensions: ["SIZE"],
      });
      symbolTable.addSymbol(arraySymbol);

      symbolTable.resolveExternalArrayDimensions();

      const symbols = symbolTable.getOverloads("buffer");
      expect(symbols[0].arrayDimensions).toEqual(["8"]);
    });

    it("does nothing when no const values exist", () => {
      const arraySymbol = createSymbol({
        name: "buffer",
        isArray: true,
        arrayDimensions: ["SIZE"],
      });
      symbolTable.addSymbol(arraySymbol);

      // Should not throw
      symbolTable.resolveExternalArrayDimensions();

      const symbols = symbolTable.getOverloads("buffer");
      expect(symbols[0].arrayDimensions).toEqual(["SIZE"]);
    });

    it("ignores non-const variables", () => {
      // Add a non-const variable (should not be used for resolution)
      symbolTable.addSymbol(
        createSymbol({
          name: "SIZE",
          isConst: false,
          initialValue: "32",
        }),
      );

      const arraySymbol = createSymbol({
        name: "buffer",
        isArray: true,
        arrayDimensions: ["SIZE"],
      });
      symbolTable.addSymbol(arraySymbol);

      symbolTable.resolveExternalArrayDimensions();

      // Should remain unresolved
      const symbols = symbolTable.getOverloads("buffer");
      expect(symbols[0].arrayDimensions).toEqual(["SIZE"]);
    });
  });
});
