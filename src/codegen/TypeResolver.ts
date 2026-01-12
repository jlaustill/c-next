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
}

export default TypeResolver;
