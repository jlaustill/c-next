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
}

export default TypeConstants;
