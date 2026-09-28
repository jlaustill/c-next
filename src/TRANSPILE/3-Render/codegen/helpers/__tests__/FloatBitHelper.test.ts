/**
 * Unit tests for FloatBitHelper
 *
 * Issue #644: Tests for the extracted float bit write helper.
 * Issue #857: Updated for union-based type punning (MISRA 21.15 compliance).
 * Migrated to use TranspileState instead of constructor DI.
 * #1760 review: the helper takes the typer's float type rather than a
 * declared type info, writes a target that is not a variable through a union
 * of its own, and annotates every union with the rule that shaped it.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import FloatBitHelper from "../FloatBitHelper";
import TranspileState from "../../../../TranspileState";
import type TIncludeHeader from "../../../../../transpiler/types/TIncludeHeader";

/**
 * Callback types for code generation operations.
 */
interface IFloatBitCallbacks {
  requireInclude: (header: TIncludeHeader) => void;
}

let state = new TranspileState();

const F32_ANNOTATION =
  "/* MISRA C:2012 Rule 21.15: float bits accessed through a union (memcpy would pass incompatible pointer types: float* vs uint32_t*). */";

describe("FloatBitHelper", () => {
  let callbacks: IFloatBitCallbacks;

  beforeEach(() => {
    state = new TranspileState();

    callbacks = {
      requireInclude: vi.fn(),
    };
  });

  const write = (
    target: string,
    floatType: string,
    bitIndex: string,
    width: string | null,
    value: string,
    isVariable = true,
  ): string =>
    FloatBitHelper.generateFloatBitWrite(
      { target, floatType, bitIndex, width, value, isVariable },
      callbacks,
      state,
    );

  describe("generateFloatBitWrite", () => {
    it("generates single bit write for f32 using union", () => {
      const result = write("myFloat", "f32", "3", null, "true");

      // Union declaration, with the rule that makes it a union
      expect(result).toContain(
        `${F32_ANNOTATION}\nunion { float f; uint32_t u; } __bits_myFloat;`,
      );
      // Read via union
      expect(result).toContain("__bits_myFloat.f = myFloat;");
      // Bit manipulation via .u, written like any uint32_t (#1668)
      expect(result).toContain(
        "__bits_myFloat.u = (__bits_myFloat.u & ~((uint32_t)1U << 3)) | ((uint32_t)1U << 3);",
      );
      // Write back via union
      expect(result).toContain("myFloat = __bits_myFloat.f;");
      // No memcpy call for MISRA compliance (the annotation names it)
      expect(result).not.toContain("memcpy(");
      expect(callbacks.requireInclude).not.toHaveBeenCalledWith("string");
      expect(callbacks.requireInclude).toHaveBeenCalledWith(
        "float_static_assert",
      );
    });

    it("generates single bit write for f64 using union", () => {
      const result = write("myDouble", "f64", "5", null, "false");

      expect(result).toContain(
        "union { double f; uint64_t u; } __bits_myDouble;",
      );
      expect(result).toContain("double* vs uint64_t*");
      expect(result).toContain(
        "__bits_myDouble.u = (__bits_myDouble.u & ~((uint64_t)1U << 5)) | ((uint64_t)0U << 5);",
      );
    });

    it("generates bit range write for f32 using union", () => {
      const result = write("myFloat", "f32", "0", "8", "value");

      expect(result).toContain(
        "union { float f; uint32_t u; } __bits_myFloat;",
      );
      expect(result).toContain(
        "__bits_myFloat.u = (__bits_myFloat.u & ~((uint32_t)0xFFU << 0)) | ((value & (uint32_t)0xFFU) << 0);",
      );
    });

    it("skips union declaration when shadow already exists", () => {
      // Pre-declare the shadow
      state.floatBitShadows.add("__bits_myFloat");

      const result = write("myFloat", "f32", "3", null, "true");

      expect(result).not.toContain("union { float f; uint32_t u; }");
      expect(result).not.toContain("Rule 21.15");
      expect(result).toContain("__bits_myFloat.f = myFloat;");
    });

    it("skips redundant union read when shadow is current", () => {
      // Pre-declare and mark as current
      state.floatBitShadows.add("__bits_myFloat");
      state.floatShadowCurrent.add("__bits_myFloat");

      const result = write("myFloat", "f32", "3", null, "true");

      expect(result).not.toContain("union { float f; uint32_t u; }");
      // Should not have the read assignment, only the write-back
      expect(result).not.toContain("__bits_myFloat.f = myFloat;");
      // Should still have the write-back
      expect(result).toContain("myFloat = __bits_myFloat.f;");
    });

    it("marks shadow as current after write", () => {
      write("myFloat", "f32", "3", null, "true");

      expect(state.floatShadowCurrent.has("__bits_myFloat")).toBe(true);
    });

    it("writes a target that is not a variable through a union of its own", () => {
      const result = write("fa[1]", "f32", "31", null, "true", false);

      expect(result).toBe(
        [
          "{",
          `    ${F32_ANNOTATION}`,
          "    union { float f; uint32_t u; } __bits;",
          "    __bits.f = fa[1];",
          "    __bits.u = (__bits.u & ~((uint32_t)1U << 31)) | ((uint32_t)1U << 31);",
          "    fa[1] = __bits.f;",
          "}",
        ].join("\n"),
      );
      // It shares no shadow, so it leaves the variables' shadows alone
      expect(state.floatBitShadows.size).toBe(0);
      expect(state.floatShadowCurrent.size).toBe(0);
    });
  });

  describe("unionDeclaration", () => {
    it("declares the union after the annotation, for the read path too", () => {
      expect(FloatBitHelper.unionDeclaration("f32", "__bits_x")).toBe(
        `${F32_ANNOTATION}\nunion { float f; uint32_t u; } __bits_x;`,
      );
      expect(FloatBitHelper.bitsTypeOf("f64")).toBe("uint64_t");
    });
  });
});
