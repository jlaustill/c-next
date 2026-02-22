/**
 * Unit tests for ParameterSignatureBuilder
 *
 * Tests the stateless builder that generates C/C++ parameter signatures
 * from normalized IParameterInput.
 */

import { describe, it, expect } from "vitest";
import ParameterSignatureBuilder from "../ParameterSignatureBuilder";
import IParameterInput from "../../types/IParameterInput";

/**
 * Helper to create a minimal IParameterInput with defaults
 */
function createInput(overrides: Partial<IParameterInput>): IParameterInput {
  return {
    name: "param",
    baseType: "u32",
    mappedType: "uint32_t",
    isConst: false,
    isAutoConst: false,
    isArray: false,
    isCallback: false,
    isString: false,
    isPassByValue: false,
    isPassByReference: true,
    ...overrides,
  };
}

describe("ParameterSignatureBuilder", () => {
  describe("callback parameters", () => {
    it("generates callback typedef name", () => {
      const input = createInput({
        name: "onClick",
        baseType: "handleClick",
        isCallback: true,
        callbackTypedefName: "HandleClickCallback",
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("HandleClickCallback onClick");
    });
  });

  describe("array parameters", () => {
    it("generates single dimension array", () => {
      const input = createInput({
        name: "arr",
        baseType: "u32",
        mappedType: "uint32_t",
        isArray: true,
        arrayDimensions: ["10"],
        isAutoConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const uint32_t arr[10]");
    });

    it("generates multi-dimensional array", () => {
      const input = createInput({
        name: "matrix",
        baseType: "u8",
        mappedType: "uint8_t",
        isArray: true,
        arrayDimensions: ["4", "4"],
        isAutoConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const uint8_t matrix[4][4]");
    });

    it("generates bounded string array with capacity dimension", () => {
      const input = createInput({
        name: "names",
        baseType: "string<32>",
        mappedType: "char",
        isArray: true,
        arrayDimensions: ["5", "33"],
        isString: true,
        isAutoConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const char names[5][33]");
    });

    it("generates unbounded string array with char*", () => {
      const input = createInput({
        name: "strings",
        baseType: "string",
        mappedType: "char",
        isArray: true,
        arrayDimensions: ["5"],
        isString: true,
        isUnboundedString: true,
        isAutoConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const char* strings[5]");
    });

    it("omits auto-const for modified array parameter", () => {
      const input = createInput({
        name: "arr",
        baseType: "u32",
        mappedType: "uint32_t",
        isArray: true,
        arrayDimensions: ["10"],
        isAutoConst: false, // parameter is modified
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("uint32_t arr[10]");
    });
  });

  describe("pass-by-value parameters", () => {
    it("generates ISR parameter", () => {
      const input = createInput({
        name: "handler",
        baseType: "ISR",
        mappedType: "ISR",
        isPassByValue: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("ISR handler");
    });

    it("generates float parameter", () => {
      const input = createInput({
        name: "value",
        baseType: "f32",
        mappedType: "float",
        isPassByValue: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("float value");
    });

    it("generates enum parameter", () => {
      const input = createInput({
        name: "status",
        baseType: "Status",
        mappedType: "Status",
        isPassByValue: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("Status status");
    });

    it("preserves explicit const on pass-by-value", () => {
      const input = createInput({
        name: "value",
        baseType: "f32",
        mappedType: "float",
        isConst: true,
        isPassByValue: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const float value");
    });
  });

  describe("non-array string parameters", () => {
    it("generates string parameter as char*", () => {
      const input = createInput({
        name: "name",
        baseType: "string<32>",
        mappedType: "char",
        isString: true,
        isAutoConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const char* name");
    });

    it("omits auto-const for modified string parameter", () => {
      const input = createInput({
        name: "buffer",
        baseType: "string<64>",
        mappedType: "char",
        isString: true,
        isAutoConst: false, // parameter is modified
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("char* buffer");
    });
  });

  describe("pass-by-reference parameters", () => {
    it("generates struct parameter with pointer in C mode", () => {
      const input = createInput({
        name: "point",
        baseType: "Point",
        mappedType: "Point",
        isPassByReference: true,
        isAutoConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const Point* point");
    });

    it("generates struct parameter with reference in C++ mode", () => {
      const input = createInput({
        name: "point",
        baseType: "Point",
        mappedType: "Point",
        isPassByReference: true,
        isAutoConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "&");

      expect(result).toBe("const Point& point");
    });

    it("omits auto-const for modified struct parameter", () => {
      const input = createInput({
        name: "point",
        baseType: "Point",
        mappedType: "Point",
        isPassByReference: true,
        isAutoConst: false, // parameter is modified
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("Point* point");
    });

    it("generates primitive parameter with pointer", () => {
      const input = createInput({
        name: "value",
        baseType: "u32",
        mappedType: "uint32_t",
        isPassByReference: true,
        isAutoConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const uint32_t* value");
    });

    it("preserves explicit const with auto-const", () => {
      const input = createInput({
        name: "point",
        baseType: "Point",
        mappedType: "Point",
        isConst: true,
        isAutoConst: false, // explicit const already set
        isPassByReference: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const Point* point");
    });
  });

  describe("unknown type parameters", () => {
    it("generates unknown type as pass-by-value", () => {
      const input = createInput({
        name: "data",
        baseType: "UnknownType",
        mappedType: "UnknownType",
        isPassByReference: false,
        isPassByValue: false,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("UnknownType data");
    });

    it("preserves const on unknown type", () => {
      const input = createInput({
        name: "data",
        baseType: "UnknownType",
        mappedType: "UnknownType",
        isConst: true,
        isPassByReference: false,
        isPassByValue: false,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const UnknownType data");
    });
  });

  describe("callback-compatible parameters (Issue #895)", () => {
    it("forceConst adds const from typedef signature", () => {
      const input = createInput({
        name: "area",
        baseType: "rect_t",
        mappedType: "rect_t",
        isPassByReference: true,
        forcePointerSyntax: true,
        forceConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "&");

      // Should use pointer (not reference) and add const from typedef
      expect(result).toBe("const rect_t* area");
    });

    it("forcePointerSyntax uses pointer in C++ mode", () => {
      const input = createInput({
        name: "w",
        baseType: "widget_t",
        mappedType: "widget_t",
        isPassByReference: true,
        forcePointerSyntax: true,
      });

      const result = ParameterSignatureBuilder.build(input, "&");

      // Should use pointer even in C++ mode (& suffix)
      expect(result).toBe("widget_t* w");
    });

    it("forceConst without forcePointerSyntax still adds const", () => {
      const input = createInput({
        name: "data",
        baseType: "Data",
        mappedType: "Data",
        isPassByReference: true,
        forceConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const Data* data");
    });

    it("forceConst combines with forcePointerSyntax in C++ mode", () => {
      const input = createInput({
        name: "buf",
        baseType: "uint8_t",
        mappedType: "uint8_t",
        isPassByReference: true,
        forcePointerSyntax: true,
        forceConst: false, // typedef doesn't have const
      });

      const result = ParameterSignatureBuilder.build(input, "&");

      // No const, but still uses pointer
      expect(result).toBe("uint8_t* buf");
    });
  });
});
