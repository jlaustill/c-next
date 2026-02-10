/**
 * Unit tests for FloatBitHelper
 *
 * Issue #644: Tests for the extracted float bit write helper.
 * Migrated to use CodeGenState instead of constructor DI.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import FloatBitHelper from "../FloatBitHelper.js";
import CodeGenState from "../../CodeGenState.js";
import type TTypeInfo from "../../types/TTypeInfo.js";
import type TIncludeHeader from "../../generators/TIncludeHeader.js";

/**
 * Callback types for code generation operations.
 */
interface IFloatBitCallbacks {
  generateBitMask: (width: string, is64Bit?: boolean) => string;
  foldBooleanToInt: (expr: string) => string;
  requireInclude: (header: TIncludeHeader) => void;
}

describe("FloatBitHelper", () => {
  let callbacks: IFloatBitCallbacks;

  beforeEach(() => {
    CodeGenState.reset();

    callbacks = {
      generateBitMask: vi.fn((width, _is64Bit) => `((1U << ${width}) - 1)`),
      foldBooleanToInt: vi.fn((expr) =>
        expr === "true" ? "1" : expr === "false" ? "0" : expr,
      ),
      requireInclude: vi.fn(),
    };
  });

  describe("generateFloatBitWrite", () => {
    it("returns null for non-float types", () => {
      const typeInfo: TTypeInfo = {
        baseType: "u32",
        bitWidth: 32,
        isConst: false,
        isArray: false,
      };

      const result = FloatBitHelper.generateFloatBitWrite(
        "myVar",
        typeInfo,
        "3",
        null,
        "true",
        callbacks,
      );

      expect(result).toBeNull();
      expect(callbacks.requireInclude).not.toHaveBeenCalled();
    });

    it("generates single bit write for f32", () => {
      const typeInfo: TTypeInfo = {
        baseType: "f32",
        bitWidth: 32,
        isConst: false,
        isArray: false,
      };

      const result = FloatBitHelper.generateFloatBitWrite(
        "myFloat",
        typeInfo,
        "3",
        null,
        "true",
        callbacks,
      );

      expect(result).toContain("uint32_t __bits_myFloat;");
      expect(result).toContain("memcpy(&__bits_myFloat, &myFloat");
      expect(result).toContain("& ~(1U << 3)");
      expect(result).toContain("memcpy(&myFloat, &__bits_myFloat");
      expect(callbacks.requireInclude).toHaveBeenCalledWith("string");
      expect(callbacks.requireInclude).toHaveBeenCalledWith(
        "float_static_assert",
      );
    });

    it("generates single bit write for f64", () => {
      const typeInfo: TTypeInfo = {
        baseType: "f64",
        bitWidth: 64,
        isConst: false,
        isArray: false,
      };

      const result = FloatBitHelper.generateFloatBitWrite(
        "myDouble",
        typeInfo,
        "5",
        null,
        "false",
        callbacks,
      );

      expect(result).toContain("uint64_t __bits_myDouble;");
      expect(result).toContain("1ULL << 5");
    });

    it("generates bit range write for f32", () => {
      const typeInfo: TTypeInfo = {
        baseType: "f32",
        bitWidth: 32,
        isConst: false,
        isArray: false,
      };

      const result = FloatBitHelper.generateFloatBitWrite(
        "myFloat",
        typeInfo,
        "0",
        "8",
        "value",
        callbacks,
      );

      expect(result).toContain("uint32_t __bits_myFloat;");
      expect(callbacks.generateBitMask).toHaveBeenCalledWith("8", false);
    });

    it("skips declaration when shadow already exists", () => {
      const typeInfo: TTypeInfo = {
        baseType: "f32",
        bitWidth: 32,
        isConst: false,
        isArray: false,
      };

      // Pre-declare the shadow
      CodeGenState.floatBitShadows.add("__bits_myFloat");

      const result = FloatBitHelper.generateFloatBitWrite(
        "myFloat",
        typeInfo,
        "3",
        null,
        "true",
        callbacks,
      );

      expect(result).not.toContain("uint32_t __bits_myFloat;");
      expect(result).toContain("memcpy(&__bits_myFloat");
    });

    it("skips redundant memcpy read when shadow is current", () => {
      const typeInfo: TTypeInfo = {
        baseType: "f32",
        bitWidth: 32,
        isConst: false,
        isArray: false,
      };

      // Pre-declare and mark as current
      CodeGenState.floatBitShadows.add("__bits_myFloat");
      CodeGenState.floatShadowCurrent.add("__bits_myFloat");

      const result = FloatBitHelper.generateFloatBitWrite(
        "myFloat",
        typeInfo,
        "3",
        null,
        "true",
        callbacks,
      );

      expect(result).not.toContain("uint32_t __bits_myFloat;");
      // Should not have read memcpy, only write memcpy
      const memcpyMatches = result!.match(/memcpy/g);
      expect(memcpyMatches).toHaveLength(1);
    });

    it("marks shadow as current after write", () => {
      const typeInfo: TTypeInfo = {
        baseType: "f32",
        bitWidth: 32,
        isConst: false,
        isArray: false,
      };

      FloatBitHelper.generateFloatBitWrite(
        "myFloat",
        typeInfo,
        "3",
        null,
        "true",
        callbacks,
      );

      expect(CodeGenState.floatShadowCurrent.has("__bits_myFloat")).toBe(true);
    });
  });
});
