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
   * - PrimitiveKindUtils: the float veto on an operand-type string
   */
  static readonly FLOAT_TYPES: readonly string[] = [
    "f32",
    "f64",
    "float",
    "double",
  ];
}

export default TypeConstants;
