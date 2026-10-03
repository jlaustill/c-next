/**
 * Unit tests for AtomicGenerator
 *
 * Tests atomic Read-Modify-Write operation generation for embedded platforms.
 */

import { describe, it, expect } from "vitest";
import atomicGenerators from "../AtomicGenerator";
import TTypeInfo from "../../../../../../types/TTypeInfo";
import type ITargetDescription from "../../../../../../types/ITargetDescription";
import TargetResolver from "../../../../../../utils/TargetResolver";
import NodeFileSystem from "../../../../../../PARSE/1-Discover/NodeFileSystem";

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
function createCapabilities(hasLdrexStrex: boolean): ITargetDescription {
  return TargetResolver.byName(
    hasLdrexStrex ? "cortex-m7" : "cortex-m0",
    NodeFileSystem.instance,
  )!;
}

// ============================================================================
// Tests - generateInnerAtomicOp
// ============================================================================

describe("AtomicGenerator", () => {
  describe("generateInnerAtomicOp", () => {
    it("generates clamp helper for += with clamp behavior", () => {
      const typeInfo = createTypeInfo("u32", "clamp");
      const result = generateInnerAtomicOp("+=", "5", typeInfo, "add");

      expect(result.code).toBe("cnx_clamp_add_u32(__old, 5)");
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]).toEqual({
        type: "helper",
        operation: "add",
        cnxType: "u32",
      });
    });

    it("generates clamp helper for -= with clamp behavior", () => {
      const typeInfo = createTypeInfo("u16", "clamp");
      const result = generateInnerAtomicOp("-=", "value", typeInfo, "sub");

      expect(result.code).toBe("cnx_clamp_sub_u16(__old, value)");
      expect(result.effects[0]).toEqual({
        type: "helper",
        operation: "sub",
        cnxType: "u16",
      });
    });

    it("generates clamp helper for *= with clamp behavior", () => {
      const typeInfo = createTypeInfo("i8", "clamp");
      const result = generateInnerAtomicOp("*=", "2", typeInfo, "mul");

      expect(result.code).toBe("cnx_clamp_mul_i8(__old, 2)");
      expect(result.effects[0]).toEqual({
        type: "helper",
        operation: "mul",
        cnxType: "i8",
      });
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

    it("handles unknown operator with default +", () => {
      const typeInfo = createTypeInfo("u32", "wrap");
      const result = generateInnerAtomicOp("??=", "5", typeInfo, null);

      expect(result.code).toBe("__old + 5");
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
      expect(result.effects).toContainEqual({
        type: "include",
        header: "cmsis",
      });
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
        { type: "helper" as const, operation: "add", cnxType: "u32" },
      ];
      const result = generateLdrexStrexLoop(
        "counter",
        "helper()",
        typeInfo,
        innerEffects,
      );

      expect(result.effects).toContainEqual({
        type: "helper",
        operation: "add",
        cnxType: "u32",
      });
      expect(result.effects).toContainEqual({
        type: "include",
        header: "cmsis",
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
      expect(result.effects).toContainEqual({
        type: "include",
        header: "irq_wrappers",
        line: undefined,
      });
      expect(result.effects).not.toContainEqual(
        expect.objectContaining({ header: "cmsis" }),
      );
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
      expect(result.effects).toContainEqual({
        type: "helper",
        operation: "add",
        cnxType: "u32",
      });
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
      // Should not have helper effect for division
      expect(result.effects.filter((e) => e.type === "helper")).toHaveLength(0);
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
      // Floats don't use clamp helpers
      expect(result.effects.filter((e) => e.type === "helper")).toHaveLength(0);
    });
  });

  // ============================================================================
  // Tests - generateAtomicRMW (integration)
  // ============================================================================

  describe("generateAtomicRMW", () => {
    it("uses LDREX/STREX when available for supported type", () => {
      const typeInfo = createTypeInfo("u32");
      const caps = createCapabilities(true);
      const result = generateAtomicRMW(
        "counter",
        "+=",
        "1",
        typeInfo,
        "add",
        caps,
      );

      expect(result.code).toContain("__LDREXW");
      expect(result.code).toContain("__STREXW");
    });

    it("falls back to PRIMASK when LDREX/STREX not available", () => {
      const typeInfo = createTypeInfo("u32");
      const caps = createCapabilities(false);
      const result = generateAtomicRMW(
        "counter",
        "+=",
        "1",
        typeInfo,
        "add",
        caps,
      );

      expect(result.code).toContain("__cnx_get_PRIMASK()");
      expect(result.code).toContain("__cnx_disable_irq()");
    });

    it("falls back to PRIMASK for u64 (no LDREX support)", () => {
      const typeInfo = createTypeInfo("u64");
      const caps = createCapabilities(true);
      const result = generateAtomicRMW(
        "counter",
        "+=",
        "1",
        typeInfo,
        "add",
        caps,
      );

      // u64 doesn't have LDREX support, should mask interrupts
      expect(result.code).toContain("__cnx_get_PRIMASK()");
    });

    it("includes clamp helper effect when using clamp behavior", () => {
      const typeInfo = createTypeInfo("u32", "clamp");
      const caps = createCapabilities(true);
      const result = generateAtomicRMW(
        "counter",
        "+=",
        "5",
        typeInfo,
        "add",
        caps,
      );

      expect(result.effects).toContainEqual({
        type: "helper",
        operation: "add",
        cnxType: "u32",
      });
    });

    it("includes cmsis header effect", () => {
      const typeInfo = createTypeInfo("u32");
      const caps = createCapabilities(true);
      const result = generateAtomicRMW(
        "counter",
        "+=",
        "1",
        typeInfo,
        "add",
        caps,
      );

      expect(result.effects).toContainEqual({
        type: "include",
        header: "cmsis",
      });
    });
  });
});
