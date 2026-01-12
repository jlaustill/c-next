/**
 * TypeResolver - Handles type inference, classification, and validation
 * Extracted from CodeGenerator for better separation of concerns
 */
import CodeGenerator from "./CodeGenerator.js";
import {
  INTEGER_TYPES,
  FLOAT_TYPES,
  SIGNED_TYPES,
  UNSIGNED_TYPES,
  TYPE_WIDTH,
  TYPE_RANGES,
} from "./types/TTypeConstants.js";

class TypeResolver {
  private codeGen: CodeGenerator;

  constructor(codeGen: CodeGenerator) {
    this.codeGen = codeGen;
  }

  /**
   * ADR-024: Check if a type is any integer (signed or unsigned)
   */
  isIntegerType(typeName: string): boolean {
    return (INTEGER_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * ADR-024: Check if a type is a floating point type
   */
  isFloatType(typeName: string): boolean {
    return (FLOAT_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * ADR-024: Check if a type is a signed integer
   */
  isSignedType(typeName: string): boolean {
    return (SIGNED_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * ADR-024: Check if a type is an unsigned integer
   */
  isUnsignedType(typeName: string): boolean {
    return (UNSIGNED_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * Check if a type is a user-defined struct
   */
  isStructType(typeName: string): boolean {
    // Access CodeGenerator's knownStructs set via reference
    // eslint-disable-next-line @typescript-eslint/dot-notation
    return this.codeGen["knownStructs"].has(typeName);
  }

  /**
   * ADR-024: Check if conversion from sourceType to targetType is narrowing
   * Narrowing occurs when target type has fewer bits than source type
   */
  isNarrowingConversion(sourceType: string, targetType: string): boolean {
    const sourceWidth = TYPE_WIDTH[sourceType] || 0;
    const targetWidth = TYPE_WIDTH[targetType] || 0;

    if (sourceWidth === 0 || targetWidth === 0) {
      return false; // Can't determine for unknown types
    }

    return targetWidth < sourceWidth;
  }

  /**
   * ADR-024: Check if conversion involves a sign change
   * Sign change occurs when converting between signed and unsigned types
   */
  isSignConversion(sourceType: string, targetType: string): boolean {
    const sourceIsSigned = this.isSignedType(sourceType);
    const sourceIsUnsigned = this.isUnsignedType(sourceType);
    const targetIsSigned = this.isSignedType(targetType);
    const targetIsUnsigned = this.isUnsignedType(targetType);

    return (
      (sourceIsSigned && targetIsUnsigned) ||
      (sourceIsUnsigned && targetIsSigned)
    );
  }

  /**
   * ADR-024: Validate that a literal value fits within the target type's range.
   * Throws an error if the value doesn't fit.
   * @param literalText The literal text (e.g., "256", "-1", "0xFF")
   * @param targetType The target type (e.g., "u8", "i32")
   */
  validateLiteralFitsType(literalText: string, targetType: string): void {
    const range = TYPE_RANGES[targetType];
    if (!range) {
      return; // No validation for unknown types (floats, bools, etc.)
    }

    // Parse the literal value
    let value: bigint;
    try {
      const cleanText = literalText.trim();

      if (cleanText.match(/^-?\d+$/)) {
        // Decimal integer
        value = BigInt(cleanText);
      } else if (cleanText.match(/^0[xX][0-9a-fA-F]+$/)) {
        // Hex literal
        value = BigInt(cleanText);
      } else if (cleanText.match(/^0[bB][01]+$/)) {
        // Binary literal
        value = BigInt(cleanText);
      } else {
        // Not an integer literal we can validate
        return;
      }
    } catch {
      return; // Can't parse, skip validation
    }

    const [min, max] = range;

    // Check if value is negative for unsigned type
    if (this.isUnsignedType(targetType) && value < 0n) {
      throw new Error(
        `Error: Negative value ${literalText} cannot be assigned to unsigned type ${targetType}`,
      );
    }

    // Check if value is out of range
    if (value < min || value > max) {
      throw new Error(
        `Error: Value ${literalText} exceeds ${targetType} range (${min} to ${max})`,
      );
    }
  }
}

export default TypeResolver;
