/**
 * Unit tests for LiteralUtils
 * Tests literal parsing and floating-point type detection.
 */
import { describe, it, expect } from "vitest";
import LiteralUtils from "../LiteralUtils";

describe("LiteralUtils", () => {
  // ========================================================================
  // parseIntegerLiteral (Issue #455)
  // ========================================================================

  // ========================================================================
  // Literal Type Detection
  // ========================================================================

  // #1668: the one decision of whether a literal is floating, read from the
  // whole literal rather than from a suffix or a dot.
  describe("floatLiteralWidth", () => {
    it.each([
      ["2.5", 64],
      ["2.5f64", 64],
      ["2.5f32", 32],
      ["2.5F32", 32],
      ["1e5", 64],
      ["1e5f32", 32],
      ["1.5e-3", 64],
      ["0xFF32", null],
      ["0xABCDEF64", null],
      ["42", null],
      ["42u32", null],
      ["'.'", null],
      ['"2.5"', null],
      ["true", null],
    ])("%s -> %s", (text, expected) => {
      expect(LiteralUtils.floatLiteralWidth(text)).toBe(expected);
    });
  });

  describe("floatLiteralParts", () => {
    it.each([
      ["2.5f32", { whole: "2", fraction: "5", exponent: 0, width: 32 }],
      ["1.25e-3", { whole: "1", fraction: "25", exponent: -3, width: 64 }],
      ["1e5F32", { whole: "1", fraction: "", exponent: 5, width: 32 }],
      ["0xFF32", null],
      ["42", null],
    ])("%s", (text, expected) => {
      expect(LiteralUtils.floatLiteralParts(text)).toEqual(expected);
    });
  });

  describe("typeOf", () => {
    const mockLiteral = (text: string) => text;

    describe("boolean literals", () => {
      it("should return bool for true", () => {
        expect(LiteralUtils.typeOf(mockLiteral("true"))).toBe("bool");
      });

      it("should return bool for false", () => {
        expect(LiteralUtils.typeOf(mockLiteral("false"))).toBe("bool");
      });
    });

    describe("integer suffixes", () => {
      it("should detect u8 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("255u8"))).toBe("u8");
        expect(LiteralUtils.typeOf(mockLiteral("0U8"))).toBe("u8");
      });

      it("should detect u16 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("1000u16"))).toBe("u16");
      });

      it("should detect u32 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("1000000u32"))).toBe("u32");
      });

      it("should detect u64 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("1000000000u64"))).toBe("u64");
      });

      it("should detect i8 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("-50i8"))).toBe("i8");
        expect(LiteralUtils.typeOf(mockLiteral("50I8"))).toBe("i8");
      });

      it("should detect i16 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("1000i16"))).toBe("i16");
      });

      it("should detect i32 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("1000000i32"))).toBe("i32");
      });

      it("should detect i64 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("1000000000i64"))).toBe("i64");
      });
    });

    describe("float suffixes", () => {
      it("should detect f32 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("3.14f32"))).toBe("f32");
        expect(LiteralUtils.typeOf(mockLiteral("3.14F32"))).toBe("f32");
      });

      it("should detect f64 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("3.14159f64"))).toBe("f64");
        expect(LiteralUtils.typeOf(mockLiteral("3.14159F64"))).toBe("f64");
      });
    });

    describe("unsuffixed literals (MISRA 10.3 compliance)", () => {
      it("should return int for unsuffixed integer", () => {
        expect(LiteralUtils.typeOf(mockLiteral("42"))).toBe("int");
      });

      it("should return int for unsuffixed hex", () => {
        expect(LiteralUtils.typeOf(mockLiteral("0xFF"))).toBe("int");
      });

      it("should return int for a hex literal ending in F32 or F64 (#1668)", () => {
        expect(LiteralUtils.typeOf(mockLiteral("0xFF32"))).toBe("int");
        expect(LiteralUtils.typeOf(mockLiteral("0xABCDEF64"))).toBe("int");
      });

      it("should return f64 for unsuffixed float", () => {
        expect(LiteralUtils.typeOf(mockLiteral("3.14"))).toBe("f64");
      });
    });
  });

  describe("parseIntegerLiteral", () => {
    describe("decimal literals", () => {
      it("should parse simple decimal", () => {
        expect(LiteralUtils.parseIntegerLiteral("42")).toBe(42);
      });

      it("should parse zero", () => {
        expect(LiteralUtils.parseIntegerLiteral("0")).toBe(0);
      });

      it("should parse negative decimal", () => {
        expect(LiteralUtils.parseIntegerLiteral("-17")).toBe(-17);
      });

      it("should parse large decimal", () => {
        expect(LiteralUtils.parseIntegerLiteral("1000000")).toBe(1000000);
      });
    });

    describe("hex literals", () => {
      it("should parse hex with lowercase prefix", () => {
        expect(LiteralUtils.parseIntegerLiteral("0x10")).toBe(16);
      });

      it("should parse hex with uppercase prefix", () => {
        expect(LiteralUtils.parseIntegerLiteral("0X10")).toBe(16);
      });

      it("should parse hex with mixed case digits", () => {
        expect(LiteralUtils.parseIntegerLiteral("0xDeAdBeEf")).toBe(0xdeadbeef);
      });

      it("should parse hex zero", () => {
        expect(LiteralUtils.parseIntegerLiteral("0x0")).toBe(0);
      });

      it("should parse hex FF", () => {
        expect(LiteralUtils.parseIntegerLiteral("0xFF")).toBe(255);
      });
    });

    describe("binary literals", () => {
      it("should parse binary with lowercase prefix", () => {
        expect(LiteralUtils.parseIntegerLiteral("0b1010")).toBe(10);
      });

      it("should parse binary with uppercase prefix", () => {
        expect(LiteralUtils.parseIntegerLiteral("0B1010")).toBe(10);
      });

      it("should parse binary zero", () => {
        expect(LiteralUtils.parseIntegerLiteral("0b0")).toBe(0);
      });

      it("should parse binary one", () => {
        expect(LiteralUtils.parseIntegerLiteral("0b1")).toBe(1);
      });

      it("should parse 8-bit binary", () => {
        expect(LiteralUtils.parseIntegerLiteral("0b11111111")).toBe(255);
      });
    });

    describe("invalid inputs", () => {
      it("should return undefined for identifier", () => {
        expect(
          LiteralUtils.parseIntegerLiteral("DEVICE_COUNT"),
        ).toBeUndefined();
      });

      it("should return undefined for float", () => {
        expect(LiteralUtils.parseIntegerLiteral("3.14")).toBeUndefined();
      });

      it("should return undefined for string", () => {
        expect(LiteralUtils.parseIntegerLiteral('"hello"')).toBeUndefined();
      });

      it("should return undefined for expression", () => {
        expect(LiteralUtils.parseIntegerLiteral("2 + 2")).toBeUndefined();
      });

      it("should return undefined for empty string", () => {
        expect(LiteralUtils.parseIntegerLiteral("")).toBeUndefined();
      });
    });

    describe("whitespace handling", () => {
      it("should handle leading whitespace", () => {
        expect(LiteralUtils.parseIntegerLiteral("  42")).toBe(42);
      });

      it("should handle trailing whitespace", () => {
        expect(LiteralUtils.parseIntegerLiteral("42  ")).toBe(42);
      });

      it("should handle both leading and trailing whitespace", () => {
        expect(LiteralUtils.parseIntegerLiteral("  0xFF  ")).toBe(255);
      });
    });
  });

  // #1760 review: a fold has a value only when a double holds it exactly
  describe("exactIntegerLiteral", () => {
    it.each([
      ["9007199254740991", 9007199254740991],
      ["-9007199254740991", -9007199254740991],
      ["0x1FFFFFFFFFFFFF", 9007199254740991],
      // 2^53 + 1 parses to 2^53, and 2^53 is the first value it could be
      ["9007199254740993", undefined],
      ["9007199254740992", undefined],
      ["0xFFFFFFFFFFFFFFFF", undefined],
      ["N", undefined],
    ])("reads %j as %j", (text, value) => {
      expect(LiteralUtils.exactIntegerLiteral(text)).toBe(value);
    });

    it("says a computed value is exact only in the safe range", () => {
      expect(LiteralUtils.isExactInteger(2 ** 53 - 1)).toBe(true);
      expect(LiteralUtils.isExactInteger(2 ** 53)).toBe(false);
      expect(LiteralUtils.isExactInteger(Number.NaN)).toBe(false);
      expect(LiteralUtils.isExactInteger(1.5)).toBe(false);
      expect(LiteralUtils.isExactInteger(undefined)).toBe(false);
    });
  });

  // #1668: the one reading of an integer literal's value as written
  describe("hasLeadingZero (ADR-044: no octal literal, E0912)", () => {
    it.each([
      ["010", true],
      ["00", true],
      ["07u8", true],
      ["0", false],
      ["0u8", false],
      ["10", false],
    ])("%j -> %j", (text, expected) => {
      expect(LiteralUtils.hasLeadingZero(text)).toBe(expected);
    });
  });

  describe("integerValue", () => {
    it.each([
      ["9", 9],
      ["0", 0],
      ["9u8", 9],
      ["3i32", 3],
      ["0x1F", 31],
      ["0b101", 5],
      // ADR-044 has no octal literal: a leading zero is E0912, with no value
      ["010", null],
      ["010u8", null],
      ["1.5", null],
      ["true", null],
      ["N", null],
    ])("reads %j as %j", (text, value) => {
      expect(LiteralUtils.integerValue(text)).toBe(value);
    });
  });
});
