import { describe, it, expect } from "vitest";
import CallExprUtils from "../CallExprUtils";

describe("CallExprUtils", () => {
  describe("mapTypeToCType", () => {
    it("maps unsigned integer types", () => {
      expect(CallExprUtils.mapTypeToCType("u8")).toBe("uint8_t");
      expect(CallExprUtils.mapTypeToCType("u16")).toBe("uint16_t");
      expect(CallExprUtils.mapTypeToCType("u32")).toBe("uint32_t");
      expect(CallExprUtils.mapTypeToCType("u64")).toBe("uint64_t");
    });

    it("maps signed integer types", () => {
      expect(CallExprUtils.mapTypeToCType("i8")).toBe("int8_t");
      expect(CallExprUtils.mapTypeToCType("i16")).toBe("int16_t");
      expect(CallExprUtils.mapTypeToCType("i32")).toBe("int32_t");
      expect(CallExprUtils.mapTypeToCType("i64")).toBe("int64_t");
    });

    it("maps float types", () => {
      expect(CallExprUtils.mapTypeToCType("f32")).toBe("float");
      expect(CallExprUtils.mapTypeToCType("f64")).toBe("double");
    });

    it("maps bool type", () => {
      expect(CallExprUtils.mapTypeToCType("bool")).toBe("bool");
    });

    it("returns unknown types unchanged", () => {
      expect(CallExprUtils.mapTypeToCType("MyStruct")).toBe("MyStruct");
      expect(CallExprUtils.mapTypeToCType("CustomType")).toBe("CustomType");
    });
  });

  describe("isSmallPrimitiveType", () => {
    it("returns true for small unsigned types", () => {
      expect(CallExprUtils.isSmallPrimitiveType("u8")).toBe(true);
      expect(CallExprUtils.isSmallPrimitiveType("u16")).toBe(true);
    });

    it("returns true for small signed types", () => {
      expect(CallExprUtils.isSmallPrimitiveType("i8")).toBe(true);
      expect(CallExprUtils.isSmallPrimitiveType("i16")).toBe(true);
    });

    it("returns true for bool", () => {
      expect(CallExprUtils.isSmallPrimitiveType("bool")).toBe(true);
    });

    it("returns false for larger types", () => {
      expect(CallExprUtils.isSmallPrimitiveType("u32")).toBe(false);
      expect(CallExprUtils.isSmallPrimitiveType("u64")).toBe(false);
      expect(CallExprUtils.isSmallPrimitiveType("i32")).toBe(false);
      expect(CallExprUtils.isSmallPrimitiveType("i64")).toBe(false);
    });

    it("returns false for float types", () => {
      expect(CallExprUtils.isSmallPrimitiveType("f32")).toBe(false);
      expect(CallExprUtils.isSmallPrimitiveType("f64")).toBe(false);
    });

    it("returns false for struct/custom types", () => {
      expect(CallExprUtils.isSmallPrimitiveType("MyStruct")).toBe(false);
      expect(CallExprUtils.isSmallPrimitiveType("CustomType")).toBe(false);
    });
  });
});
