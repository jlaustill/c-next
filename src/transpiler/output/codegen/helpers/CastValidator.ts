/**
 * CastValidator
 *
 * Validates type casts for safety (narrowing, sign changes) and determines
 * when clamping casts are required (float-to-int).
 *
 * ADR-024: Integer cast validation
 * Issue #632: Float-to-integer clamping
 */

import TYPE_WIDTH from "../types/TYPE_WIDTH.js";

/**
 * Set of signed integer type names.
 */
const SIGNED_INTEGERS = new Set(["i8", "i16", "i32", "i64"]);

/**
 * Set of unsigned integer type names.
 */
const UNSIGNED_INTEGERS = new Set(["u8", "u16", "u32", "u64"]);

/**
 * Set of all integer type names.
 */
const ALL_INTEGERS = new Set([...SIGNED_INTEGERS, ...UNSIGNED_INTEGERS]);

/**
 * Set of float type names.
 */
const FLOAT_TYPES = new Set(["f32", "f64"]);

class CastValidator {
  /**
   * Check if a type is an integer type.
   */
  static isIntegerType(typeName: string): boolean {
    return ALL_INTEGERS.has(typeName);
  }

  /**
   * Check if a type is a floating-point type.
   */
  static isFloatType(typeName: string): boolean {
    return FLOAT_TYPES.has(typeName);
  }

  /**
   * Check if a type is signed.
   */
  static isSignedType(typeName: string): boolean {
    return SIGNED_INTEGERS.has(typeName);
  }

  /**
   * Check if a type is unsigned.
   */
  static isUnsignedType(typeName: string): boolean {
    return UNSIGNED_INTEGERS.has(typeName);
  }

  /**
   * Check if a conversion from sourceType to targetType is narrowing.
   * Narrowing occurs when target type has fewer bits than source type.
   */
  static isNarrowingConversion(
    sourceType: string,
    targetType: string,
  ): boolean {
    const sourceWidth = TYPE_WIDTH[sourceType] ?? 0;
    const targetWidth = TYPE_WIDTH[targetType] ?? 0;
    return targetWidth < sourceWidth;
  }

  /**
   * Check if a conversion involves a sign change.
   * Sign change occurs when converting between signed and unsigned types.
   */
  static isSignConversion(sourceType: string, targetType: string): boolean {
    const sourceIsSigned = CastValidator.isSignedType(sourceType);
    const targetIsSigned = CastValidator.isSignedType(targetType);
    return sourceIsSigned !== targetIsSigned;
  }

  /**
   * Validate an integer-to-integer cast.
   * Throws an error if the cast is narrowing or involves a sign change.
   *
   * @param sourceType The source integer type
   * @param targetType The target integer type
   * @throws Error if the cast is invalid
   */
  static validateIntegerCast(sourceType: string, targetType: string): void {
    if (
      !CastValidator.isIntegerType(sourceType) ||
      !CastValidator.isIntegerType(targetType)
    ) {
      return; // Not an integer-to-integer cast, validation not applicable
    }

    if (CastValidator.isNarrowingConversion(sourceType, targetType)) {
      const targetWidth = TYPE_WIDTH[targetType] ?? 0;
      throw new Error(
        `Error: Cannot cast ${sourceType} to ${targetType} (narrowing). ` +
          `Use bit indexing: expr[0, ${targetWidth}]`,
      );
    }

    if (CastValidator.isSignConversion(sourceType, targetType)) {
      const targetWidth = TYPE_WIDTH[targetType] ?? 0;
      throw new Error(
        `Error: Cannot cast ${sourceType} to ${targetType} (sign change). ` +
          `Use bit indexing: expr[0, ${targetWidth}]`,
      );
    }
  }

  /**
   * Check if a cast requires clamping (float-to-integer).
   * Float-to-integer casts need explicit bounds checking to avoid undefined behavior.
   *
   * @param sourceType The source type
   * @param targetType The target type
   * @returns true if clamping is required
   */
  static requiresClampingCast(
    sourceType: string | null,
    targetType: string,
  ): boolean {
    if (!sourceType) return false;

    return (
      CastValidator.isIntegerType(targetType) &&
      CastValidator.isFloatType(sourceType)
    );
  }

  /**
   * Get the bit width for an error message.
   */
  static getTypeWidth(typeName: string): number {
    return TYPE_WIDTH[typeName] ?? 0;
  }
}

export default CastValidator;
