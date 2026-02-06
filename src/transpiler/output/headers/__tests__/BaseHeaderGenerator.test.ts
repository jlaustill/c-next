/**
 * Unit tests for BaseHeaderGenerator and its subclasses
 */

import { describe, it, expect } from "vitest";
import CHeaderGenerator from "../CHeaderGenerator";
import CppHeaderGenerator from "../CppHeaderGenerator";
import ISymbol from "../../../../utils/types/ISymbol";
import ESymbolKind from "../../../../utils/types/ESymbolKind";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";

/**
 * Helper to create a minimal function symbol for tests
 */
function createFunctionSymbol(
  name: string,
  type: string,
  parameters: Array<{
    name: string;
    type: string;
    isConst?: boolean;
    isAutoConst?: boolean;
    isArray?: boolean;
    arrayDimensions?: string[];
  }>,
): ISymbol {
  return {
    name,
    kind: ESymbolKind.Function,
    type,
    sourceFile: "test.cnx",
    sourceLine: 1,
    sourceLanguage: ESourceLanguage.CNext,
    isExported: true,
    parameters: parameters.map((p) => ({
      name: p.name,
      type: p.type,
      isConst: p.isConst ?? false,
      isAutoConst: p.isAutoConst ?? false,
      isArray: p.isArray ?? false,
      arrayDimensions: p.arrayDimensions,
    })),
  };
}

describe("BaseHeaderGenerator", () => {
  describe("CHeaderGenerator", () => {
    it("should generate pointer syntax for struct parameters", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("processData", "void", [
          { name: "data", type: "MyStruct" },
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void processData(MyStruct* data);");
    });

    it("should pass primitives by value when specified", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("add", "i32", [
          { name: "a", type: "i32" },
          { name: "b", type: "i32" },
        ]),
      ];

      // Create pass-by-value params map
      const passByValueParams = new Map<string, ReadonlySet<string>>([
        ["add", new Set(["a", "b"])],
      ]);

      const result = generator.generate(
        symbols,
        "test.h",
        {},
        undefined,
        passByValueParams,
      );

      expect(result).toContain("int32_t add(int32_t a, int32_t b);");
    });

    it("should handle const parameters with pointer syntax", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("readData", "void", [
          { name: "data", type: "MyStruct", isConst: true },
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void readData(const MyStruct* data);");
    });
  });

  describe("CppHeaderGenerator", () => {
    it("should generate reference syntax for struct parameters", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("processData", "void", [
          { name: "data", type: "MyStruct" },
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void processData(MyStruct& data);");
    });

    it("should handle const parameters with reference syntax", () => {
      const generator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("readData", "void", [
          { name: "data", type: "MyStruct", isConst: true },
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void readData(const MyStruct& data);");
    });
  });

  describe("Shared behavior", () => {
    it("should handle float types as pass-by-value for both generators", () => {
      const cGenerator = new CHeaderGenerator();
      const cppGenerator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("calculate", "f32", [
          { name: "x", type: "f32" },
          { name: "y", type: "f64" },
        ]),
      ];

      const cResult = cGenerator.generate(symbols, "test.h");
      const cppResult = cppGenerator.generate(symbols, "test.h");

      expect(cResult).toContain("float calculate(float x, double y);");
      expect(cppResult).toContain("float calculate(float x, double y);");
    });

    it("should handle enum types as pass-by-value", () => {
      const cGenerator = new CHeaderGenerator();
      const cppGenerator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("setMode", "void", [
          { name: "mode", type: "Mode" },
        ]),
      ];

      const knownEnums = new Set(["Mode"]);

      const cResult = cGenerator.generate(
        symbols,
        "test.h",
        {},
        undefined,
        undefined,
        knownEnums,
      );
      const cppResult = cppGenerator.generate(
        symbols,
        "test.h",
        {},
        undefined,
        undefined,
        knownEnums,
      );

      expect(cResult).toContain("void setMode(Mode mode);");
      expect(cppResult).toContain("void setMode(Mode mode);");
    });

    it("should handle array parameters consistently", () => {
      const cGenerator = new CHeaderGenerator();
      const cppGenerator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("processArray", "void", [
          { name: "arr", type: "u8", isArray: true, arrayDimensions: ["10"] },
        ]),
      ];

      const cResult = cGenerator.generate(symbols, "test.h");
      const cppResult = cppGenerator.generate(symbols, "test.h");

      expect(cResult).toContain("void processArray(uint8_t arr[10]);");
      expect(cppResult).toContain("void processArray(uint8_t arr[10]);");
    });

    it("should generate header guards", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [];

      const result = generator.generate(symbols, "my_module.h");

      expect(result).toContain("#ifndef MY_MODULE_H");
      expect(result).toContain("#define MY_MODULE_H");
      expect(result).toContain("#endif");
    });

    it("should generate C++ extern wrapper", () => {
      const generator = new CHeaderGenerator();
      const symbols: ISymbol[] = [];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("#ifdef __cplusplus");
      expect(result).toContain('extern "C" {');
    });

    it("should handle ISR function pointer type as pass-by-value", () => {
      const cGenerator = new CHeaderGenerator();
      const cppGenerator = new CppHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("registerHandler", "void", [
          { name: "handler", type: "ISR" },
        ]),
      ];

      const cResult = cGenerator.generate(symbols, "test.h");
      const cppResult = cppGenerator.generate(symbols, "test.h");

      // ISR should not have * or & suffix
      expect(cResult).toContain("void registerHandler(ISR handler);");
      expect(cppResult).toContain("void registerHandler(ISR handler);");
    });

    it("should handle autoConst parameter modifier", () => {
      const cGenerator = new CHeaderGenerator();
      const symbols: ISymbol[] = [
        createFunctionSymbol("processData", "void", [
          { name: "data", type: "MyStruct", isAutoConst: true },
        ]),
      ];

      const result = cGenerator.generate(symbols, "test.h");

      expect(result).toContain("void processData(const MyStruct* data);");
    });
  });
});
