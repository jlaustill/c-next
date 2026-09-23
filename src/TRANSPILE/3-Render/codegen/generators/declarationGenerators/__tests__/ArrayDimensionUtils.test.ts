/**
 * Unit tests for the array dimension renderers.
 *
 * #1445 box 3: they take planned dimensions and a capacity, so these state
 * those directly rather than through `as never` mock contexts and a mock
 * orchestrator whose two methods had to be read backwards to see which branch
 * a case was exercising.
 *
 * What moved out with the contexts is `CodeGenerator.planArrayTypeDimensions`
 * -- the fold-or-generate decision (Issue #1159) -- which the 1259 integration
 * fixtures exercise.
 */
import { describe, it, expect } from "vitest";
import ArrayDimensionUtils from "../ArrayDimensionUtils";
import type IPlannedDimension from "../../../types/IPlannedDimension";

/** A sized dimension. */
function sized(text: string): IPlannedDimension {
  return { renderSize: () => text };
}

/** The unsized `[]`. */
const UNSIZED: IPlannedDimension = { renderSize: null };

describe("ArrayDimensionUtils", () => {
  describe("renderArrayTypeDimensions", () => {
    it("returns empty string when the type is not an array type", () => {
      expect(ArrayDimensionUtils.renderArrayTypeDimensions(null)).toBe("");
    });

    it("returns [] for an unsized dimension", () => {
      expect(ArrayDimensionUtils.renderArrayTypeDimensions([UNSIZED])).toBe(
        "[]",
      );
    });

    it("renders a sized dimension", () => {
      expect(ArrayDimensionUtils.renderArrayTypeDimensions([sized("16")])).toBe(
        "[16]",
      );
    });

    /**
     * Issue #1159: the planner folds a compile-time constant to its value and
     * falls back to expression generation otherwise. Either way it arrives
     * here as text, which is the point of the split -- this renderer cannot
     * tell them apart and has no reason to.
     */
    it("renders a non-constant dimension as whatever it resolved to", () => {
      expect(
        ArrayDimensionUtils.renderArrayTypeDimensions([sized("BUFFER_SIZE")]),
      ).toBe("[BUFFER_SIZE]");
    });

    it("renders every dimension, in order", () => {
      expect(
        ArrayDimensionUtils.renderArrayTypeDimensions([sized("4"), sized("8")]),
      ).toBe("[4][8]");
    });

    it("mixes sized and unsized dimensions", () => {
      expect(
        ArrayDimensionUtils.renderArrayTypeDimensions([UNSIZED, sized("4")]),
      ).toBe("[][4]");
    });

    it("renders each size exactly once", () => {
      let renders = 0;
      const counting: IPlannedDimension = {
        renderSize: () => {
          renders += 1;
          return "4";
        },
      };

      ArrayDimensionUtils.renderArrayTypeDimensions([counting, counting]);

      expect(renders).toBe(2);
    });

    it("renders nothing for an empty dimension list", () => {
      expect(ArrayDimensionUtils.renderArrayTypeDimensions([])).toBe("");
    });
  });

  describe("renderStringCapacityDimension", () => {
    it("returns empty string when the type is not a bounded string", () => {
      expect(ArrayDimensionUtils.renderStringCapacityDimension(null)).toBe("");
    });

    it.each([
      [32, "[33]"],
      [8, "[9]"],
      [64, "[65]"],
      [255, "[256]"],
    ])("adds the null terminator to capacity %i", (capacity, expected) => {
      expect(ArrayDimensionUtils.renderStringCapacityDimension(capacity)).toBe(
        expected,
      );
    });
  });
});
