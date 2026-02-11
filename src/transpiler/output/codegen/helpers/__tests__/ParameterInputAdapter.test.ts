/**
 * Unit tests for ParameterInputAdapter
 *
 * Tests the adapter that normalizes AST and symbol data into IParameterInput.
 */

import { describe, it, expect } from "vitest";
import ParameterInputAdapter from "../ParameterInputAdapter";
import IParameterSymbol from "../../../../../utils/types/IParameterSymbol";

describe("ParameterInputAdapter", () => {
  describe("fromSymbol", () => {
    const defaultDeps = {
      mapType: (t: string) => {
        const map: Record<string, string> = {
          u8: "uint8_t",
          u16: "uint16_t",
          u32: "uint32_t",
          u64: "uint64_t",
          i32: "int32_t",
          f32: "float",
          f64: "double",
          bool: "bool",
          ISR: "ISR",
        };
        return map[t] ?? t;
      },
      isPassByValue: false,
      knownEnums: new Set<string>(),
    };

    it("converts basic primitive parameter", () => {
      const param: IParameterSymbol = {
        name: "value",
        type: "u32",
        isConst: false,
        isArray: false,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.name).toBe("value");
      expect(result.baseType).toBe("u32");
      expect(result.mappedType).toBe("uint32_t");
      expect(result.isConst).toBe(false);
      expect(result.isArray).toBe(false);
      expect(result.isString).toBe(false);
      expect(result.isPassByValue).toBe(false);
    });

    it("converts array parameter", () => {
      const param: IParameterSymbol = {
        name: "arr",
        type: "u32",
        isConst: false,
        isArray: true,
        arrayDimensions: ["10"],
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["10"]);
      expect(result.isString).toBe(false);
    });

    it("converts multi-dimensional array parameter", () => {
      const param: IParameterSymbol = {
        name: "matrix",
        type: "u8",
        isConst: false,
        isArray: true,
        arrayDimensions: ["4", "4"],
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["4", "4"]);
    });

    it("converts unbounded string array with isUnboundedString flag", () => {
      const param: IParameterSymbol = {
        name: "strings",
        type: "string",
        isConst: false,
        isArray: true,
        arrayDimensions: ["5"],
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(true);
      expect(result.isString).toBe(true);
      expect(result.isUnboundedString).toBe(true);
      expect(result.arrayDimensions).toEqual(["5"]);
      expect(result.mappedType).toBe("char");
    });

    it("converts bounded string array without isUnboundedString flag", () => {
      const param: IParameterSymbol = {
        name: "names",
        type: "string<32>",
        isConst: false,
        isArray: true,
        arrayDimensions: ["5", "33"],
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(true);
      expect(result.isString).toBe(true);
      expect(result.isUnboundedString).toBe(false);
      expect(result.arrayDimensions).toEqual(["5", "33"]);
      expect(result.mappedType).toBe("char");
    });

    it("converts non-array string parameter", () => {
      const param: IParameterSymbol = {
        name: "name",
        type: "string<32>",
        isConst: false,
        isArray: false,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(false);
      expect(result.isString).toBe(true);
      expect(result.mappedType).toBe("char");
    });

    it("detects ISR as pass-by-value", () => {
      const param: IParameterSymbol = {
        name: "handler",
        type: "ISR",
        isConst: false,
        isArray: false,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isPassByValue).toBe(true);
    });

    it("detects float types as pass-by-value", () => {
      const paramF32: IParameterSymbol = {
        name: "value",
        type: "f32",
        isConst: false,
        isArray: false,
      };

      const resultF32 = ParameterInputAdapter.fromSymbol(paramF32, defaultDeps);
      expect(resultF32.isPassByValue).toBe(true);

      const paramF64: IParameterSymbol = {
        name: "value",
        type: "f64",
        isConst: false,
        isArray: false,
      };

      const resultF64 = ParameterInputAdapter.fromSymbol(paramF64, defaultDeps);
      expect(resultF64.isPassByValue).toBe(true);
    });

    it("detects enum as pass-by-value", () => {
      const param: IParameterSymbol = {
        name: "status",
        type: "Status",
        isConst: false,
        isArray: false,
      };

      const deps = {
        ...defaultDeps,
        knownEnums: new Set(["Status"]),
      };

      const result = ParameterInputAdapter.fromSymbol(param, deps);

      expect(result.isPassByValue).toBe(true);
    });

    it("uses explicit pass-by-value from deps", () => {
      const param: IParameterSymbol = {
        name: "count",
        type: "u32",
        isConst: false,
        isArray: false,
      };

      const deps = {
        ...defaultDeps,
        isPassByValue: true,
      };

      const result = ParameterInputAdapter.fromSymbol(param, deps);

      expect(result.isPassByValue).toBe(true);
    });

    it("preserves const modifier", () => {
      const param: IParameterSymbol = {
        name: "value",
        type: "u32",
        isConst: true,
        isArray: false,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isConst).toBe(true);
    });

    it("preserves auto-const", () => {
      const param: IParameterSymbol = {
        name: "point",
        type: "Point",
        isConst: false,
        isArray: false,
        isAutoConst: true,
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isAutoConst).toBe(true);
    });

    it("defaults auto-const to false when not specified", () => {
      const param: IParameterSymbol = {
        name: "point",
        type: "Point",
        isConst: false,
        isArray: false,
        // isAutoConst not specified
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isAutoConst).toBe(false);
    });
  });
});
