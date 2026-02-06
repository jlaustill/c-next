/**
 * Unit tests for OverflowHelperTemplates
 */

import { describe, it, expect } from "vitest";
import OverflowHelperTemplates from "../OverflowHelperTemplates";

describe("OverflowHelperTemplates", () => {
  describe("resolveTypeInfo", () => {
    it("should resolve unsigned type info correctly", () => {
      const info = OverflowHelperTemplates.resolveTypeInfo("u32");

      expect(info).not.toBeNull();
      expect(info?.cType).toBe("uint32_t");
      expect(info?.isUnsigned).toBe(true);
      expect(info?.useWiderArithmetic).toBe(false);
    });

    it("should resolve signed narrow type info with wider arithmetic", () => {
      const info = OverflowHelperTemplates.resolveTypeInfo("i16");

      expect(info).not.toBeNull();
      expect(info?.cType).toBe("int16_t");
      expect(info?.isUnsigned).toBe(false);
      expect(info?.useWiderArithmetic).toBe(true);
    });

    it("should resolve i64 without wider arithmetic (widest type)", () => {
      const info = OverflowHelperTemplates.resolveTypeInfo("i64");

      expect(info).not.toBeNull();
      expect(info?.cType).toBe("int64_t");
      expect(info?.isUnsigned).toBe(false);
      expect(info?.useWiderArithmetic).toBe(false);
    });

    it("should return null for invalid types", () => {
      const info = OverflowHelperTemplates.resolveTypeInfo("invalid");
      expect(info).toBeNull();
    });
  });

  describe("generateClampHelper", () => {
    describe("unsigned types", () => {
      it("should generate add helper for u32", () => {
        const helper = OverflowHelperTemplates.generateClampHelper(
          "add",
          "u32",
        );

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_add_u32");
        expect(helper).toContain("__builtin_add_overflow");
        expect(helper).toContain("return UINT32_MAX");
      });

      it("should generate sub helper for u32 with underflow protection", () => {
        const helper = OverflowHelperTemplates.generateClampHelper(
          "sub",
          "u32",
        );

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_sub_u32");
        expect(helper).toContain("return 0"); // Underflow clamps to 0
      });

      it("should generate mul helper for u32", () => {
        const helper = OverflowHelperTemplates.generateClampHelper(
          "mul",
          "u32",
        );

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_mul_u32");
        expect(helper).toContain("__builtin_mul_overflow");
      });
    });

    describe("signed narrow types (wider arithmetic)", () => {
      it("should generate add helper for i16 using wider type", () => {
        const helper = OverflowHelperTemplates.generateClampHelper(
          "add",
          "i16",
        );

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_add_i16");
        expect(helper).toContain("int32_t result"); // Uses wider type
        expect(helper).toContain("(int16_t)result"); // Cast back
      });

      it("should generate sub helper for i8 using wider type", () => {
        const helper = OverflowHelperTemplates.generateClampHelper("sub", "i8");

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_sub_i8");
        expect(helper).toContain("int32_t result"); // Uses wider type (i8 -> int32_t)
      });
    });

    describe("i64 (widest type)", () => {
      it("should generate add helper for i64 with manual checks", () => {
        const helper = OverflowHelperTemplates.generateClampHelper(
          "add",
          "i64",
        );

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_add_i64");
        expect(helper).toContain("if (b > 0 && a > INT64_MAX - b)");
        expect(helper).toContain("if (b < 0 && a < INT64_MIN - b)");
      });

      it("should generate mul helper for i64 with all quadrant checks", () => {
        const helper = OverflowHelperTemplates.generateClampHelper(
          "mul",
          "i64",
        );

        expect(helper).not.toBeNull();
        expect(helper).toContain("cnx_clamp_mul_i64");
        expect(helper).toContain("a > 0 && b > 0");
        expect(helper).toContain("a < 0 && b < 0");
      });
    });

    it("should return null for invalid operation", () => {
      const helper = OverflowHelperTemplates.generateClampHelper("div", "u32");
      expect(helper).toBeNull();
    });
  });

  describe("generatePanicHelper", () => {
    it("should generate panic helper with fprintf and abort for u32", () => {
      const helper = OverflowHelperTemplates.generatePanicHelper("add", "u32");

      expect(helper).not.toBeNull();
      expect(helper).toContain('fprintf(stderr, "PANIC: Integer overflow');
      expect(helper).toContain("abort()");
    });

    it("should use underflow message for unsigned subtraction", () => {
      const helper = OverflowHelperTemplates.generatePanicHelper("sub", "u32");

      expect(helper).not.toBeNull();
      expect(helper).toContain("Integer underflow");
    });

    it("should generate panic helper for signed types", () => {
      const helper = OverflowHelperTemplates.generatePanicHelper("mul", "i32");

      expect(helper).not.toBeNull();
      expect(helper).toContain("cnx_clamp_mul_i32");
      expect(helper).toContain('fprintf(stderr, "PANIC:');
    });
  });

  describe("output consistency", () => {
    it("should produce consistent output for same inputs", () => {
      const helper1 = OverflowHelperTemplates.generateClampHelper("add", "u32");
      const helper2 = OverflowHelperTemplates.generateClampHelper("add", "u32");

      expect(helper1).toBe(helper2);
    });

    it("should produce different output for debug vs clamp mode", () => {
      const clampHelper = OverflowHelperTemplates.generateClampHelper(
        "add",
        "u32",
      );
      const panicHelper = OverflowHelperTemplates.generatePanicHelper(
        "add",
        "u32",
      );

      expect(clampHelper).not.toBe(panicHelper);
      expect(clampHelper).not.toContain("abort()");
      expect(panicHelper).toContain("abort()");
    });
  });
});
