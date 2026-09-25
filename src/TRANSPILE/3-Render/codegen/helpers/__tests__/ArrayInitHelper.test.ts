/**
 * Unit tests for ArrayInitHelper
 *
 * Issue #644: Tests for the extracted array initialization helper.
 * Migrated to use RenderState instead of constructor DI.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import ArrayInitHelper from "../ArrayInitHelper";
import RenderState from "../../../RenderState";

/**
 * Default callbacks for testing.
 */
const defaultCallbacks = {
  state: new RenderState(),
  generateExpression: vi.fn(() => "{1, 2, 3}"),
  getTypeName: vi.fn(() => "u8"),
  // #1445: a thunk now. It used to compute the suffix from fake dimension
  // nodes; the helper never read them, so the fake only ever fed this mock.
  generateArrayDimensions: vi.fn(() => "[3]"),
};

let state: RenderState;

describe("ArrayInitHelper", () => {
  beforeEach(() => {
    state = new RenderState();
    vi.clearAllMocks();
  });

  describe("processArrayInit", () => {
    it("returns null when not an array initializer", () => {
      // RenderState not modified by generateExpression mock (stays at 0)
      const result = ArrayInitHelper.processArrayInit(
        "arr",
        false,
        3,
        defaultCallbacks,
        state,
      );

      expect(result).toBeNull();
    });

    it("handles size inference with array initializer", () => {
      // Add existing type to registry
      state.setVariableTypeInfo("arr", {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        isConst: false,
      });

      const callbacks = {
        state: new RenderState(),
        generateExpression: vi.fn(() => {
          // Simulate generateExpression setting array init state
          state.lastArrayInitCount = 3;
          return "{1, 2, 3}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => ""),
      };

      const result = ArrayInitHelper.processArrayInit(
        "arr",
        true, // hasEmptyArrayDim
        null, // no declared size
        callbacks,
        state,
      );

      expect(result).not.toBeNull();
      expect(result!.isArrayInit).toBe(true);
      expect(result!.dimensionSuffix).toBe("[3]");
      expect(result!.initValue).toBe("{1, 2, 3}");
      expect(state.localArrays.has("arr")).toBe(true);
    });

    it("asserts, since #1322, that the fill-all form never reaches an inferred size (E0876 owns it)", () => {
      const callbacks = {
        state: new RenderState(),
        generateExpression: vi.fn(() => {
          state.lastArrayFillValue = "0";
          return "{0}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => ""),
      };

      expect(() =>
        ArrayInitHelper.processArrayInit(
          "arr",
          true, // hasEmptyArrayDim
          null,
          callbacks,
          state,
        ),
      ).toThrow("E0876 rejects the fill-all form");
    });

    it("asserts, since #1322, that a short initializer never reaches emission (E0866 owns it)", () => {
      const callbacks = {
        state: new RenderState(),
        generateExpression: vi.fn(() => {
          state.lastArrayInitCount = 2; // Only 2 elements
          return "{1, 2}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => "[3]"),
      };

      expect(() =>
        ArrayInitHelper.processArrayInit(
          "arr",
          false,
          3, // declared size
          callbacks,
          state,
        ),
      ).toThrow("E0866 rejects 2 for [3]");
    });

    it("expands fill-all for non-zero values", () => {
      const callbacks = {
        state: new RenderState(),
        generateExpression: vi.fn(() => {
          state.lastArrayFillValue = "1";
          return "{1}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => "[3]"),
      };

      const result = ArrayInitHelper.processArrayInit(
        "arr",
        false,
        3,
        callbacks,
        state,
      );

      expect(result).not.toBeNull();
      expect(result!.initValue).toBe("{1, 1, 1}");
    });

    it("does not expand fill-all for zero value", () => {
      const callbacks = {
        state: new RenderState(),
        generateExpression: vi.fn(() => {
          state.lastArrayFillValue = "0";
          return "{0}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => "[3]"),
      };

      const result = ArrayInitHelper.processArrayInit(
        "arr",
        false,
        3,
        callbacks,
        state,
      );

      expect(result).not.toBeNull();
      expect(result!.initValue).toBe("{0}"); // Not expanded
    });
  });
});
