/**
 * NarrowingCastHelper - MISRA C:2012 Rule 10.3 compliance
 *
 * Issue #845: Wraps expressions with explicit casts when assigning
 * to narrower types or different essential type categories.
 *
 * C's integer promotion rules mean bit operations on u8/u16 produce int,
 * which MISRA flags when assigned back to narrower types without explicit cast.
 */

import TYPE_WIDTH from "../types/TYPE_WIDTH.js";
import CppModeHelper from "./CppModeHelper.js";
import TYPE_MAP from "../types/TYPE_MAP.js";

/**
 * Extended type widths including C's promoted "int" type.
 * The shared TYPE_WIDTH doesn't include "int" since it's not a C-Next type.
 */
const EXTENDED_TYPE_WIDTH: Record<string, number> = {
  ...TYPE_WIDTH,
  int: 32, // C's int after promotion
};

/**
 * Types that get promoted to int in C's integer promotion rules.
 * In C, operations on types smaller than int get promoted to int.
 */
const PROMOTED_TO_INT = new Set(["u8", "i8", "u16", "i16", "bool"]);

/**
 * Helper for adding MISRA 10.3 compliant casts to generated C code.
 */
class NarrowingCastHelper {
  /**
   * Check if a cast is needed for MISRA 10.3 compliance.
   * Returns true if:
   * - Source is wider than target (narrowing)
   * - Source and target are different essential type categories
   *
   * @param sourceType - Type of the expression (C-Next type or "int" for promoted)
   * @param targetType - Type of the target variable (C-Next type)
   */
  static needsCast(sourceType: string, targetType: string): boolean {
    // Same type never needs cast
    if (sourceType === targetType) {
      return false;
    }

    // Bool target from non-bool source always needs conversion
    if (targetType === "bool" && sourceType !== "bool") {
      return true;
    }

    const sourceWidth = EXTENDED_TYPE_WIDTH[sourceType];
    const targetWidth = EXTENDED_TYPE_WIDTH[targetType];

    // Unknown types - be conservative, no cast
    if (sourceWidth === undefined || targetWidth === undefined) {
      return false;
    }

    // Narrowing: source wider than target
    return sourceWidth > targetWidth;
  }

  /**
   * Wrap expression with cast if needed for MISRA 10.3 compliance.
   *
   * @param expr - The generated C expression
   * @param sourceType - Type of the expression (C-Next type or "int")
   * @param targetType - Type of the assignment target (C-Next type)
   * @returns Expression with cast wrapper if needed, or original expression
   */
  static wrap(expr: string, sourceType: string, targetType: string): string {
    if (!NarrowingCastHelper.needsCast(sourceType, targetType)) {
      return expr;
    }

    // Bool target: use comparison instead of cast (MISRA 10.5)
    if (targetType === "bool") {
      return `((${expr}) != 0U)`;
    }

    // Get C type name for the target
    const cType = TYPE_MAP[targetType] ?? targetType;
    return CppModeHelper.cast(cType, expr);
  }

  /**
   * Determine the result type of C integer promotion for a given type.
   *
   * In C, operations on types smaller than int are promoted:
   * - u8, i8, u16, i16, bool -> int (32-bit)
   * - u32, i32, u64, i64 -> no promotion (already >= int width)
   *
   * @param baseType - The C-Next type of the operand
   * @returns "int" for promoted types, or the original type
   */
  static getPromotedType(baseType: string): string {
    if (PROMOTED_TO_INT.has(baseType)) {
      return "int";
    }
    return baseType;
  }
}

export default NarrowingCastHelper;
