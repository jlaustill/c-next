import { describe, it, expect } from "vitest";
import TPrimitiveKind from "../../types/TPrimitiveKind";
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
  // #1668: a composite with a floating operand is not an integer composite.
});
