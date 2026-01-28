import { describe, it, expect } from "vitest";
import BinaryExprUtils from "../BinaryExprUtils";

describe("BinaryExprUtils", () => {
  describe("tryParseNumericLiteral", () => {
    it("parses decimal integers", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("42")).toBe(42);
      expect(BinaryExprUtils.tryParseNumericLiteral("0")).toBe(0);
      expect(BinaryExprUtils.tryParseNumericLiteral("123456")).toBe(123456);
    });

    it("parses negative decimal integers", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("-1")).toBe(-1);
      expect(BinaryExprUtils.tryParseNumericLiteral("-42")).toBe(-42);
    });

    it("parses hex literals (0x prefix)", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("0xFF")).toBe(255);
      expect(BinaryExprUtils.tryParseNumericLiteral("0x0")).toBe(0);
      expect(BinaryExprUtils.tryParseNumericLiteral("0xDEAD")).toBe(0xdead);
      expect(BinaryExprUtils.tryParseNumericLiteral("0Xff")).toBe(255);
    });

    it("parses binary literals (0b prefix)", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("0b1010")).toBe(10);
      expect(BinaryExprUtils.tryParseNumericLiteral("0b0")).toBe(0);
      expect(BinaryExprUtils.tryParseNumericLiteral("0B1111")).toBe(15);
    });

    it("trims whitespace", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("  42  ")).toBe(42);
      expect(BinaryExprUtils.tryParseNumericLiteral("\t0xFF\n")).toBe(255);
    });

    it("returns undefined for non-numeric strings", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("abc")).toBeUndefined();
      expect(BinaryExprUtils.tryParseNumericLiteral("x + 1")).toBeUndefined();
      expect(BinaryExprUtils.tryParseNumericLiteral("")).toBeUndefined();
      expect(BinaryExprUtils.tryParseNumericLiteral("12.5")).toBeUndefined();
    });

    it("returns undefined for invalid hex/binary", () => {
      expect(BinaryExprUtils.tryParseNumericLiteral("0xGG")).toBeUndefined();
      expect(BinaryExprUtils.tryParseNumericLiteral("0b123")).toBeUndefined();
    });
  });

  describe("tryFoldConstants", () => {
    it("folds addition", () => {
      expect(BinaryExprUtils.tryFoldConstants(["2", "3"], ["+"])).toBe(5);
      expect(
        BinaryExprUtils.tryFoldConstants(["1", "2", "3"], ["+", "+"]),
      ).toBe(6);
    });

    it("folds subtraction", () => {
      expect(BinaryExprUtils.tryFoldConstants(["10", "3"], ["-"])).toBe(7);
      expect(
        BinaryExprUtils.tryFoldConstants(["10", "3", "2"], ["-", "-"]),
      ).toBe(5);
    });

    it("folds multiplication", () => {
      expect(BinaryExprUtils.tryFoldConstants(["4", "5"], ["*"])).toBe(20);
      expect(
        BinaryExprUtils.tryFoldConstants(["2", "3", "4"], ["*", "*"]),
      ).toBe(24);
    });

    it("folds division with truncation toward zero", () => {
      expect(BinaryExprUtils.tryFoldConstants(["10", "3"], ["/"])).toBe(3);
      expect(BinaryExprUtils.tryFoldConstants(["7", "2"], ["/"])).toBe(3);
      expect(BinaryExprUtils.tryFoldConstants(["-7", "2"], ["/"])).toBe(-3);
    });

    it("folds modulo", () => {
      expect(BinaryExprUtils.tryFoldConstants(["10", "3"], ["%"])).toBe(1);
      expect(BinaryExprUtils.tryFoldConstants(["17", "5"], ["%"])).toBe(2);
    });

    it("folds mixed operations left-to-right", () => {
      expect(
        BinaryExprUtils.tryFoldConstants(["2", "3", "4"], ["+", "*"]),
      ).toBe(20);
      expect(
        BinaryExprUtils.tryFoldConstants(["10", "2", "3"], ["-", "+"]),
      ).toBe(11);
    });

    it("folds hex and binary literals", () => {
      expect(BinaryExprUtils.tryFoldConstants(["0xFF", "1"], ["+"])).toBe(256);
      expect(BinaryExprUtils.tryFoldConstants(["0b1010", "2"], ["*"])).toBe(20);
    });

    it("returns undefined for division by zero", () => {
      expect(
        BinaryExprUtils.tryFoldConstants(["10", "0"], ["/"]),
      ).toBeUndefined();
    });

    it("returns undefined for modulo by zero", () => {
      expect(
        BinaryExprUtils.tryFoldConstants(["10", "0"], ["%"]),
      ).toBeUndefined();
    });

    it("returns undefined when any operand is not numeric", () => {
      expect(
        BinaryExprUtils.tryFoldConstants(["x", "3"], ["+"]),
      ).toBeUndefined();
      expect(
        BinaryExprUtils.tryFoldConstants(["2", "y"], ["+"]),
      ).toBeUndefined();
      expect(
        BinaryExprUtils.tryFoldConstants(["a + b", "3"], ["+"]),
      ).toBeUndefined();
    });

    it("returns undefined for unknown operators", () => {
      expect(
        BinaryExprUtils.tryFoldConstants(["2", "3"], ["&"]),
      ).toBeUndefined();
      expect(
        BinaryExprUtils.tryFoldConstants(["2", "3"], ["<<"]),
      ).toBeUndefined();
    });
  });
});
