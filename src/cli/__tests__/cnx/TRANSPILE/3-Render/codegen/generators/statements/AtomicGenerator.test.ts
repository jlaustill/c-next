/**
 * Unit tests for AtomicGenerator
 *
 * Tests atomic Read-Modify-Write operation generation for embedded platforms.
 */

import { describe, it, expect } from "vitest";
import atomicGenerators from "../../../../../../../../cnx/TRANSPILE/3-Render/codegen/generators/statements/AtomicGenerator";
import TTypeInfo from "../../../../../../../../cnx/types/TTypeInfo";

const {
  generateAtomicRMW,
  generateInnerAtomicOp,
  generateLdrexStrexLoop,
  generatePrimaskWrapper,
} = atomicGenerators;

// ============================================================================
// Test Helpers
// ============================================================================

function createTypeInfo(
  baseType: string,
  overflowBehavior: "clamp" | "wrap" = "clamp",
): TTypeInfo {
  return {
    baseType,
    bitWidth: 32,
    isArray: false,
    isConst: false,
    overflowBehavior,
  };
}

/** A catalog target with, or without, LDREX/STREX */

// ============================================================================
// Tests - generateInnerAtomicOp
// ============================================================================

describe("AtomicGenerator", () => {
  describe("generateInnerAtomicOp", () => {
    it("generates clamp helper for += with clamp behavior", () => {
      const typeInfo = createTypeInfo("u32", "clamp");
      const result = generateInnerAtomicOp("+=", "5", typeInfo, "add");

      expect(result.code).toBe("cnx_clamp_add_u32(__old, 5)");
      // 2.2 planned the helper; 2.3 reports nothing (#1991)
      expect(result.effects).toEqual([]);
    });

    it("generates clamp helper for -= with clamp behavior", () => {
      const typeInfo = createTypeInfo("u16", "clamp");
      const result = generateInnerAtomicOp("-=", "value", typeInfo, "sub");

      expect(result.code).toBe("cnx_clamp_sub_u16(__old, value)");
      // 2.2 planned the helper; 2.3 reports nothing (#1991)
      expect(result.effects).toEqual([]);
    });

    it("generates clamp helper for *= with clamp behavior", () => {
      const typeInfo = createTypeInfo("i8", "clamp");
      const result = generateInnerAtomicOp("*=", "2", typeInfo, "mul");

      expect(result.code).toBe("cnx_clamp_mul_i8(__old, 2)");
      // 2.2 planned the helper; 2.3 reports nothing (#1991)
      expect(result.effects).toEqual([]);
    });

    it("generates natural arithmetic when no clamp helper is chosen", () => {
      const typeInfo = createTypeInfo("u32", "wrap");
      const result = generateInnerAtomicOp("+=", "5", typeInfo, null);

      expect(result.code).toBe("__old + 5");
      expect(result.effects).toHaveLength(0);
    });

    it("generates natural arithmetic for non-clamp ops", () => {
      const typeInfo = createTypeInfo("u32", "clamp");
      const result = generateInnerAtomicOp("/=", "2", typeInfo, null);

      expect(result.code).toBe("__old / 2");
      expect(result.effects).toHaveLength(0);
    });

    it("generates natural arithmetic for bitwise ops", () => {
      const typeInfo = createTypeInfo("u32", "clamp");

      expect(generateInnerAtomicOp("&=", "0xFF", typeInfo, null).code).toBe(
        "__old & 0xFF",
      );
      expect(generateInnerAtomicOp("|=", "0x01", typeInfo, null).code).toBe(
        "__old | 0x01",
      );
      expect(generateInnerAtomicOp("^=", "mask", typeInfo, null).code).toBe(
        "__old ^ mask",
      );
    });

    it("generates natural arithmetic for shift ops", () => {
      const typeInfo = createTypeInfo("u32", "clamp");

      expect(generateInnerAtomicOp("<<=", "2", typeInfo, null).code).toBe(
        "__old << 2",
      );
      expect(generateInnerAtomicOp(">>=", "4", typeInfo, null).code).toBe(
        "__old >> 4",
      );
    });

    it("generates natural arithmetic for floats even with clamp", () => {
      const typeInfo = createTypeInfo("f32", "clamp");
      const result = generateInnerAtomicOp("+=", "1.0f", typeInfo, null);

      expect(result.code).toBe("__old + 1.0f");
      expect(result.effects).toHaveLength(0);
    });

    it("refuses an operator that is not a compound assignment", () => {
      const typeInfo = createTypeInfo("u32", "wrap");

      expect(() => generateInnerAtomicOp("??=", "5", typeInfo, null)).toThrow(
        "an atomic read-modify-write is a compound assignment (got '??=')",
      );
    });
  });

  // ============================================================================
  // Tests - generateLdrexStrexLoop
  // ============================================================================

  describe("generateLdrexStrexLoop", () => {
    it("generates LDREX/STREX loop for u32", () => {
      const typeInfo = createTypeInfo("u32");
      const result = generateLdrexStrexLoop(
        "counter",
        "__old + 1",
        typeInfo,
        [],
      );

      expect(result.code).toContain("do {");
      expect(result.code).toContain("uint32_t __old = __LDREXW(&counter)");
      expect(result.code).toContain("uint32_t __new = __old + 1");
      expect(result.code).toContain(
        "if (__STREXW(__new, &counter) == 0) {\n        break;\n    }",
      );
      // MISRA C:2012 Rule 15.6: the if's body is a compound statement. The
      // unbraced form reached every LDREX target's output, hidden from
      // cppcheck by a test stub that declared the intrinsics (#1668)
      expect(result.code).not.toMatch(/\)\s*break;/);
      expect(result.code).toContain("} while (1);");
      // 2.2 requires CMSIS and the loop's C type before 2.3 writes it (#1991)
      expect(result.effects).toEqual([]);
    });

    it("generates LDREX/STREX loop for u16", () => {
      const typeInfo = createTypeInfo("u16");
      const result = generateLdrexStrexLoop("value", "__old - 1", typeInfo, []);

      expect(result.code).toContain("uint16_t __old = __LDREXH(&value)");
      expect(result.code).toContain("__STREXH(__new, &value)");
    });

    it("generates LDREX/STREX loop for u8", () => {
      const typeInfo = createTypeInfo("u8");
      const result = generateLdrexStrexLoop(
        "byte",
        "__old | 0x80",
        typeInfo,
        [],
      );

      expect(result.code).toContain("uint8_t __old = __LDREXB(&byte)");
      expect(result.code).toContain("__STREXB(__new, &byte)");
    });

    it("generates LDREX/STREX loop for signed types", () => {
      const typeInfo = createTypeInfo("i32");
      const result = generateLdrexStrexLoop(
        "signed_val",
        "__old + 5",
        typeInfo,
        [],
      );

      expect(result.code).toContain("int32_t __old = __LDREXW(&signed_val)");
      expect(result.code).toContain("int32_t __new");
    });

    it("preserves inner effects", () => {
      const typeInfo = createTypeInfo("u32");
      const innerEffects = [
        { type: "set-array-init-count" as const, count: 1 },
      ];
      const result = generateLdrexStrexLoop(
        "counter",
        "helper()",
        typeInfo,
        innerEffects,
      );

      expect(result.effects).toContainEqual({
        type: "set-array-init-count",
        count: 1,
      });
    });
  });

  // ============================================================================
  // Tests - generatePrimaskWrapper
  // ============================================================================

  describe("generatePrimaskWrapper", () => {
    it("generates PRIMASK wrapper for simple op", () => {
      const typeInfo = createTypeInfo("u32", "wrap");
      const result = generatePrimaskWrapper(
        "counter",
        "+=",
        "1",
        typeInfo,
        null,
      );

      // #1146: the ADR-050 wrappers a critical block masks through, not raw
      // CMSIS with no platform guard
      expect(result.code).toContain(
        "uint32_t __primask = __cnx_get_PRIMASK();",
      );
      expect(result.code).toContain("__cnx_disable_irq();");
      expect(result.code).toContain("counter += 1;");
      expect(result.code).toContain("__cnx_set_PRIMASK(__primask);");
    });

    it("generates PRIMASK wrapper with clamp helper for +=", () => {
      const typeInfo = createTypeInfo("u32", "clamp");
      const result = generatePrimaskWrapper(
        "counter",
        "+=",
        "5",
        typeInfo,
        "add",
      );

      expect(result.code).toContain("counter = cnx_clamp_add_u32(counter, 5);");
    });

    it("generates PRIMASK wrapper with clamp helper for -=", () => {
      const typeInfo = createTypeInfo("u16", "clamp");
      const result = generatePrimaskWrapper(
        "value",
        "-=",
        "10",
        typeInfo,
        "sub",
      );

      expect(result.code).toContain("value = cnx_clamp_sub_u16(value, 10);");
    });

    it("generates PRIMASK wrapper with clamp helper for *=", () => {
      const typeInfo = createTypeInfo("i8", "clamp");
      const result = generatePrimaskWrapper(
        "factor",
        "*=",
        "2",
        typeInfo,
        "mul",
      );

      expect(result.code).toContain("factor = cnx_clamp_mul_i8(factor, 2);");
    });

    it("generates PRIMASK wrapper without clamp for /=", () => {
      const typeInfo = createTypeInfo("u32", "clamp");
      const result = generatePrimaskWrapper("value", "/=", "2", typeInfo, null);

      expect(result.code).toContain("value /= 2;");
    });

    it("generates PRIMASK wrapper without clamp for floats", () => {
      const typeInfo = createTypeInfo("f32", "clamp");
      const result = generatePrimaskWrapper(
        "value",
        "+=",
        "1.0f",
        typeInfo,
        null,
      );

      expect(result.code).toContain("value += 1.0f;");
    });
  });

  // ============================================================================
  // Tests - generateAtomicRMW (integration)
  // ============================================================================

  describe("generateAtomicRMW", () => {
    const rmw = (baseType: string, form: "ldrex-strex" | "interrupt-mask") =>
      generateAtomicRMW(
        "counter",
        "+=",
        "1",
        createTypeInfo(baseType, "clamp"),
        "add",
        form,
      );

    it("writes the LDREX/STREX loop 2.2 planned", () => {
      const result = rmw("u32", "ldrex-strex");

      expect(result.code).toContain("__LDREXW");
      expect(result.code).toContain("__STREXW");
    });

    it("writes the masked region 2.2 planned", () => {
      const result = rmw("u32", "interrupt-mask");

      expect(result.code).toContain("__cnx_get_PRIMASK()");
      expect(result.code).toContain("__cnx_disable_irq()");
    });

    it("fails when 2.2 planned a loop for a type with no exclusive access", () => {
      expect(() => rmw("u64", "ldrex-strex")).toThrow(
        /exclusive-access type \(got u64\)/,
      );
    });

    it("calls the clamp helper 2.2 planned", () => {
      expect(rmw("u32", "ldrex-strex").code).toContain("cnx_clamp_add_u32(");
    });
  });
});
