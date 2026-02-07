/**
 * Unit tests for CastValidator
 * ADR-024: Integer cast validation
 * Issue #632: Float-to-integer clamping
 */

import { describe, it, expect } from "vitest";
import CastValidator from "../CastValidator.js";

describe("CastValidator", () => {
  describe("isIntegerType", () => {
    it("returns true for signed integers", () => {
      expect(CastValidator.isIntegerType("i8")).toBe(true);
      expect(CastValidator.isIntegerType("i16")).toBe(true);
      expect(CastValidator.isIntegerType("i32")).toBe(true);
      expect(CastValidator.isIntegerType("i64")).toBe(true);
    });

    it("returns true for unsigned integers", () => {
      expect(CastValidator.isIntegerType("u8")).toBe(true);
      expect(CastValidator.isIntegerType("u16")).toBe(true);
      expect(CastValidator.isIntegerType("u32")).toBe(true);
      expect(CastValidator.isIntegerType("u64")).toBe(true);
    });

    it("returns false for float types", () => {
      expect(CastValidator.isIntegerType("f32")).toBe(false);
      expect(CastValidator.isIntegerType("f64")).toBe(false);
    });

    it("returns false for other types", () => {
      expect(CastValidator.isIntegerType("bool")).toBe(false);
      expect(CastValidator.isIntegerType("void")).toBe(false);
      expect(CastValidator.isIntegerType("MyStruct")).toBe(false);
    });
  });

  describe("isFloatType", () => {
    it("returns true for float types", () => {
      expect(CastValidator.isFloatType("f32")).toBe(true);
      expect(CastValidator.isFloatType("f64")).toBe(true);
    });

    it("returns false for integer types", () => {
      expect(CastValidator.isFloatType("i32")).toBe(false);
      expect(CastValidator.isFloatType("u32")).toBe(false);
    });

    it("returns false for other types", () => {
      expect(CastValidator.isFloatType("bool")).toBe(false);
      expect(CastValidator.isFloatType("void")).toBe(false);
    });
  });

  describe("isSignedType", () => {
    it("returns true for signed types", () => {
      expect(CastValidator.isSignedType("i8")).toBe(true);
      expect(CastValidator.isSignedType("i16")).toBe(true);
      expect(CastValidator.isSignedType("i32")).toBe(true);
      expect(CastValidator.isSignedType("i64")).toBe(true);
    });

    it("returns false for unsigned types", () => {
      expect(CastValidator.isSignedType("u8")).toBe(false);
      expect(CastValidator.isSignedType("u16")).toBe(false);
      expect(CastValidator.isSignedType("u32")).toBe(false);
      expect(CastValidator.isSignedType("u64")).toBe(false);
    });
  });

  describe("isUnsignedType", () => {
    it("returns true for unsigned types", () => {
      expect(CastValidator.isUnsignedType("u8")).toBe(true);
      expect(CastValidator.isUnsignedType("u16")).toBe(true);
      expect(CastValidator.isUnsignedType("u32")).toBe(true);
      expect(CastValidator.isUnsignedType("u64")).toBe(true);
    });

    it("returns false for signed types", () => {
      expect(CastValidator.isUnsignedType("i8")).toBe(false);
      expect(CastValidator.isUnsignedType("i16")).toBe(false);
      expect(CastValidator.isUnsignedType("i32")).toBe(false);
      expect(CastValidator.isUnsignedType("i64")).toBe(false);
    });
  });

  describe("isNarrowingConversion", () => {
    it("returns true when target is smaller", () => {
      expect(CastValidator.isNarrowingConversion("u32", "u8")).toBe(true);
      expect(CastValidator.isNarrowingConversion("i64", "i32")).toBe(true);
      expect(CastValidator.isNarrowingConversion("u16", "u8")).toBe(true);
    });

    it("returns false when target is same size", () => {
      expect(CastValidator.isNarrowingConversion("u32", "u32")).toBe(false);
      expect(CastValidator.isNarrowingConversion("i16", "u16")).toBe(false);
    });

    it("returns false when target is larger", () => {
      expect(CastValidator.isNarrowingConversion("u8", "u32")).toBe(false);
      expect(CastValidator.isNarrowingConversion("i16", "i64")).toBe(false);
    });
  });

  describe("isSignConversion", () => {
    it("returns true for signed to unsigned", () => {
      expect(CastValidator.isSignConversion("i32", "u32")).toBe(true);
      expect(CastValidator.isSignConversion("i8", "u64")).toBe(true);
    });

    it("returns true for unsigned to signed", () => {
      expect(CastValidator.isSignConversion("u32", "i32")).toBe(true);
      expect(CastValidator.isSignConversion("u8", "i64")).toBe(true);
    });

    it("returns false for same signedness", () => {
      expect(CastValidator.isSignConversion("i32", "i64")).toBe(false);
      expect(CastValidator.isSignConversion("u8", "u32")).toBe(false);
    });
  });

  describe("validateIntegerCast", () => {
    it("throws for narrowing conversion", () => {
      expect(() => {
        CastValidator.validateIntegerCast("u32", "u8");
      }).toThrow(/Cannot cast u32 to u8 \(narrowing\)/);
    });

    it("throws for sign conversion", () => {
      expect(() => {
        CastValidator.validateIntegerCast("i32", "u32");
      }).toThrow(/Cannot cast i32 to u32 \(sign change\)/);
    });

    it("suggests bit indexing in narrowing error", () => {
      expect(() => {
        CastValidator.validateIntegerCast("u32", "u8");
      }).toThrow(/expr\[0, 8\]/);
    });

    it("suggests bit indexing in sign change error", () => {
      expect(() => {
        CastValidator.validateIntegerCast("i16", "u16");
      }).toThrow(/expr\[0, 16\]/);
    });

    it("does not throw for valid widening cast", () => {
      expect(() => {
        CastValidator.validateIntegerCast("u8", "u32");
      }).not.toThrow();
    });

    it("does not throw for same type cast", () => {
      expect(() => {
        CastValidator.validateIntegerCast("i32", "i32");
      }).not.toThrow();
    });

    it("does not throw for non-integer types", () => {
      // Float types should not trigger validation
      expect(() => {
        CastValidator.validateIntegerCast("f32", "i32");
      }).not.toThrow();
      expect(() => {
        CastValidator.validateIntegerCast("i32", "f32");
      }).not.toThrow();
    });
  });

  describe("requiresClampingCast", () => {
    it("returns true for float-to-integer", () => {
      expect(CastValidator.requiresClampingCast("f32", "i32")).toBe(true);
      expect(CastValidator.requiresClampingCast("f64", "u8")).toBe(true);
      expect(CastValidator.requiresClampingCast("f32", "i64")).toBe(true);
    });

    it("returns false for integer-to-integer", () => {
      expect(CastValidator.requiresClampingCast("i32", "i64")).toBe(false);
      expect(CastValidator.requiresClampingCast("u8", "u32")).toBe(false);
    });

    it("returns false for float-to-float", () => {
      expect(CastValidator.requiresClampingCast("f32", "f64")).toBe(false);
      expect(CastValidator.requiresClampingCast("f64", "f32")).toBe(false);
    });

    it("returns false for integer-to-float", () => {
      expect(CastValidator.requiresClampingCast("i32", "f32")).toBe(false);
      expect(CastValidator.requiresClampingCast("u64", "f64")).toBe(false);
    });

    it("returns false for null source type", () => {
      expect(CastValidator.requiresClampingCast(null, "i32")).toBe(false);
    });

    it("returns false when target is not integer", () => {
      expect(CastValidator.requiresClampingCast("f32", "bool")).toBe(false);
      expect(CastValidator.requiresClampingCast("f32", "MyType")).toBe(false);
    });
  });

  describe("getTypeWidth", () => {
    it("returns correct width for 8-bit types", () => {
      expect(CastValidator.getTypeWidth("u8")).toBe(8);
      expect(CastValidator.getTypeWidth("i8")).toBe(8);
    });

    it("returns correct width for 16-bit types", () => {
      expect(CastValidator.getTypeWidth("u16")).toBe(16);
      expect(CastValidator.getTypeWidth("i16")).toBe(16);
    });

    it("returns correct width for 32-bit types", () => {
      expect(CastValidator.getTypeWidth("u32")).toBe(32);
      expect(CastValidator.getTypeWidth("i32")).toBe(32);
    });

    it("returns correct width for 64-bit types", () => {
      expect(CastValidator.getTypeWidth("u64")).toBe(64);
      expect(CastValidator.getTypeWidth("i64")).toBe(64);
    });

    it("returns 0 for unknown types", () => {
      expect(CastValidator.getTypeWidth("UnknownType")).toBe(0);
      expect(CastValidator.getTypeWidth("void")).toBe(0);
    });

    it("returns 8 for bool (1 byte in TYPE_WIDTH)", () => {
      // Note: bool has an entry in TYPE_WIDTH as 8 bits
      expect(CastValidator.getTypeWidth("bool")).toBe(8);
    });
  });
});
