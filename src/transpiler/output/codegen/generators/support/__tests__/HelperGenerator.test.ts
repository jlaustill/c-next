import { describe, expect, it } from "vitest";
import helperGenerators from "../HelperGenerator";

const { generateOverflowHelpers, generateSafeDivHelpers } = helperGenerators;

describe("HelperGenerator - generateOverflowHelpers", () => {
  describe("empty input", () => {
    it("returns empty array for empty set", () => {
      const result = generateOverflowHelpers(new Set(), false);
      expect(result).toEqual([]);
    });

    it("returns empty array for empty set in debug mode", () => {
      const result = generateOverflowHelpers(new Set(), true);
      expect(result).toEqual([]);
    });
  });

  describe("unsigned types - clamp mode", () => {
    it("generates u8 add helper with builtin overflow check", () => {
      const result = generateOverflowHelpers(new Set(["add_u8"]), false);
      expect(result.join("\n")).toContain("cnx_clamp_add_u8");
      expect(result.join("\n")).toContain("__builtin_add_overflow");
      expect(result.join("\n")).toContain("uint8_t");
      expect(result.join("\n")).toContain("return UINT8_MAX");
    });

    it("generates u16 sub helper", () => {
      const result = generateOverflowHelpers(new Set(["sub_u16"]), false);
      expect(result.join("\n")).toContain("cnx_clamp_sub_u16");
      expect(result.join("\n")).toContain("__builtin_sub_overflow");
      expect(result.join("\n")).toContain("uint16_t");
      expect(result.join("\n")).toContain("return 0");
    });

    it("generates u32 mul helper", () => {
      const result = generateOverflowHelpers(new Set(["mul_u32"]), false);
      expect(result.join("\n")).toContain("cnx_clamp_mul_u32");
      expect(result.join("\n")).toContain("__builtin_mul_overflow");
      expect(result.join("\n")).toContain("uint32_t");
    });

    it("generates u64 add helper", () => {
      const result = generateOverflowHelpers(new Set(["add_u64"]), false);
      expect(result.join("\n")).toContain("cnx_clamp_add_u64");
      expect(result.join("\n")).toContain("uint64_t");
      expect(result.join("\n")).toContain("UINT64_MAX");
    });
  });

  describe("signed types - clamp mode", () => {
    it("generates i8 add helper with wider arithmetic", () => {
      const result = generateOverflowHelpers(new Set(["add_i8"]), false);
      expect(result.join("\n")).toContain("cnx_clamp_add_i8");
      expect(result.join("\n")).toContain("int8_t");
      // i8 uses wider arithmetic (i16 or i32)
      expect(result.join("\n")).toContain("INT8_MAX");
      expect(result.join("\n")).toContain("INT8_MIN");
    });

    it("generates i16 sub helper with wider arithmetic", () => {
      const result = generateOverflowHelpers(new Set(["sub_i16"]), false);
      expect(result.join("\n")).toContain("cnx_clamp_sub_i16");
      expect(result.join("\n")).toContain("int16_t");
    });

    it("generates i32 mul helper with wider arithmetic", () => {
      const result = generateOverflowHelpers(new Set(["mul_i32"]), false);
      expect(result.join("\n")).toContain("cnx_clamp_mul_i32");
      expect(result.join("\n")).toContain("int32_t");
    });

    it("generates i64 add helper with direct check (no wider type)", () => {
      const result = generateOverflowHelpers(new Set(["add_i64"]), false);
      expect(result.join("\n")).toContain("cnx_clamp_add_i64");
      expect(result.join("\n")).toContain("int64_t");
      expect(result.join("\n")).toContain("INT64_MAX");
      expect(result.join("\n")).toContain("INT64_MIN");
      // i64 doesn't use builtin - uses direct checks
      expect(result.join("\n")).toContain("return a + b");
    });

    it("generates i64 sub helper with direct check", () => {
      const result = generateOverflowHelpers(new Set(["sub_i64"]), false);
      expect(result.join("\n")).toContain("cnx_clamp_sub_i64");
      expect(result.join("\n")).toContain("return a - b");
    });

    it("generates i64 mul helper with direct check", () => {
      const result = generateOverflowHelpers(new Set(["mul_i64"]), false);
      expect(result.join("\n")).toContain("cnx_clamp_mul_i64");
      expect(result.join("\n")).toContain("return a * b");
    });
  });

  describe("debug mode", () => {
    it("includes stdio and stdlib headers", () => {
      const result = generateOverflowHelpers(new Set(["add_u8"]), true);
      expect(result.join("\n")).toContain("#include <stdio.h>");
      expect(result.join("\n")).toContain("#include <stdlib.h>");
    });

    it("generates panic on overflow for unsigned add", () => {
      const result = generateOverflowHelpers(new Set(["add_u8"]), true);
      expect(result.join("\n")).toContain("fprintf(stderr");
      expect(result.join("\n")).toContain("PANIC");
      expect(result.join("\n")).toContain("abort()");
    });

    it("generates panic on underflow for unsigned sub", () => {
      const result = generateOverflowHelpers(new Set(["sub_u16"]), true);
      expect(result.join("\n")).toContain("underflow");
      expect(result.join("\n")).toContain("abort()");
    });

    it("generates panic for signed overflow", () => {
      const result = generateOverflowHelpers(new Set(["add_i32"]), true);
      expect(result.join("\n")).toContain("PANIC");
      expect(result.join("\n")).toContain("overflow");
    });

    it("generates panic for i64 operations", () => {
      const result = generateOverflowHelpers(new Set(["mul_i64"]), true);
      expect(result.join("\n")).toContain("fprintf(stderr");
      expect(result.join("\n")).toContain("abort()");
    });
  });

  describe("multiple operations", () => {
    it("generates multiple helpers in sorted order", () => {
      const ops = new Set(["mul_u32", "add_u8", "sub_u16"]);
      const result = generateOverflowHelpers(ops, false);
      const code = result.join("\n");

      // Should have all three
      expect(code).toContain("cnx_clamp_add_u8");
      expect(code).toContain("cnx_clamp_mul_u32");
      expect(code).toContain("cnx_clamp_sub_u16");

      // Verify sorted order (add_u8 before mul_u32 before sub_u16)
      const addIndex = code.indexOf("cnx_clamp_add_u8");
      const mulIndex = code.indexOf("cnx_clamp_mul_u32");
      const subIndex = code.indexOf("cnx_clamp_sub_u16");
      expect(addIndex).toBeLessThan(mulIndex);
      expect(mulIndex).toBeLessThan(subIndex);
    });

    it("includes limits.h header", () => {
      const result = generateOverflowHelpers(new Set(["add_u8"]), false);
      expect(result.join("\n")).toContain("#include <limits.h>");
    });
  });

  describe("invalid operations", () => {
    it("skips unknown operations", () => {
      const result = generateOverflowHelpers(new Set(["unknown_u8"]), false);
      // Should still have header but no helper functions
      expect(result.join("\n")).toContain("#include <limits.h>");
      expect(result.join("\n")).not.toContain("cnx_clamp_unknown");
    });

    it("skips unknown types", () => {
      const result = generateOverflowHelpers(new Set(["add_float"]), false);
      expect(result.join("\n")).not.toContain("cnx_clamp_add_float");
    });
  });
});

describe("HelperGenerator - generateSafeDivHelpers", () => {
  describe("empty input", () => {
    it("returns empty array for empty set", () => {
      const result = generateSafeDivHelpers(new Set());
      expect(result).toEqual([]);
    });
  });

  describe("div helpers", () => {
    it("generates u8 div helper", () => {
      const result = generateSafeDivHelpers(new Set(["div_u8"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_div_u8");
      expect(code).toContain("uint8_t");
      expect(code).toContain("divisor == 0");
      expect(code).toContain("return true");
      expect(code).toContain("return false");
    });

    it("generates i32 div helper", () => {
      const result = generateSafeDivHelpers(new Set(["div_i32"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_div_i32");
      expect(code).toContain("int32_t");
    });

    it("generates u64 div helper", () => {
      const result = generateSafeDivHelpers(new Set(["div_u64"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_div_u64");
      expect(code).toContain("uint64_t");
    });
  });

  describe("mod helpers", () => {
    it("generates u16 mod helper", () => {
      const result = generateSafeDivHelpers(new Set(["mod_u16"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_mod_u16");
      expect(code).toContain("uint16_t");
      expect(code).toContain("numerator % divisor");
    });

    it("generates i64 mod helper", () => {
      const result = generateSafeDivHelpers(new Set(["mod_i64"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_mod_i64");
      expect(code).toContain("int64_t");
    });
  });

  describe("multiple helpers", () => {
    it("generates both div and mod for same type", () => {
      const result = generateSafeDivHelpers(new Set(["div_u32", "mod_u32"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_div_u32");
      expect(code).toContain("cnx_safe_mod_u32");
    });

    it("generates helpers for multiple types", () => {
      const ops = new Set(["div_u8", "div_i32", "mod_u64"]);
      const result = generateSafeDivHelpers(ops);
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_div_u8");
      expect(code).toContain("cnx_safe_div_i32");
      expect(code).toContain("cnx_safe_mod_u64");
    });

    it("includes stdbool.h header", () => {
      const result = generateSafeDivHelpers(new Set(["div_u8"]));
      expect(result.join("\n")).toContain("#include <stdbool.h>");
    });

    it("includes ADR-051 comment", () => {
      const result = generateSafeDivHelpers(new Set(["div_u8"]));
      expect(result.join("\n")).toContain("ADR-051");
    });
  });

  describe("output pointer pattern", () => {
    it("uses output pointer for result", () => {
      const result = generateSafeDivHelpers(new Set(["div_u32"]));
      const code = result.join("\n");
      expect(code).toContain("uint32_t* output");
      expect(code).toContain("*output = numerator / divisor");
    });

    it("sets default value on error", () => {
      const result = generateSafeDivHelpers(new Set(["div_u32"]));
      const code = result.join("\n");
      expect(code).toContain("defaultValue");
      expect(code).toContain("*output = defaultValue");
    });
  });

  describe("skip unused types", () => {
    it("only generates requested type helpers", () => {
      const result = generateSafeDivHelpers(new Set(["div_u8"]));
      const code = result.join("\n");
      expect(code).toContain("cnx_safe_div_u8");
      expect(code).not.toContain("cnx_safe_div_u16");
      expect(code).not.toContain("cnx_safe_div_u32");
      expect(code).not.toContain("cnx_safe_mod_u8");
    });
  });
});
