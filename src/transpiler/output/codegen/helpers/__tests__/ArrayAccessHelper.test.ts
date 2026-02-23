/**
 * Unit tests for ArrayAccessHelper utility.
 * Tests array access code generation patterns without ANTLR dependencies.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ArrayAccessHelper from "../ArrayAccessHelper";
import IArrayAccessInfo from "../../types/IArrayAccessInfo";
import IArrayAccessDeps from "../../types/IArrayAccessDeps";
import CodeGenState from "../../../../state/CodeGenState.js";

/**
 * Create mock dependencies for testing.
 */
function createMockDeps(): IArrayAccessDeps {
  return {
    generateBitMask: vi.fn().mockReturnValue("0xFF"),
    requireInclude: vi.fn(),
    isInFunctionBody: vi.fn().mockReturnValue(true),
    registerFloatShadow: vi.fn().mockReturnValue(true),
    isShadowCurrent: vi.fn().mockReturnValue(false),
    markShadowCurrent: vi.fn(),
  };
}

describe("ArrayAccessHelper", () => {
  let mockDeps: IArrayAccessDeps;

  beforeEach(() => {
    mockDeps = createMockDeps();
  });

  describe("generate", () => {
    it("should route to single-index for single-index accessType", () => {
      const info: IArrayAccessInfo = {
        rawName: "arr",
        resolvedName: "arr",
        accessType: "single-index",
        indexExpr: "i",
        line: 1,
      };

      const result = ArrayAccessHelper.generate(info, mockDeps);
      expect(result).toBe("arr[i]");
    });

    it("should route to bit-range for bit-range accessType", () => {
      const info: IArrayAccessInfo = {
        rawName: "value",
        resolvedName: "value",
        accessType: "bit-range",
        startExpr: "8",
        widthExpr: "8",
        typeInfo: {
          baseType: "u32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        },
        line: 1,
      };

      const result = ArrayAccessHelper.generate(info, mockDeps);
      expect(result).toBe("((value >> 8) & 0xFF)");
    });
  });

  describe("generateSingleIndex", () => {
    it("should generate simple array access", () => {
      const info: IArrayAccessInfo = {
        rawName: "arr",
        resolvedName: "arr",
        accessType: "single-index",
        indexExpr: "i",
        line: 1,
      };

      expect(ArrayAccessHelper.generateSingleIndex(info)).toBe("arr[i]");
    });

    it("should use resolved name for dereferenced parameters", () => {
      const info: IArrayAccessInfo = {
        rawName: "param",
        resolvedName: "(*param)",
        accessType: "single-index",
        indexExpr: "0",
        line: 1,
      };

      expect(ArrayAccessHelper.generateSingleIndex(info)).toBe("(*param)[0]");
    });

    it("should handle complex index expressions", () => {
      const info: IArrayAccessInfo = {
        rawName: "data",
        resolvedName: "data",
        accessType: "single-index",
        indexExpr: "i * 2 + offset",
        line: 1,
      };

      expect(ArrayAccessHelper.generateSingleIndex(info)).toBe(
        "data[i * 2 + offset]",
      );
    });

    it("should handle array with numeric literal index", () => {
      const info: IArrayAccessInfo = {
        rawName: "buffer",
        resolvedName: "buffer",
        accessType: "single-index",
        indexExpr: "42",
        line: 1,
      };

      expect(ArrayAccessHelper.generateSingleIndex(info)).toBe("buffer[42]");
    });
  });

  describe("validateNotBitmap", () => {
    it("should throw for bitmap bracket indexing", () => {
      const info: IArrayAccessInfo = {
        rawName: "flags",
        resolvedName: "flags",
        accessType: "single-index",
        indexExpr: "3",
        typeInfo: {
          baseType: "u8",
          bitWidth: 8,
          isArray: false,
          isConst: false,
          isBitmap: true,
          bitmapTypeName: "Flags",
        },
        line: 10,
      };

      expect(() => ArrayAccessHelper.validateNotBitmap(info)).toThrow("bitmap");
      expect(() => ArrayAccessHelper.validateNotBitmap(info)).toThrow("Flags");
      expect(() => ArrayAccessHelper.validateNotBitmap(info)).toThrow(
        "line 10",
      );
    });

    it("should not throw for regular arrays", () => {
      const info: IArrayAccessInfo = {
        rawName: "arr",
        resolvedName: "arr",
        accessType: "single-index",
        indexExpr: "0",
        typeInfo: {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        },
        line: 1,
      };

      expect(() => ArrayAccessHelper.validateNotBitmap(info)).not.toThrow();
    });

    it("should not throw when no typeInfo is provided", () => {
      const info: IArrayAccessInfo = {
        rawName: "unknown",
        resolvedName: "unknown",
        accessType: "single-index",
        indexExpr: "0",
        line: 1,
      };

      expect(() => ArrayAccessHelper.validateNotBitmap(info)).not.toThrow();
    });

    it("should not throw for bitmap without bitmapTypeName", () => {
      const info: IArrayAccessInfo = {
        rawName: "flags",
        resolvedName: "flags",
        accessType: "single-index",
        indexExpr: "0",
        typeInfo: {
          baseType: "u8",
          bitWidth: 8,
          isArray: false,
          isConst: false,
          isBitmap: true,
          // No bitmapTypeName
        },
        line: 1,
      };

      expect(() => ArrayAccessHelper.validateNotBitmap(info)).not.toThrow();
    });
  });

  describe("isFloatBitRange", () => {
    it("should return true for f32", () => {
      expect(ArrayAccessHelper.isFloatBitRange({ baseType: "f32" })).toBe(true);
    });

    it("should return true for f64", () => {
      expect(ArrayAccessHelper.isFloatBitRange({ baseType: "f64" })).toBe(true);
    });

    it("should return false for u32", () => {
      expect(ArrayAccessHelper.isFloatBitRange({ baseType: "u32" })).toBe(
        false,
      );
    });

    it("should return false for i64", () => {
      expect(ArrayAccessHelper.isFloatBitRange({ baseType: "i64" })).toBe(
        false,
      );
    });

    it("should return false for undefined typeInfo", () => {
      expect(ArrayAccessHelper.isFloatBitRange(undefined)).toBe(false);
    });

    it("should return false for empty object", () => {
      expect(ArrayAccessHelper.isFloatBitRange({})).toBe(false);
    });
  });

  describe("generateBitRange", () => {
    it("should route to integer bit range for u32", () => {
      const info: IArrayAccessInfo = {
        rawName: "value",
        resolvedName: "value",
        accessType: "bit-range",
        startExpr: "8",
        widthExpr: "8",
        typeInfo: {
          baseType: "u32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        },
        line: 1,
      };

      const result = ArrayAccessHelper.generateBitRange(info, mockDeps);
      expect(result).toBe("((value >> 8) & 0xFF)");
      expect(mockDeps.generateBitMask).toHaveBeenCalledWith("8");
    });

    it("should route to float bit range for f32 (no string.h needed)", () => {
      const info: IArrayAccessInfo = {
        rawName: "fval",
        resolvedName: "fval",
        accessType: "bit-range",
        startExpr: "0",
        widthExpr: "8",
        typeInfo: {
          baseType: "f32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        },
        line: 1,
      };

      const result = ArrayAccessHelper.generateBitRange(info, mockDeps);
      expect(result).toContain("__bits_fval");
      // No string.h - uses union-based type punning (MISRA 21.15 compliant)
      expect(mockDeps.requireInclude).not.toHaveBeenCalledWith("string");
      expect(mockDeps.requireInclude).toHaveBeenCalledWith(
        "float_static_assert",
      );
    });
  });

  describe("generateIntegerBitRange", () => {
    it("should generate bit range read with shift", () => {
      const info: IArrayAccessInfo = {
        rawName: "value",
        resolvedName: "value",
        accessType: "bit-range",
        startExpr: "8",
        widthExpr: "8",
        typeInfo: {
          baseType: "u32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        },
        line: 1,
      };

      const result = ArrayAccessHelper.generateIntegerBitRange(info, mockDeps);
      expect(result).toBe("((value >> 8) & 0xFF)");
    });

    it("should generate bit range read without shift when start is 0", () => {
      const info: IArrayAccessInfo = {
        rawName: "flags",
        resolvedName: "flags",
        accessType: "bit-range",
        startExpr: "0",
        widthExpr: "4",
        typeInfo: {
          baseType: "u8",
          bitWidth: 8,
          isArray: false,
          isConst: false,
        },
        line: 1,
      };

      const result = ArrayAccessHelper.generateIntegerBitRange(info, mockDeps);
      expect(result).toBe("((flags) & 0xFF)");
    });

    it("should use resolved name for dereferenced parameters", () => {
      const info: IArrayAccessInfo = {
        rawName: "param",
        resolvedName: "(*param)",
        accessType: "bit-range",
        startExpr: "4",
        widthExpr: "4",
        line: 1,
      };

      const result = ArrayAccessHelper.generateIntegerBitRange(info, mockDeps);
      expect(result).toBe("(((*param) >> 4) & 0xFF)");
    });

    it("should handle missing startExpr with default", () => {
      const info: IArrayAccessInfo = {
        rawName: "value",
        resolvedName: "value",
        accessType: "bit-range",
        widthExpr: "8",
        line: 1,
      };

      const result = ArrayAccessHelper.generateIntegerBitRange(info, mockDeps);
      expect(result).toBe("((value) & 0xFF)");
    });
  });

  describe("generateFloatBitRange", () => {
    it("should generate float bit range with memcpy", () => {
      const info: IArrayAccessInfo = {
        rawName: "fval",
        resolvedName: "fval",
        accessType: "bit-range",
        startExpr: "0",
        widthExpr: "8",
        typeInfo: {
          baseType: "f32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        },
        line: 1,
      };

      const result = ArrayAccessHelper.generateFloatBitRange(info, mockDeps);

      // Note: BitRangeHelper.buildFloatBitReadExpr still uses memcpy internally,
      // but ArrayAccessHelper no longer requires string.h (MISRA 21.15 compliant)
      expect(result).toContain("__bits_fval");
      expect(mockDeps.requireInclude).not.toHaveBeenCalledWith("string");
      expect(mockDeps.requireInclude).toHaveBeenCalledWith(
        "float_static_assert",
      );
      expect(mockDeps.registerFloatShadow).toHaveBeenCalledWith(
        "__bits_fval",
        "uint32_t",
      );
      expect(mockDeps.markShadowCurrent).toHaveBeenCalledWith("__bits_fval");
    });

    it("should use uint64_t shadow for f64", () => {
      const info: IArrayAccessInfo = {
        rawName: "dval",
        resolvedName: "dval",
        accessType: "bit-range",
        startExpr: "0",
        widthExpr: "8",
        typeInfo: {
          baseType: "f64",
          bitWidth: 64,
          isArray: false,
          isConst: false,
        },
        line: 1,
      };

      (mockDeps.generateBitMask as ReturnType<typeof vi.fn>).mockReturnValue(
        "0xFFULL",
      );

      ArrayAccessHelper.generateFloatBitRange(info, mockDeps);

      expect(mockDeps.registerFloatShadow).toHaveBeenCalledWith(
        "__bits_dval",
        "uint64_t",
      );
      expect(mockDeps.generateBitMask).toHaveBeenCalledWith("8", true);
    });

    it("should skip memcpy when shadow is current", () => {
      const info: IArrayAccessInfo = {
        rawName: "fval",
        resolvedName: "fval",
        accessType: "bit-range",
        startExpr: "8",
        widthExpr: "8",
        typeInfo: {
          baseType: "f32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        },
        line: 1,
      };

      (mockDeps.isShadowCurrent as ReturnType<typeof vi.fn>).mockReturnValue(
        true,
      );

      const result = ArrayAccessHelper.generateFloatBitRange(info, mockDeps);

      expect(result).not.toContain("memcpy");
      expect(result).toBe("((__bits_fval >> 8) & 0xFF)");
    });

    it("should throw error at global scope", () => {
      const info: IArrayAccessInfo = {
        rawName: "globalFloat",
        resolvedName: "globalFloat",
        accessType: "bit-range",
        startExpr: "0",
        widthExpr: "8",
        typeInfo: {
          baseType: "f32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        },
        line: 5,
      };

      (mockDeps.isInFunctionBody as ReturnType<typeof vi.fn>).mockReturnValue(
        false,
      );

      expect(() =>
        ArrayAccessHelper.generateFloatBitRange(info, mockDeps),
      ).toThrow("Float bit indexing reads");
      expect(() =>
        ArrayAccessHelper.generateFloatBitRange(info, mockDeps),
      ).toThrow("globalFloat");
      expect(() =>
        ArrayAccessHelper.generateFloatBitRange(info, mockDeps),
      ).toThrow("global scope");
    });

    it("should handle missing typeInfo with default f32 behavior", () => {
      const info: IArrayAccessInfo = {
        rawName: "fval",
        resolvedName: "fval",
        accessType: "bit-range",
        startExpr: "0",
        widthExpr: "8",
        line: 1,
      };

      ArrayAccessHelper.generateFloatBitRange(info, mockDeps);

      // Without typeInfo, defaults to f32 behavior (uint32_t shadow)
      expect(mockDeps.registerFloatShadow).toHaveBeenCalledWith(
        "__bits_fval",
        "uint32_t",
      );
      // is64Bit is false since baseType is undefined (not f64)
      expect(mockDeps.generateBitMask).toHaveBeenCalledWith("8", false);
    });
  });

  describe("generateIntegerBitRange with MISRA casts", () => {
    let mockDeps: IArrayAccessDeps;

    beforeEach(() => {
      CodeGenState.reset();
      CodeGenState.cppMode = false;
      mockDeps = createMockDeps();
    });

    afterEach(() => {
      CodeGenState.reset();
    });

    it("adds cast when target type is narrower", () => {
      // Configure mock to return the actual mask for u8 width
      (mockDeps.generateBitMask as ReturnType<typeof vi.fn>).mockReturnValue(
        "0xFFU",
      );

      const info: IArrayAccessInfo = {
        rawName: "value",
        resolvedName: "value",
        accessType: "bit-range",
        startExpr: "0",
        widthExpr: "8",
        typeInfo: {
          baseType: "u32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        },
        targetType: "u8",
        line: 1,
      };
      const result = ArrayAccessHelper.generateIntegerBitRange(info, mockDeps);
      expect(result).toBe("(uint8_t)((value) & 0xFFU)");
    });

    it("no cast when target type matches source", () => {
      (mockDeps.generateBitMask as ReturnType<typeof vi.fn>).mockReturnValue(
        "0xFFFFU",
      );

      const info: IArrayAccessInfo = {
        rawName: "value",
        resolvedName: "value",
        accessType: "bit-range",
        startExpr: "8",
        widthExpr: "16",
        typeInfo: {
          baseType: "u32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        },
        targetType: "u32",
        line: 1,
      };
      const result = ArrayAccessHelper.generateIntegerBitRange(info, mockDeps);
      expect(result).toBe("((value >> 8) & 0xFFFFU)");
    });

    it("no cast when targetType not provided (backward compatible)", () => {
      (mockDeps.generateBitMask as ReturnType<typeof vi.fn>).mockReturnValue(
        "0xFFU",
      );

      const info: IArrayAccessInfo = {
        rawName: "value",
        resolvedName: "value",
        accessType: "bit-range",
        startExpr: "0",
        widthExpr: "8",
        typeInfo: {
          baseType: "u32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        },
        line: 1,
      };
      const result = ArrayAccessHelper.generateIntegerBitRange(info, mockDeps);
      expect(result).toBe("((value) & 0xFFU)");
    });

    it("adds cast for u16 target from u32 source", () => {
      (mockDeps.generateBitMask as ReturnType<typeof vi.fn>).mockReturnValue(
        "0xFFFFU",
      );

      const info: IArrayAccessInfo = {
        rawName: "data",
        resolvedName: "data",
        accessType: "bit-range",
        startExpr: "16",
        widthExpr: "16",
        typeInfo: {
          baseType: "u32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        },
        targetType: "u16",
        line: 1,
      };
      const result = ArrayAccessHelper.generateIntegerBitRange(info, mockDeps);
      expect(result).toBe("(uint16_t)((data >> 16) & 0xFFFFU)");
    });

    it("no cast when no typeInfo provided", () => {
      (mockDeps.generateBitMask as ReturnType<typeof vi.fn>).mockReturnValue(
        "0xFFU",
      );

      const info: IArrayAccessInfo = {
        rawName: "value",
        resolvedName: "value",
        accessType: "bit-range",
        startExpr: "0",
        widthExpr: "8",
        targetType: "u8",
        line: 1,
      };
      const result = ArrayAccessHelper.generateIntegerBitRange(info, mockDeps);
      // No cast because sourceType is undefined
      expect(result).toBe("((value) & 0xFFU)");
    });
  });
});
