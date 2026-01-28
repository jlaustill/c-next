import { describe, it, expect } from "vitest";
import TypeCheckUtils from "./TypeCheckUtils";

// ========================================================================
// isInteger
// ========================================================================
describe("TypeCheckUtils.isInteger", () => {
  it("returns true for u8", () => {
    expect(TypeCheckUtils.isInteger("u8")).toBe(true);
  });

  it("returns true for u16", () => {
    expect(TypeCheckUtils.isInteger("u16")).toBe(true);
  });

  it("returns true for u32", () => {
    expect(TypeCheckUtils.isInteger("u32")).toBe(true);
  });

  it("returns true for u64", () => {
    expect(TypeCheckUtils.isInteger("u64")).toBe(true);
  });

  it("returns true for i8", () => {
    expect(TypeCheckUtils.isInteger("i8")).toBe(true);
  });

  it("returns true for i16", () => {
    expect(TypeCheckUtils.isInteger("i16")).toBe(true);
  });

  it("returns true for i32", () => {
    expect(TypeCheckUtils.isInteger("i32")).toBe(true);
  });

  it("returns true for i64", () => {
    expect(TypeCheckUtils.isInteger("i64")).toBe(true);
  });

  it("returns false for f32", () => {
    expect(TypeCheckUtils.isInteger("f32")).toBe(false);
  });

  it("returns false for bool", () => {
    expect(TypeCheckUtils.isInteger("bool")).toBe(false);
  });

  it("returns false for string types", () => {
    expect(TypeCheckUtils.isInteger("string<32>")).toBe(false);
  });

  it("returns false for custom types", () => {
    expect(TypeCheckUtils.isInteger("MyStruct")).toBe(false);
  });
});

// ========================================================================
// isUnsigned
// ========================================================================
describe("TypeCheckUtils.isUnsigned", () => {
  it("returns true for unsigned types", () => {
    expect(TypeCheckUtils.isUnsigned("u8")).toBe(true);
    expect(TypeCheckUtils.isUnsigned("u16")).toBe(true);
    expect(TypeCheckUtils.isUnsigned("u32")).toBe(true);
    expect(TypeCheckUtils.isUnsigned("u64")).toBe(true);
  });

  it("returns false for signed types", () => {
    expect(TypeCheckUtils.isUnsigned("i8")).toBe(false);
    expect(TypeCheckUtils.isUnsigned("i32")).toBe(false);
  });
});

// ========================================================================
// isSigned
// ========================================================================
describe("TypeCheckUtils.isSigned", () => {
  it("returns true for signed types", () => {
    expect(TypeCheckUtils.isSigned("i8")).toBe(true);
    expect(TypeCheckUtils.isSigned("i16")).toBe(true);
    expect(TypeCheckUtils.isSigned("i32")).toBe(true);
    expect(TypeCheckUtils.isSigned("i64")).toBe(true);
  });

  it("returns false for unsigned types", () => {
    expect(TypeCheckUtils.isSigned("u8")).toBe(false);
    expect(TypeCheckUtils.isSigned("u32")).toBe(false);
  });
});

// ========================================================================
// isFloat
// ========================================================================
describe("TypeCheckUtils.isFloat", () => {
  it("returns true for f32", () => {
    expect(TypeCheckUtils.isFloat("f32")).toBe(true);
  });

  it("returns true for f64", () => {
    expect(TypeCheckUtils.isFloat("f64")).toBe(true);
  });

  it("returns false for integers", () => {
    expect(TypeCheckUtils.isFloat("u32")).toBe(false);
    expect(TypeCheckUtils.isFloat("i64")).toBe(false);
  });
});

// ========================================================================
// isString
// ========================================================================
describe("TypeCheckUtils.isString", () => {
  it("returns true for string<32>", () => {
    expect(TypeCheckUtils.isString("string<32>")).toBe(true);
  });

  it("returns true for string<1>", () => {
    expect(TypeCheckUtils.isString("string<1>")).toBe(true);
  });

  it("returns true for string<256>", () => {
    expect(TypeCheckUtils.isString("string<256>")).toBe(true);
  });

  it("returns false for bare string", () => {
    expect(TypeCheckUtils.isString("string")).toBe(false);
  });

  it("returns false for char types", () => {
    expect(TypeCheckUtils.isString("char")).toBe(false);
  });

  it("returns false for cstring", () => {
    expect(TypeCheckUtils.isString("cstring")).toBe(false);
  });
});

// ========================================================================
// getStringCapacity
// ========================================================================
describe("TypeCheckUtils.getStringCapacity", () => {
  it("returns 32 for string<32>", () => {
    expect(TypeCheckUtils.getStringCapacity("string<32>")).toBe(32);
  });

  it("returns 1 for string<1>", () => {
    expect(TypeCheckUtils.getStringCapacity("string<1>")).toBe(1);
  });

  it("returns 256 for string<256>", () => {
    expect(TypeCheckUtils.getStringCapacity("string<256>")).toBe(256);
  });

  it("returns null for non-string types", () => {
    expect(TypeCheckUtils.getStringCapacity("u32")).toBeNull();
    expect(TypeCheckUtils.getStringCapacity("string")).toBeNull();
    expect(TypeCheckUtils.getStringCapacity("MyStruct")).toBeNull();
  });
});

// ========================================================================
// isStandardWidth
// ========================================================================
describe("TypeCheckUtils.isStandardWidth", () => {
  it("returns true for 8", () => {
    expect(TypeCheckUtils.isStandardWidth(8)).toBe(true);
  });

  it("returns true for 16", () => {
    expect(TypeCheckUtils.isStandardWidth(16)).toBe(true);
  });

  it("returns true for 32", () => {
    expect(TypeCheckUtils.isStandardWidth(32)).toBe(true);
  });

  it("returns false for 64", () => {
    expect(TypeCheckUtils.isStandardWidth(64)).toBe(false);
  });

  it("returns false for 4", () => {
    expect(TypeCheckUtils.isStandardWidth(4)).toBe(false);
  });

  it("returns false for 1", () => {
    expect(TypeCheckUtils.isStandardWidth(1)).toBe(false);
  });
});

// ========================================================================
// usesNativeArithmetic
// ========================================================================
describe("TypeCheckUtils.usesNativeArithmetic", () => {
  it("returns true for f32", () => {
    expect(TypeCheckUtils.usesNativeArithmetic("f32")).toBe(true);
  });

  it("returns true for f64", () => {
    expect(TypeCheckUtils.usesNativeArithmetic("f64")).toBe(true);
  });

  it("returns false for integers", () => {
    expect(TypeCheckUtils.usesNativeArithmetic("u32")).toBe(false);
    expect(TypeCheckUtils.usesNativeArithmetic("i64")).toBe(false);
  });

  it("returns false for bool", () => {
    expect(TypeCheckUtils.usesNativeArithmetic("bool")).toBe(false);
  });
});
