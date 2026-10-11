/**
 * Unit tests for BitRangeHelper utility.
 * Tests bit range access code generation patterns.
 */
import { describe, it, expect } from "vitest";
import BitRangeHelper from "../BitRangeHelper";

describe("BitRangeHelper", () => {
  describe("getShadowVarName", () => {
    it("should prefix with __bits_", () => {
      expect(BitRangeHelper.getShadowVarName("value")).toBe("__bits_value");
      expect(BitRangeHelper.getShadowVarName("x")).toBe("__bits_x");
      expect(BitRangeHelper.getShadowVarName("myFloat")).toBe("__bits_myFloat");
    });
  });
});
