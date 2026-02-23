/**
 * Unit tests for BitRangeHelper utility.
 * Tests bit range access code generation patterns.
 */
import { describe, it, expect, beforeEach } from "vitest";
import BitRangeHelper from "../BitRangeHelper.js";
import CodeGenState from "../../../../state/CodeGenState.js";

describe("BitRangeHelper", () => {
  describe("buildFloatBitReadExpr", () => {
    it("should generate expression without shift when start is 0", () => {
      const result = BitRangeHelper.buildFloatBitReadExpr({
        shadowName: "__bits_value",
        varName: "value",
        start: "0",
        mask: "0xFF",
        shadowIsCurrent: true,
      });

      expect(result).toBe("(__bits_value & 0xFF)");
    });

    it("should generate expression with shift when start is non-zero", () => {
      const result = BitRangeHelper.buildFloatBitReadExpr({
        shadowName: "__bits_value",
        varName: "value",
        start: "8",
        mask: "0xFFFF",
        shadowIsCurrent: true,
      });

      expect(result).toBe("((__bits_value >> 8) & 0xFFFF)");
    });

    it("should include memcpy when shadow is not current", () => {
      const result = BitRangeHelper.buildFloatBitReadExpr({
        shadowName: "__bits_val",
        varName: "val",
        start: "0",
        mask: "0xFF",
        shadowIsCurrent: false,
      });

      expect(result).toContain("memcpy(&__bits_val, &val, sizeof(val))");
      expect(result).toContain("__bits_val & 0xFF");
    });

    it("should include memcpy with shift when shadow is not current and start is non-zero", () => {
      const result = BitRangeHelper.buildFloatBitReadExpr({
        shadowName: "__bits_data",
        varName: "data",
        start: "16",
        mask: "0xFFU",
        shadowIsCurrent: false,
      });

      expect(result).toContain("memcpy(&__bits_data, &data, sizeof(data))");
      expect(result).toContain(">> 16");
      expect(result).toContain("& 0xFFU");
    });

    it("should skip memcpy when shadow is current", () => {
      const result = BitRangeHelper.buildFloatBitReadExpr({
        shadowName: "__bits_x",
        varName: "x",
        start: "24",
        mask: "0xFF",
        shadowIsCurrent: true,
      });

      expect(result).not.toContain("memcpy");
      expect(result).toBe("((__bits_x >> 24) & 0xFF)");
    });
  });

  describe("buildIntegerBitReadExpr", () => {
    it("should generate expression without shift when start is 0", () => {
      const result = BitRangeHelper.buildIntegerBitReadExpr({
        varName: "flags",
        start: "0",
        mask: "0xFF",
      });

      expect(result).toBe("((flags) & 0xFF)");
    });

    it("should generate expression with shift when start is non-zero", () => {
      const result = BitRangeHelper.buildIntegerBitReadExpr({
        varName: "status",
        start: "4",
        mask: "0xF",
      });

      expect(result).toBe("((status >> 4) & 0xF)");
    });

    it("should handle large start positions", () => {
      const result = BitRangeHelper.buildIntegerBitReadExpr({
        varName: "data",
        start: "56",
        mask: "0xFF",
      });

      expect(result).toBe("((data >> 56) & 0xFF)");
    });

    it("should handle complex variable names", () => {
      const result = BitRangeHelper.buildIntegerBitReadExpr({
        varName: "config.registers[0]",
        start: "8",
        mask: "0xFFFF",
      });

      expect(result).toBe("((config.registers[0] >> 8) & 0xFFFF)");
    });
  });

  describe("buildIntegerBitReadExpr with target type", () => {
    beforeEach(() => {
      CodeGenState.reset();
      CodeGenState.cppMode = false;
    });

    it("adds cast when target type is narrower than source", () => {
      const result = BitRangeHelper.buildIntegerBitReadExpr({
        varName: "value",
        start: "0",
        mask: "0xFFU",
        sourceType: "u32",
        targetType: "u8",
      });
      expect(result).toBe("(uint8_t)((value) & 0xFFU)");
    });

    it("returns plain expression when no narrowing", () => {
      const result = BitRangeHelper.buildIntegerBitReadExpr({
        varName: "value",
        start: "8",
        mask: "0xFFFFU",
        sourceType: "u32",
        targetType: "u32",
      });
      expect(result).toBe("((value >> 8) & 0xFFFFU)");
    });

    it("returns plain expression when types not provided (backward compatible)", () => {
      const result = BitRangeHelper.buildIntegerBitReadExpr({
        varName: "value",
        start: "0",
        mask: "0xFFU",
      });
      expect(result).toBe("((value) & 0xFFU)");
    });

    it("uses static_cast in C++ mode", () => {
      CodeGenState.cppMode = true;
      const result = BitRangeHelper.buildIntegerBitReadExpr({
        varName: "value",
        start: "0",
        mask: "0xFFU",
        sourceType: "u32",
        targetType: "u8",
      });
      expect(result).toBe("static_cast<uint8_t>(((value) & 0xFFU))");
    });
  });

  describe("getShadowVarName", () => {
    it("should prefix with __bits_", () => {
      expect(BitRangeHelper.getShadowVarName("value")).toBe("__bits_value");
      expect(BitRangeHelper.getShadowVarName("x")).toBe("__bits_x");
      expect(BitRangeHelper.getShadowVarName("myFloat")).toBe("__bits_myFloat");
    });
  });

  describe("getShadowType", () => {
    it("should return uint32_t for f32", () => {
      expect(BitRangeHelper.getShadowType("f32")).toBe("uint32_t");
    });

    it("should return uint64_t for f64", () => {
      expect(BitRangeHelper.getShadowType("f64")).toBe("uint64_t");
    });

    it("should return uint32_t for any other type (default)", () => {
      expect(BitRangeHelper.getShadowType("float")).toBe("uint32_t");
      expect(BitRangeHelper.getShadowType("double")).toBe("uint32_t");
    });
  });

  describe("buildShadowDeclaration", () => {
    it("should generate uint32_t declaration", () => {
      const result = BitRangeHelper.buildShadowDeclaration(
        "__bits_value",
        "uint32_t",
      );
      expect(result).toBe("uint32_t __bits_value;");
    });

    it("should generate uint64_t declaration", () => {
      const result = BitRangeHelper.buildShadowDeclaration(
        "__bits_dbl",
        "uint64_t",
      );
      expect(result).toBe("uint64_t __bits_dbl;");
    });
  });
});
