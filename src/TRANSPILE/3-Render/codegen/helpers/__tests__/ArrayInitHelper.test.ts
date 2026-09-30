/**
 * Unit tests for ArrayInitHelper
 *
 * Issue #644: Tests for the extracted array initialization helper.
 * Migrated to use TranspileState instead of constructor DI.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import ArrayInitHelper from "../ArrayInitHelper";
import TranspileState from "../../../../TranspileState";

/**
 * Default callbacks for testing.
 */
const defaultCallbacks = {
  state: new TranspileState(),
  generateExpression: vi.fn(() => "{1, 2, 3}"),
  getTypeName: vi.fn(() => "u8"),
  // #1445: a thunk now. It used to compute the suffix from fake dimension
  // nodes; the helper never read them, so the fake only ever fed this mock.
  generateArrayDimensions: vi.fn(() => "[3]"),
};

let state = new TranspileState();

describe("ArrayInitHelper", () => {
  beforeEach(() => {
    state = new TranspileState();
    vi.clearAllMocks();
  });

  describe("processArrayInit", () => {
    it("returns null when not an array initializer", () => {
      // TranspileState not modified by generateExpression mock (stays at 0)
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
      const callbacks = {
        state: new TranspileState(),
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
        3, // #1664 box 3: the size 1.3 counted, the one the `.h` states
        callbacks,
        state,
      );

      expect(result).not.toBeNull();
      expect(result!.isArrayInit).toBe(true);
      expect(result!.dimensionSuffix).toBe("[3]");
      expect(result!.initValue).toBe("{1, 2, 3}");
    });

    it("asserts, since #1322, that the fill-all form never reaches an inferred size (E0876 owns it)", () => {
      const callbacks = {
        state: new TranspileState(),
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

    it("takes an inferred size from the declaration, and asserts the rendered list agrees (#1664 box 3)", () => {
      // The `.h` is written from the size 1.3 counted. Render used to count
      // the elements it had just rendered -- a second derivation that emitted
      // `n[2]` against the header's `n[2][3]` for `u8[][3] n` (#1822).
      const callbacks = {
        state: new TranspileState(),
        generateExpression: vi.fn(() => {
          state.lastArrayInitCount = 3;
          return "{1, 2, 3}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => ""),
      };

      expect(() =>
        ArrayInitHelper.processArrayInit("arr", true, 4, callbacks, state),
      ).toThrow("1.3 counted [4] for 'arr' but 3 element(s) rendered");
    });

    it("asserts that an inferred size reaches render with the declaration's count (#1664 box 3)", () => {
      const callbacks = {
        state: new TranspileState(),
        generateExpression: vi.fn(() => {
          state.lastArrayInitCount = 3;
          return "{1, 2, 3}";
        }),
        getTypeName: vi.fn(() => "u8"),
        generateArrayDimensions: vi.fn(() => ""),
      };

      expect(() =>
        ArrayInitHelper.processArrayInit("arr", true, null, callbacks, state),
      ).toThrow("a declaration fact that never reached render");
    });

    it("asserts, since #1322, that a short initializer never reaches emission (E0866 owns it)", () => {
      const callbacks = {
        state: new TranspileState(),
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
        state: new TranspileState(),
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
        state: new TranspileState(),
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
