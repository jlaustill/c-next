/**
 * Unit tests for BaseHeaderGenerator and its subclasses
 */

import { describe, it, expect } from "vitest";
import CHeaderGenerator from "../CHeaderGenerator";
import CppHeaderGenerator from "../CppHeaderGenerator";
import IHeaderSymbol from "../types/IHeaderSymbol";

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
    isCallbackPointer?: boolean;
    isCallbackConst?: boolean;
  }>,
): IHeaderSymbol {
  return {
    name,
    kind: "function",
    type,
    sourceFile: "test.cnx",
    sourceLine: 1,
    isExported: true,
    parameters: parameters.map((p) => ({
      name: p.name,
      type: p.type,
      isConst: p.isConst ?? false,
      isAutoConst: p.isAutoConst ?? false,
      isArray: p.isArray ?? false,
      arrayDimensions: p.arrayDimensions,
      isCallbackPointer: p.isCallbackPointer,
      isCallbackConst: p.isCallbackConst,
    })),
  };
}

describe("BaseHeaderGenerator", () => {
  describe("CHeaderGenerator", () => {
    it("should generate pointer syntax for struct parameters", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("processData", "void", [
          { name: "data", type: "MyStruct" },
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void processData(MyStruct* data);");
    });

    it("should pass primitives by value when specified", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
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
      const symbols: IHeaderSymbol[] = [
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
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("processData", "void", [
          { name: "data", type: "MyStruct" },
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("void processData(MyStruct& data);");
    });

    it("should handle const parameters with reference syntax", () => {
      const generator = new CppHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
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
      const symbols: IHeaderSymbol[] = [
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
      const symbols: IHeaderSymbol[] = [
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
      const symbols: IHeaderSymbol[] = [
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
      const symbols: IHeaderSymbol[] = [];

      const result = generator.generate(symbols, "my_module.h");

      expect(result).toContain("#ifndef MY_MODULE_H");
      expect(result).toContain("#define MY_MODULE_H");
      expect(result).toContain("#endif");
    });

    it("should generate C++ extern wrapper", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("#ifdef __cplusplus");
      expect(result).toContain('extern "C" {');
    });

    it("should handle ISR function pointer type as pass-by-value", () => {
      const cGenerator = new CHeaderGenerator();
      const cppGenerator = new CppHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
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
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("processData", "void", [
          { name: "data", type: "MyStruct", isAutoConst: true },
        ]),
      ];

      const result = cGenerator.generate(symbols, "test.h");

      expect(result).toContain("void processData(const MyStruct* data);");
    });
  });

  describe("Callback-compatible functions (Issue #914)", () => {
    it("should use pointer for primitive param when isCallbackPointer is set (C mode)", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("Renderer_flush", "void", [
          { name: "buf", type: "u8", isCallbackPointer: true },
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("uint8_t* buf");
    });

    it("should use pointer for primitive param when isCallbackPointer is set (C++ mode)", () => {
      const generator = new CppHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("Renderer_flush", "void", [
          { name: "buf", type: "u8", isCallbackPointer: true },
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      // Must use * not & because headers are wrapped in extern "C"
      expect(result).toContain("uint8_t* buf");
    });

    it("should use const pointer for struct param with isCallbackConst (C mode)", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("Renderer_flush", "void", [
          {
            name: "area",
            type: "rect_t",
            isCallbackPointer: true,
            isCallbackConst: true,
          },
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain("const rect_t* area");
    });

    it("should use non-const pointer for struct param without isCallbackConst (C++ mode)", () => {
      const generator = new CppHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("Renderer_flush", "void", [
          { name: "w", type: "widget_t", isCallbackPointer: true },
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      // Must use * not & for callback params
      expect(result).toContain("widget_t* w");
    });

    it("should handle mixed callback and non-callback params", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("Renderer_flush", "void", [
          { name: "w", type: "widget_t", isCallbackPointer: true },
          {
            name: "area",
            type: "rect_t",
            isCallbackPointer: true,
            isCallbackConst: true,
          },
          { name: "buf", type: "u8", isCallbackPointer: true },
        ]),
      ];

      const result = generator.generate(symbols, "test.h");

      expect(result).toContain(
        "void Renderer_flush(widget_t* w, const rect_t* area, uint8_t* buf);",
      );
    });
  });
});
