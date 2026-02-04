/**
 * Unit tests for ArrayInitHelper
 *
 * Issue #644: Tests for the extracted array initialization helper.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import ArrayInitHelper from "../ArrayInitHelper.js";
import type TTypeInfo from "../../types/TTypeInfo.js";

describe("ArrayInitHelper", () => {
  let typeRegistry: Map<string, TTypeInfo>;
  let localArrays: Set<string>;
  let arrayInitState: {
    lastArrayInitCount: number;
    lastArrayFillValue: string | undefined;
  };
  let expectedType: string | null;
  let helper: ArrayInitHelper;

  beforeEach(() => {
    typeRegistry = new Map();
    localArrays = new Set();
    arrayInitState = {
      lastArrayInitCount: 0,
      lastArrayFillValue: undefined,
    };
    expectedType = null;

    helper = new ArrayInitHelper({
      typeRegistry,
      localArrays,
      arrayInitState,
      getExpectedType: () => expectedType,
      setExpectedType: (type) => {
        expectedType = type;
      },
      generateExpression: vi.fn(() => "{1, 2, 3}"),
      getTypeName: vi.fn(() => "u8"),
      generateArrayDimensions: vi.fn((dims) =>
        dims
          .map((d: { expression: () => { getText: () => string } | null }) => {
            const expr = d.expression();
            return expr ? `[${expr.getText()}]` : "[]";
          })
          .join(""),
      ),
    });
  });

  describe("processArrayInit", () => {
    it("returns null when not an array initializer", () => {
      const typeCtx = {} as never;
      const expression = { getText: () => "someVar" } as never;
      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never;

      // arrayInitState not modified by generateExpression mock
      const result = helper.processArrayInit(
        "arr",
        typeCtx,
        expression,
        arrayDims,
        false,
        3,
      );

      expect(result).toBeNull();
    });

    it("handles size inference with array initializer", () => {
      // Simulate generateExpression setting array init state
      helper = new ArrayInitHelper({
        typeRegistry,
        localArrays,
        arrayInitState,
        getExpectedType: () => expectedType,
        setExpectedType: (type) => {
          expectedType = type;
        },
        generateExpression: vi.fn(() => {
          arrayInitState.lastArrayInitCount = 3;
          return "{1, 2, 3}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => ""),
      });

      // Add existing type to registry
      typeRegistry.set("arr", {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        isConst: false,
      });

      const typeCtx = {} as never;
      const expression = { getText: () => "[1, 2, 3]" } as never;
      const arrayDims = [{ expression: () => null }] as never; // Empty dimension

      const result = helper.processArrayInit(
        "arr",
        typeCtx,
        expression,
        arrayDims,
        true, // hasEmptyArrayDim
        null, // no declared size
      );

      expect(result).not.toBeNull();
      expect(result!.isArrayInit).toBe(true);
      expect(result!.dimensionSuffix).toBe("[3]");
      expect(result!.initValue).toBe("{1, 2, 3}");
      expect(localArrays.has("arr")).toBe(true);
    });

    it("throws error for fill-all with empty dimension", () => {
      helper = new ArrayInitHelper({
        typeRegistry,
        localArrays,
        arrayInitState,
        getExpectedType: () => expectedType,
        setExpectedType: (type) => {
          expectedType = type;
        },
        generateExpression: vi.fn(() => {
          arrayInitState.lastArrayFillValue = "0";
          return "{0}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => ""),
      });

      const typeCtx = {} as never;
      const expression = { getText: () => "[0*]" } as never;
      const arrayDims = [{ expression: () => null }] as never;

      expect(() =>
        helper.processArrayInit(
          "arr",
          typeCtx,
          expression,
          arrayDims,
          true, // hasEmptyArrayDim
          null,
        ),
      ).toThrow("Fill-all syntax [0*] requires explicit array size");
    });

    it("throws error for array size mismatch", () => {
      helper = new ArrayInitHelper({
        typeRegistry,
        localArrays,
        arrayInitState,
        getExpectedType: () => expectedType,
        setExpectedType: (type) => {
          expectedType = type;
        },
        generateExpression: vi.fn(() => {
          arrayInitState.lastArrayInitCount = 2; // Only 2 elements
          return "{1, 2}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => "[3]"),
      });

      const typeCtx = {} as never;
      const expression = { getText: () => "[1, 2]" } as never;
      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never;

      expect(() =>
        helper.processArrayInit(
          "arr",
          typeCtx,
          expression,
          arrayDims,
          false,
          3, // declared size
        ),
      ).toThrow("Array size mismatch - declared [3] but got 2 elements");
    });

    it("expands fill-all for non-zero values", () => {
      helper = new ArrayInitHelper({
        typeRegistry,
        localArrays,
        arrayInitState,
        getExpectedType: () => expectedType,
        setExpectedType: (type) => {
          expectedType = type;
        },
        generateExpression: vi.fn(() => {
          arrayInitState.lastArrayFillValue = "1";
          return "{1}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => "[3]"),
      });

      const typeCtx = {} as never;
      const expression = { getText: () => "[1*]" } as never;
      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never;

      const result = helper.processArrayInit(
        "arr",
        typeCtx,
        expression,
        arrayDims,
        false,
        3,
      );

      expect(result).not.toBeNull();
      expect(result!.initValue).toBe("{1, 1, 1}");
    });

    it("does not expand fill-all for zero value", () => {
      helper = new ArrayInitHelper({
        typeRegistry,
        localArrays,
        arrayInitState,
        getExpectedType: () => expectedType,
        setExpectedType: (type) => {
          expectedType = type;
        },
        generateExpression: vi.fn(() => {
          arrayInitState.lastArrayFillValue = "0";
          return "{0}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => "[3]"),
      });

      const typeCtx = {} as never;
      const expression = { getText: () => "[0*]" } as never;
      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never;

      const result = helper.processArrayInit(
        "arr",
        typeCtx,
        expression,
        arrayDims,
        false,
        3,
      );

      expect(result).not.toBeNull();
      expect(result!.initValue).toBe("{0}"); // Not expanded
    });
  });
});
