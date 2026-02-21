/**
 * Shared type constants for analyzers.
 *
 * Centralizes type definitions to avoid duplication across analyzers.
 */

/**
 * Type constants used across analyzers
 */
class TypeConstants {
  /**
   * Floating-point type names (C-Next and C).
   *
   * Used by:
   * - FloatModuloAnalyzer: detecting float operands in modulo expressions
   */
  static readonly FLOAT_TYPES: readonly string[] = [
    "f32",
    "f64",
    "float",
    "double",
  ];

  /**
   * Unsigned integer types valid as array/bit subscript indexes.
   *
   * Used by:
   * - ArrayIndexTypeAnalyzer: validating subscript index types
   */
  static readonly UNSIGNED_INDEX_TYPES: readonly string[] = [
    "u8",
    "u16",
    "u32",
    "u64",
    "bool",
  ];

  /**
   * Signed integer types (rejected as subscript indexes).
   *
   * Used by:
   * - ArrayIndexTypeAnalyzer: detecting signed integer subscript indexes
   */
  static readonly SIGNED_TYPES: readonly string[] = ["i8", "i16", "i32", "i64"];
}

export default TypeConstants;
