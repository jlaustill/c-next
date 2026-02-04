/**
 * Unit tests for CppHeaderGenerator
 *
 * Tests C++ header generation with reference-based pass-by-reference semantics.
 */

import { describe, it, expect } from "vitest";
import CppHeaderGenerator from "../CppHeaderGenerator";
import ISymbol from "../../../../utils/types/ISymbol";
import ESymbolKind from "../../../../utils/types/ESymbolKind";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IParameterSymbol from "../../../../utils/types/IParameterSymbol";

// ============================================================================
// Test Helpers
// ============================================================================

function createFunctionSymbol(
  name: string,
  returnType: string,
  parameters: IParameterSymbol[] = [],
  isExported = true,
): ISymbol {
  return {
    name,
    kind: ESymbolKind.Function,
    type: returnType,
    parameters,
    isExported,
    sourceFile: "test.cnx",
    sourceLine: 1,
    sourceLanguage: ESourceLanguage.CNext,
  };
}

function createParam(
  name: string,
  type: string,
  options: Partial<IParameterSymbol> = {},
): IParameterSymbol {
  return {
    name,
    type,
    isConst: false,
    isAutoConst: false,
    isArray: false,
    ...options,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("CppHeaderGenerator", () => {
  describe("generate", () => {
    it("generates header with include guard", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("#ifndef TEST_H");
      expect(result).toContain("#define TEST_H");
      expect(result).toContain("#endif /* TEST_H */");
    });

    it("generates header with custom guard prefix", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [];

      const result = generator.generate(symbols, "module.h", {
        guardPrefix: "MY_PROJECT",
      });

      expect(result).toContain("#ifndef MY_PROJECT_MODULE_H");
      expect(result).toContain("#define MY_PROJECT_MODULE_H");
    });

    it("generates extern C wrapper for C++ compatibility", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("#ifdef __cplusplus");
      expect(result).toContain('extern "C" {');
      expect(result).toContain("#endif");
    });

    it("generates function prototypes", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [createFunctionSymbol("doSomething", "void")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void doSomething(void);");
    });

    it("filters to exported symbols when exportedOnly is true", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("publicFunc", "void", [], true),
        createFunctionSymbol("privateFunc", "void", [], false),
      ];

      const result = generator.generate(symbols, "test.h", {
        exportedOnly: true,
      });

      expect(result).toContain("publicFunc");
      expect(result).not.toContain("privateFunc");
    });

    it("includes all symbols when exportedOnly is false", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("publicFunc", "void", [], true),
        createFunctionSymbol("privateFunc", "void", [], false),
      ];

      const result = generator.generate(symbols, "test.h", {
        exportedOnly: false,
      });

      expect(result).toContain("publicFunc");
      expect(result).toContain("privateFunc");
    });
  });

  describe("function prototype generation", () => {
    it("generates void function with no parameters", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [createFunctionSymbol("init", "void")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void init(void);");
    });

    it("generates function with return type", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [createFunctionSymbol("getValue", "u32")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("uint32_t getValue(void);");
    });

    it("forces main to return int", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [createFunctionSymbol("main", "u32")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("int main(void);");
    });

    it("generates function with single parameter using reference", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("process", "void", [createParam("value", "u32")]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void process(uint32_t& value);");
    });

    it("generates function with const parameter", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("process", "void", [
          createParam("value", "u32", { isConst: true }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void process(const uint32_t& value);");
    });

    it("generates function with auto-const parameter", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("process", "void", [
          createParam("value", "u32", { isAutoConst: true }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void process(const uint32_t& value);");
    });

    it("generates function with multiple parameters", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("add", "u32", [
          createParam("a", "u32"),
          createParam("b", "u32"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("uint32_t add(uint32_t& a, uint32_t& b);");
    });

    it("uses pass-by-value for parameters in passByValueParams", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("process", "void", [createParam("value", "u32")]),
      ];
      const passByValueParams = new Map([["process", new Set(["value"])]]);

      const result = generator.generate(
        symbols,
        "test.h",
        {},
        undefined,
        passByValueParams,
      );

      expect(result).toContain("void process(uint32_t value);");
    });

    it("uses pass-by-value for float types (f32)", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("setFloat", "void", [createParam("value", "f32")]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void setFloat(float value);");
    });

    it("uses pass-by-value for float types (f64)", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("setDouble", "void", [
          createParam("value", "f64"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void setDouble(double value);");
    });

    it("uses pass-by-value for enum types", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("setState", "void", [
          createParam("state", "State"),
        ]),
      ];
      const allKnownEnums = new Set(["State"]);

      const result = generator.generate(
        symbols,
        "test.h",
        {},
        undefined,
        undefined,
        allKnownEnums,
      );

      expect(result).toContain("void setState(State state);");
    });

    it("uses pass-by-value for ISR type (function pointer)", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("setHandler", "void", [
          createParam("handler", "ISR"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void setHandler(ISR handler);");
    });

    it("generates array parameter with pointer syntax", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("processArray", "void", [
          createParam("data", "u8", { isArray: true, arrayDimensions: ["10"] }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void processArray(uint8_t data[10]);");
    });

    it("generates const array parameter", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("readArray", "void", [
          createParam("data", "u8", {
            isConst: true,
            isArray: true,
            arrayDimensions: ["10"],
          }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void readArray(const uint8_t data[10]);");
    });

    it("generates string array parameter as char*", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("processStrings", "void", [
          createParam("strings", "string", {
            isArray: true,
            arrayDimensions: ["5"],
          }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void processStrings(char* strings[5]);");
    });

    it("generates multi-dimensional array parameter", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("processMatrix", "void", [
          createParam("matrix", "u32", {
            isArray: true,
            arrayDimensions: ["3", "4"],
          }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void processMatrix(uint32_t matrix[3][4]);");
    });
  });

  describe("type mapping", () => {
    it("maps C-Next integer types to C types", () => {
      const generator = new CppHeaderGenerator();
      const types = [
        { cnx: "u8", c: "uint8_t" },
        { cnx: "u16", c: "uint16_t" },
        { cnx: "u32", c: "uint32_t" },
        { cnx: "u64", c: "uint64_t" },
        { cnx: "i8", c: "int8_t" },
        { cnx: "i16", c: "int16_t" },
        { cnx: "i32", c: "int32_t" },
        { cnx: "i64", c: "int64_t" },
      ];

      for (const { cnx, c } of types) {
        const symbols: ISymbol[] = [createFunctionSymbol("get", cnx)];
        const result = generator.generate(symbols, "test.h");
        expect(result).toContain(`${c} get(void);`);
      }
    });

    it("maps bool type", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [createFunctionSymbol("isReady", "bool")];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("bool isReady(void);");
    });

    it("maps float types", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("getF32", "f32"),
        createFunctionSymbol("getF64", "f64"),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("float getF32(void);");
      expect(result).toContain("double getF64(void);");
    });
  });

  describe("empty inputs", () => {
    it("generates valid header with no functions", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [];

      const result = generator.generate(symbols, "empty.h");

      expect(result).toContain("#ifndef EMPTY_H");
      expect(result).toContain("#define EMPTY_H");
      expect(result).toContain("#endif /* EMPTY_H */");
      expect(result).not.toContain("Function prototypes");
    });
  });
});
