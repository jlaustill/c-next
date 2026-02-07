import { describe, it, expect } from "vitest";
import BooleanHelper from "../BooleanHelper.js";

describe("BooleanHelper", () => {
  describe("foldBooleanToInt", () => {
    it("converts 'true' to '1'", () => {
      expect(BooleanHelper.foldBooleanToInt("true")).toBe("1");
    });

    it("converts 'false' to '0'", () => {
      expect(BooleanHelper.foldBooleanToInt("false")).toBe("0");
    });

    it("wraps other expressions in ternary", () => {
      expect(BooleanHelper.foldBooleanToInt("isEnabled")).toBe(
        "(isEnabled ? 1 : 0)",
      );
    });

    it("wraps complex expressions in ternary", () => {
      expect(BooleanHelper.foldBooleanToInt("a && b")).toBe("(a && b ? 1 : 0)");
    });

    it("wraps comparison expressions in ternary", () => {
      expect(BooleanHelper.foldBooleanToInt("x > 5")).toBe("(x > 5 ? 1 : 0)");
    });
  });

  describe("isBooleanLiteral", () => {
    it("returns true for 'true'", () => {
      expect(BooleanHelper.isBooleanLiteral("true")).toBe(true);
    });

    it("returns true for 'false'", () => {
      expect(BooleanHelper.isBooleanLiteral("false")).toBe(true);
    });

    it("returns false for other expressions", () => {
      expect(BooleanHelper.isBooleanLiteral("isEnabled")).toBe(false);
    });

    it("returns false for '1'", () => {
      expect(BooleanHelper.isBooleanLiteral("1")).toBe(false);
    });

    it("returns false for '0'", () => {
      expect(BooleanHelper.isBooleanLiteral("0")).toBe(false);
    });
  });

  describe("booleanLiteralToInt", () => {
    it("converts 'true' to '1'", () => {
      expect(BooleanHelper.booleanLiteralToInt("true")).toBe("1");
    });

    it("converts 'false' to '0'", () => {
      expect(BooleanHelper.booleanLiteralToInt("false")).toBe("0");
    });

    it("returns null for non-boolean expressions", () => {
      expect(BooleanHelper.booleanLiteralToInt("isEnabled")).toBeNull();
    });

    it("returns null for numeric strings", () => {
      expect(BooleanHelper.booleanLiteralToInt("1")).toBeNull();
    });
  });
});
