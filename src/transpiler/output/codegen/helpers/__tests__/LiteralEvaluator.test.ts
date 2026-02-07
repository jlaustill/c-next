import { describe, it, expect } from "vitest";
import LiteralEvaluator from "../LiteralEvaluator";

describe("LiteralEvaluator", () => {
  describe("parseLiteral", () => {
    it("should parse hex literals with lowercase prefix", () => {
      expect(LiteralEvaluator.parseLiteral("0xff")).toBe(255);
      expect(LiteralEvaluator.parseLiteral("0x10")).toBe(16);
      expect(LiteralEvaluator.parseLiteral("0x0")).toBe(0);
    });

    it("should parse hex literals with uppercase prefix", () => {
      expect(LiteralEvaluator.parseLiteral("0XFF")).toBe(255);
      expect(LiteralEvaluator.parseLiteral("0X10")).toBe(16);
    });

    it("should parse binary literals with lowercase prefix", () => {
      expect(LiteralEvaluator.parseLiteral("0b1010")).toBe(10);
      expect(LiteralEvaluator.parseLiteral("0b11111111")).toBe(255);
      expect(LiteralEvaluator.parseLiteral("0b0")).toBe(0);
    });

    it("should parse binary literals with uppercase prefix", () => {
      expect(LiteralEvaluator.parseLiteral("0B1010")).toBe(10);
      expect(LiteralEvaluator.parseLiteral("0B11111111")).toBe(255);
    });

    it("should parse decimal literals", () => {
      expect(LiteralEvaluator.parseLiteral("123")).toBe(123);
      expect(LiteralEvaluator.parseLiteral("0")).toBe(0);
      expect(LiteralEvaluator.parseLiteral("999")).toBe(999);
    });

    it("should parse decimal literals with type suffixes", () => {
      expect(LiteralEvaluator.parseLiteral("123u8")).toBe(123);
      expect(LiteralEvaluator.parseLiteral("255i32")).toBe(255);
      expect(LiteralEvaluator.parseLiteral("42u64")).toBe(42);
    });

    it("should return null for non-numeric text", () => {
      expect(LiteralEvaluator.parseLiteral("abc")).toBeNull();
      expect(LiteralEvaluator.parseLiteral("foo")).toBeNull();
    });
  });

  describe("applySign", () => {
    it("should return positive value when not negative", () => {
      expect(LiteralEvaluator.applySign(42, false)).toBe(42);
      expect(LiteralEvaluator.applySign(0, false)).toBe(0);
    });

    it("should return negative value when negative", () => {
      expect(LiteralEvaluator.applySign(42, true)).toBe(-42);
      expect(LiteralEvaluator.applySign(0, true)).toBe(-0);
    });

    it("should return null when value is null", () => {
      expect(LiteralEvaluator.applySign(null, false)).toBeNull();
      expect(LiteralEvaluator.applySign(null, true)).toBeNull();
    });
  });
});
