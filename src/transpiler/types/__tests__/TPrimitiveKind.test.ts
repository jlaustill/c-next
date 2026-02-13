import { describe, it, expect } from "vitest";
import TPrimitiveKind from "../TPrimitiveKind";
import PrimitiveKindUtils from "../PrimitiveKindUtils";

describe("TPrimitiveKind", () => {
  it("includes all C-Next primitive types", () => {
    const primitives: TPrimitiveKind[] = [
      "void",
      "bool",
      "u8",
      "i8",
      "u16",
      "i16",
      "u32",
      "i32",
      "u64",
      "i64",
      "f32",
      "f64",
    ];
    // Type check passes if all are valid TPrimitiveKind
    expect(primitives).toHaveLength(12);
  });

  it("provides bit widths for numeric primitives", () => {
    expect(PrimitiveKindUtils.BIT_WIDTHS.get("u8")).toBe(8);
    expect(PrimitiveKindUtils.BIT_WIDTHS.get("i32")).toBe(32);
    expect(PrimitiveKindUtils.BIT_WIDTHS.get("f64")).toBe(64);
    expect(PrimitiveKindUtils.BIT_WIDTHS.get("bool")).toBe(1);
    expect(PrimitiveKindUtils.BIT_WIDTHS.get("void")).toBeUndefined();
  });

  describe("getBitWidth", () => {
    it("returns bit width for numeric types", () => {
      expect(PrimitiveKindUtils.getBitWidth("u8")).toBe(8);
      expect(PrimitiveKindUtils.getBitWidth("i32")).toBe(32);
      expect(PrimitiveKindUtils.getBitWidth("f64")).toBe(64);
    });

    it("returns undefined for void", () => {
      expect(PrimitiveKindUtils.getBitWidth("void")).toBeUndefined();
    });
  });

  describe("isPrimitive", () => {
    it("returns true for primitive types", () => {
      expect(PrimitiveKindUtils.isPrimitive("u8")).toBe(true);
      expect(PrimitiveKindUtils.isPrimitive("i32")).toBe(true);
      expect(PrimitiveKindUtils.isPrimitive("void")).toBe(true);
      expect(PrimitiveKindUtils.isPrimitive("bool")).toBe(true);
    });

    it("returns false for non-primitive types", () => {
      expect(PrimitiveKindUtils.isPrimitive("MyStruct")).toBe(false);
      expect(PrimitiveKindUtils.isPrimitive("string")).toBe(false);
      expect(PrimitiveKindUtils.isPrimitive("array")).toBe(false);
    });
  });
});
