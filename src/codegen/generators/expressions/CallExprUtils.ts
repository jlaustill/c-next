/**
 * Pure utility functions for function call expression generation.
 * Extracted from CallExprGenerator for testability (Issue #420).
 */
import TYPE_MAP from "../../types/TYPE_MAP";

/**
 * Issue #315: Small primitive types that are always passed by value.
 * These match the types used in Issue #269 for pass-by-value optimization.
 */
const SMALL_PRIMITIVE_TYPES = new Set(["u8", "u16", "i8", "i16", "bool"]);

class CallExprUtils {
  /**
   * Issue #304: Map C-Next type to C type for static_cast.
   * Returns the input unchanged if not a known C-Next primitive type.
   */
  static mapTypeToCType(cnxType: string): string {
    return TYPE_MAP[cnxType] || cnxType;
  }

  /**
   * Issue #315: Check if a type is a small primitive that should be passed by value.
   * Used for cross-file function calls where modification info is unavailable.
   */
  static isSmallPrimitiveType(typeName: string): boolean {
    return SMALL_PRIMITIVE_TYPES.has(typeName);
  }

  /**
   * ADR-051: Generate the helper function name for safe_div/safe_mod.
   */
  static generateSafeDivModHelperName(
    funcName: "safe_div" | "safe_mod",
    cnxType: string,
  ): string {
    const op = funcName === "safe_div" ? "div" : "mod";
    return `cnx_safe_${op}_${cnxType}`;
  }

  /**
   * Issue #304: Generate a C++ static_cast expression.
   * Used for enum class to integer conversions.
   */
  static generateStaticCast(code: string, targetType: string): string {
    const cType = CallExprUtils.mapTypeToCType(targetType);
    return `static_cast<${cType}>(${code})`;
  }
}

export default CallExprUtils;
