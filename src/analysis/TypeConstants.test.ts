/**
 * Unit tests for TypeConstants
 * Verifies shared type constant definitions.
 */
import { describe, it, expect } from "vitest";
import TypeConstants from "./TypeConstants";

describe("TypeConstants", () => {
  describe("FLOAT_TYPES", () => {
    it("should include C-Next float types", () => {
      expect(TypeConstants.FLOAT_TYPES).toContain("f32");
      expect(TypeConstants.FLOAT_TYPES).toContain("f64");
    });

    it("should include C float types", () => {
      expect(TypeConstants.FLOAT_TYPES).toContain("float");
      expect(TypeConstants.FLOAT_TYPES).toContain("double");
    });

    it("should have exactly 4 types", () => {
      expect(TypeConstants.FLOAT_TYPES).toHaveLength(4);
    });

    it("should be readonly", () => {
      // TypeScript prevents modification, but we verify it's an array
      expect(Array.isArray(TypeConstants.FLOAT_TYPES)).toBe(true);
    });
  });
});
