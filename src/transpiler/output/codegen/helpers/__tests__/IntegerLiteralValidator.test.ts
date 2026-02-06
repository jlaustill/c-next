import { describe, expect, it, vi } from "vitest";
import IntegerLiteralValidator from "../IntegerLiteralValidator";

describe("IntegerLiteralValidator", () => {
  describe("isIntegerLiteral", () => {
    it("returns true for decimal integers", () => {
      const validator = new IntegerLiteralValidator({
        isIntegerType: () => true,
        validateLiteralFitsType: vi.fn(),
        getExpressionType: () => null,
        validateTypeConversion: vi.fn(),
      });

      expect(validator.isIntegerLiteral("42")).toBe(true);
      expect(validator.isIntegerLiteral("-17")).toBe(true);
      expect(validator.isIntegerLiteral("0")).toBe(true);
    });

    it("returns true for hex literals", () => {
      const validator = new IntegerLiteralValidator({
        isIntegerType: () => true,
        validateLiteralFitsType: vi.fn(),
        getExpressionType: () => null,
        validateTypeConversion: vi.fn(),
      });

      expect(validator.isIntegerLiteral("0x2A")).toBe(true);
      expect(validator.isIntegerLiteral("0xFF")).toBe(true);
      expect(validator.isIntegerLiteral("0X1a2B")).toBe(true);
    });

    it("returns true for binary literals", () => {
      const validator = new IntegerLiteralValidator({
        isIntegerType: () => true,
        validateLiteralFitsType: vi.fn(),
        getExpressionType: () => null,
        validateTypeConversion: vi.fn(),
      });

      expect(validator.isIntegerLiteral("0b101010")).toBe(true);
      expect(validator.isIntegerLiteral("0B1111")).toBe(true);
    });

    it("returns false for non-literals", () => {
      const validator = new IntegerLiteralValidator({
        isIntegerType: () => true,
        validateLiteralFitsType: vi.fn(),
        getExpressionType: () => null,
        validateTypeConversion: vi.fn(),
      });

      expect(validator.isIntegerLiteral("foo")).toBe(false);
      expect(validator.isIntegerLiteral("a + b")).toBe(false);
      expect(validator.isIntegerLiteral("myVar")).toBe(false);
    });
  });

  describe("validateIntegerAssignment", () => {
    it("skips validation for non-integer types", () => {
      const validateLiteralFitsType = vi.fn();
      const validateTypeConversion = vi.fn();

      const validator = new IntegerLiteralValidator({
        isIntegerType: () => false,
        validateLiteralFitsType,
        getExpressionType: () => null,
        validateTypeConversion,
      });

      validator.validateIntegerAssignment("f32", "3.14", 1, 0);

      expect(validateLiteralFitsType).not.toHaveBeenCalled();
      expect(validateTypeConversion).not.toHaveBeenCalled();
    });

    it("validates literal fits type for integer literals", () => {
      const validateLiteralFitsType = vi.fn();

      const validator = new IntegerLiteralValidator({
        isIntegerType: () => true,
        validateLiteralFitsType,
        getExpressionType: () => null,
        validateTypeConversion: vi.fn(),
      });

      validator.validateIntegerAssignment("u8", "42", 1, 0);

      expect(validateLiteralFitsType).toHaveBeenCalledWith("42", "u8");
    });

    it("validates type conversion for non-literal expressions", () => {
      const validateTypeConversion = vi.fn();

      const validator = new IntegerLiteralValidator({
        isIntegerType: () => true,
        validateLiteralFitsType: vi.fn(),
        getExpressionType: () => "i32",
        validateTypeConversion,
      });

      validator.validateIntegerAssignment("u8", "myVar", 1, 0);

      expect(validateTypeConversion).toHaveBeenCalledWith("u8", "i32");
    });

    it("throws error with location for literal validation failure", () => {
      const validator = new IntegerLiteralValidator({
        isIntegerType: () => true,
        validateLiteralFitsType: () => {
          throw new Error("Value 300 overflows u8");
        },
        getExpressionType: () => null,
        validateTypeConversion: vi.fn(),
      });

      expect(() =>
        validator.validateIntegerAssignment("u8", "300", 10, 5),
      ).toThrow("10:5 Value 300 overflows u8");
    });

    it("throws error with location for type conversion failure", () => {
      const validator = new IntegerLiteralValidator({
        isIntegerType: () => true,
        validateLiteralFitsType: vi.fn(),
        getExpressionType: () => "i32",
        validateTypeConversion: () => {
          throw new Error("Narrowing conversion from i32 to u8");
        },
      });

      expect(() =>
        validator.validateIntegerAssignment("u8", "myVar", 10, 5),
      ).toThrow("10:5 Narrowing conversion from i32 to u8");
    });

    it("preserves cause in thrown error", () => {
      const originalError = new Error("Original error");
      const validator = new IntegerLiteralValidator({
        isIntegerType: () => true,
        validateLiteralFitsType: () => {
          throw originalError;
        },
        getExpressionType: () => null,
        validateTypeConversion: vi.fn(),
      });

      try {
        validator.validateIntegerAssignment("u8", "300", 10, 5);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).cause).toBe(originalError);
      }
    });

    it("handles non-Error validation failures", () => {
      const validator = new IntegerLiteralValidator({
        isIntegerType: () => true,
        validateLiteralFitsType: () => {
          throw "string error";
        },
        getExpressionType: () => null,
        validateTypeConversion: vi.fn(),
      });

      expect(() =>
        validator.validateIntegerAssignment("u8", "300", 10, 5),
      ).toThrow("10:5 string error");
    });
  });
});
