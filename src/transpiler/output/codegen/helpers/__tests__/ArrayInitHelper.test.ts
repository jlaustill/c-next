/**
 * Unit tests for ArrayInitHelper
 *
 * Issue #644: Tests for the extracted array initialization helper.
 * Migrated to use CodeGenState instead of constructor DI.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import ArrayInitHelper from "../ArrayInitHelper.js";
import CodeGenState from "../../../../state/CodeGenState.js";

/**
 * Default callbacks for testing.
 */
const defaultCallbacks = {
  generateExpression: vi.fn(() => "{1, 2, 3}"),
  getTypeName: vi.fn(() => "u8"),
  generateArrayDimensions: vi.fn(
    (dims: { expression: () => { getText: () => string } | null }[]) =>
      dims
        .map((d) => {
          const expr = d.expression();
          return expr ? `[${expr.getText()}]` : "[]";
        })
        .join(""),
  ),
};

describe("ArrayInitHelper", () => {
  beforeEach(() => {
    CodeGenState.reset();
    vi.clearAllMocks();
  });

  describe("processArrayInit", () => {
    it("returns null when not an array initializer", () => {
      const typeCtx = {} as never;
      const expression = { getText: () => "someVar" } as never;
      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never;

      // CodeGenState not modified by generateExpression mock (stays at 0)
      const result = ArrayInitHelper.processArrayInit(
        "arr",
        typeCtx,
        expression,
        arrayDims,
        false,
        3,
        defaultCallbacks,
      );

      expect(result).toBeNull();
    });

    it("handles size inference with array initializer", () => {
      // Add existing type to registry
      CodeGenState.setVariableTypeInfo("arr", {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        isConst: false,
      });

      const callbacks = {
        generateExpression: vi.fn(() => {
          // Simulate generateExpression setting array init state
          CodeGenState.lastArrayInitCount = 3;
          return "{1, 2, 3}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => ""),
      };

      const typeCtx = {} as never;
      const expression = { getText: () => "[1, 2, 3]" } as never;
      const arrayDims = [{ expression: () => null }] as never; // Empty dimension

      const result = ArrayInitHelper.processArrayInit(
        "arr",
        typeCtx,
        expression,
        arrayDims,
        true, // hasEmptyArrayDim
        null, // no declared size
        callbacks,
      );

      expect(result).not.toBeNull();
      expect(result!.isArrayInit).toBe(true);
      expect(result!.dimensionSuffix).toBe("[3]");
      expect(result!.initValue).toBe("{1, 2, 3}");
      expect(CodeGenState.localArrays.has("arr")).toBe(true);
    });

    it("asserts, since #1322, that the fill-all form never reaches an inferred size (E0876 owns it)", () => {
      const callbacks = {
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayFillValue = "0";
          return "{0}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => ""),
      };

      const typeCtx = {} as never;
      const expression = { getText: () => "[0*]" } as never;
      const arrayDims = [{ expression: () => null }] as never;

      expect(() =>
        ArrayInitHelper.processArrayInit(
          "arr",
          typeCtx,
          expression,
          arrayDims,
          true, // hasEmptyArrayDim
          null,
          callbacks,
        ),
      ).toThrow("E0876 rejects the fill-all form");
    });

    it("asserts, since #1322, that a short initializer never reaches emission (E0866 owns it)", () => {
      const callbacks = {
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayInitCount = 2; // Only 2 elements
          return "{1, 2}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => "[3]"),
      };

      const typeCtx = {} as never;
      const expression = { getText: () => "[1, 2]" } as never;
      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never;

      expect(() =>
        ArrayInitHelper.processArrayInit(
          "arr",
          typeCtx,
          expression,
          arrayDims,
          false,
          3, // declared size
          callbacks,
        ),
      ).toThrow("E0866 rejects 2 for [3]");
    });

    it("expands fill-all for non-zero values", () => {
      const callbacks = {
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayFillValue = "1";
          return "{1}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => "[3]"),
      };

      const typeCtx = {} as never;
      const expression = { getText: () => "[1*]" } as never;
      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never;

      const result = ArrayInitHelper.processArrayInit(
        "arr",
        typeCtx,
        expression,
        arrayDims,
        false,
        3,
        callbacks,
      );

      expect(result).not.toBeNull();
      expect(result!.initValue).toBe("{1, 1, 1}");
    });

    it("does not expand fill-all for zero value", () => {
      const callbacks = {
        generateExpression: vi.fn(() => {
          CodeGenState.lastArrayFillValue = "0";
          return "{0}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => "[3]"),
      };

      const typeCtx = {} as never;
      const expression = { getText: () => "[0*]" } as never;
      const arrayDims = [
        { expression: () => ({ getText: () => "3" }) },
      ] as never;

      const result = ArrayInitHelper.processArrayInit(
        "arr",
        typeCtx,
        expression,
        arrayDims,
        false,
        3,
        callbacks,
      );

      expect(result).not.toBeNull();
      expect(result!.initValue).toBe("{0}"); // Not expanded
    });
  });
});
