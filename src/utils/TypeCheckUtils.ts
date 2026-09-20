/**
 * Type checking utilities for C-Next types.
 * Pure predicate functions for type classification.
 *
 * Extracted from CodeGenerator.ts as part of ADR-065 decomposition.
 */

/**
 * ADR-024's four type lists, imported rather than respelled.
 *
 * #1450: all four were declared here AND in `transpiler/types/`, byte-identical
 * — so a new integer width had to be added in two files, and nothing failed if
 * only one was. That is the same defect `INTEGER_TYPES` records having fixed
 * one level down, which is what makes this the second half of it rather than a
 * new one: it stopped respelling the lists it is built from while its own
 * consumers went on respelling it.
 */
import INTEGER_TYPES from "../transpiler/types/INTEGER_TYPES";
import UNSIGNED_TYPES from "../transpiler/types/UNSIGNED_TYPES";
import SIGNED_TYPES from "../transpiler/types/SIGNED_TYPES";
import FLOAT_TYPES from "../transpiler/types/FLOAT_TYPES";

/** Standard bit widths for MMIO optimization */
const STANDARD_WIDTHS = [8, 16, 32] as const;

class TypeCheckUtils {
  /**
   * Check if a type name is a C-Next integer type.
   *
   * @param typeName - The type name to check
   * @returns true if it's u8, u16, u32, u64, i8, i16, i32, or i64
   */
  static isInteger(typeName: string): boolean {
    return (INTEGER_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * Check if a type name is an unsigned integer type.
   *
   * @param typeName - The type name to check
   * @returns true if it's u8, u16, u32, or u64
   */
  static isUnsigned(typeName: string): boolean {
    return (UNSIGNED_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * Check if a type name is a signed integer type.
   *
   * @param typeName - The type name to check
   * @returns true if it's i8, i16, i32, or i64
   */
  static isSigned(typeName: string): boolean {
    return (SIGNED_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * Check if a type name is a floating point type.
   *
   * @param typeName - The type name to check
   * @returns true if it's f32 or f64
   */
  static isFloat(typeName: string): boolean {
    return (FLOAT_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * Check if a type name is a string type (string<N>).
   *
   * @param typeName - The type name to check
   * @returns true if it matches string<N> pattern
   */
  static isString(typeName: string): boolean {
    return /^string<\d+>$/.test(typeName);
  }

  /**
   * Extract capacity from a string type.
   *
   * @param typeName - The string type (e.g., "string<32>")
   * @returns The capacity or null if not a string type
   */
  static getStringCapacity(typeName: string): number | null {
    const match = /^string<(\d+)>$/.exec(typeName);
    return match ? Number.parseInt(match[1], 10) : null;
  }

  /**
   * Check if a bit width is a standard MMIO-optimizable width.
   *
   * @param width - The bit width
   * @returns true if it's 8, 16, or 32 bits
   */
  static isStandardWidth(width: number): boolean {
    return (STANDARD_WIDTHS as readonly number[]).includes(width);
  }

  /**
   * Check if a type uses native C arithmetic (no overflow checking).
   * Floats overflow to infinity, so they don't need clamp/wrap.
   *
   * @param typeName - The type name
   * @returns true if it's a float type
   */
  static usesNativeArithmetic(typeName: string): boolean {
    return typeName.startsWith("f");
  }
}

export default TypeCheckUtils;
