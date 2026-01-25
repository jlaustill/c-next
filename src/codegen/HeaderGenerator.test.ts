/**
 * Tests for HeaderGenerator
 * Issue #427: Tests for string<N> type handling in header generation
 */

import HeaderGenerator from "./HeaderGenerator";
import ESymbolKind from "../types/ESymbolKind";
import ESourceLanguage from "../types/ESourceLanguage";
import ISymbol from "../types/ISymbol";

describe("HeaderGenerator", () => {
  const generator = new HeaderGenerator();

  // Helper to create a variable symbol
  function makeVarSymbol(
    name: string,
    type: string,
    options: {
      isArray?: boolean;
      arrayDimensions?: string[];
      isConst?: boolean;
    } = {},
  ): ISymbol {
    return {
      name,
      type,
      kind: ESymbolKind.Variable,
      sourceFile: "test.cnx",
      sourceLine: 1,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
      isArray: options.isArray,
      arrayDimensions: options.arrayDimensions,
      isConst: options.isConst,
    };
  }

  describe("string<N> type handling in extern declarations", () => {
    it("should generate char[N+1] for string<N> variables", () => {
      const symbols = [makeVarSymbol("greeting", "string<32>")];
      const header = generator.generate(symbols, "test.h");

      expect(header).toContain("extern char greeting[33];");
      expect(header).not.toContain("string<32>");
    });

    it("should generate char[N+1] for const string<N> variables", () => {
      const symbols = [
        makeVarSymbol("message", "string<16>", { isConst: true }),
      ];
      const header = generator.generate(symbols, "test.h");

      expect(header).toContain("extern const char message[17];");
    });

    it("should handle string<N> arrays with correct dimension order", () => {
      // string<16> labels[3] -> char labels[3][17]
      const symbols = [
        makeVarSymbol("labels", "string<16>", {
          isArray: true,
          arrayDimensions: ["3"],
        }),
      ];
      const header = generator.generate(symbols, "test.h");

      expect(header).toContain("extern char labels[3][17];");
    });

    it("should handle const string<N> arrays", () => {
      const symbols = [
        makeVarSymbol("names", "string<64>", {
          isArray: true,
          arrayDimensions: ["5"],
          isConst: true,
        }),
      ];
      const header = generator.generate(symbols, "test.h");

      expect(header).toContain("extern const char names[5][65];");
    });

    it("should handle multi-dimensional string arrays", () => {
      // string<8> matrix[2][3] -> char matrix[2][3][9]
      const symbols = [
        makeVarSymbol("matrix", "string<8>", {
          isArray: true,
          arrayDimensions: ["2", "3"],
        }),
      ];
      const header = generator.generate(symbols, "test.h");

      expect(header).toContain("extern char matrix[2][3][9];");
    });

    it("should not generate typedef for string<N> types", () => {
      const symbols = [makeVarSymbol("buffer", "string<128>")];
      const header = generator.generate(symbols, "test.h");

      expect(header).not.toContain("typedef struct string");
      expect(header).not.toContain("External type dependencies");
    });
  });

  describe("Issue #449: declaration ordering", () => {
    // Helper to create an enum symbol
    function makeEnumSymbol(name: string): ISymbol {
      return {
        name,
        kind: ESymbolKind.Enum,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      };
    }

    // Helper to create a struct symbol
    function makeStructSymbol(name: string): ISymbol {
      return {
        name,
        kind: ESymbolKind.Struct,
        sourceFile: "test.cnx",
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.CNext,
        isExported: true,
      };
    }

    it("should output enums before structs (forward declarations)", () => {
      // Symbols in any order - generator should reorder them
      // Without typeInput, structs become forward declarations
      const symbols = [makeStructSymbol("MyStruct"), makeEnumSymbol("MyEnum")];
      const header = generator.generate(symbols, "test.h");

      const enumIndex = header.indexOf("/* Enumerations */");
      // Without typeInput, structs are output as "Forward declarations"
      const structIndex = header.indexOf("/* Forward declarations */");

      expect(enumIndex).toBeGreaterThan(-1);
      expect(structIndex).toBeGreaterThan(-1);
      expect(enumIndex).toBeLessThan(structIndex);
    });

    it("should output enums before structs even when struct is defined first", () => {
      // Struct defined before enum in source - still should output enum first
      const symbols = [
        makeStructSymbol("TPressureInputConfig"),
        makeEnumSymbol("EPressureType"),
        makeStructSymbol("TDeviceStatus"),
        makeEnumSymbol("EDeviceState"),
      ];
      const header = generator.generate(symbols, "test.h");

      const enumIndex = header.indexOf("/* Enumerations */");
      const structIndex = header.indexOf("/* Forward declarations */");

      expect(enumIndex).toBeGreaterThan(-1);
      expect(structIndex).toBeGreaterThan(-1);
      expect(enumIndex).toBeLessThan(structIndex);
    });
  });

  describe("regular type handling (non-string)", () => {
    it("should handle primitive types normally", () => {
      const symbols = [makeVarSymbol("count", "u32")];
      const header = generator.generate(symbols, "test.h");

      expect(header).toContain("extern uint32_t count;");
    });

    it("should handle primitive arrays normally", () => {
      const symbols = [
        makeVarSymbol("data", "u8", {
          isArray: true,
          arrayDimensions: ["256"],
        }),
      ];
      const header = generator.generate(symbols, "test.h");

      expect(header).toContain("extern uint8_t data[256];");
    });

    it("should handle user-defined types", () => {
      const symbols = [makeVarSymbol("config", "Configuration")];
      const header = generator.generate(symbols, "test.h");

      expect(header).toContain("extern Configuration config;");
    });
  });
});
