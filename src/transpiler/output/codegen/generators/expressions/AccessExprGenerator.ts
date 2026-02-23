/**
 * Access Expression Generator (ADR-053 A2 Phase 6)
 *
 * Generates C code for property access expressions:
 * - .capacity property for strings
 * - .size property for strings (buffer size = capacity + 1)
 *
 * Also provides helper for bitmap field access.
 *
 * Note: .length property was removed (ADR-058). Use explicit properties:
 * .bit_length, .byte_length, .element_count, .char_count
 */
import IGeneratorOutput from "../IGeneratorOutput";
import TTypeInfo from "../../types/TTypeInfo";

/**
 * Generate code for .capacity property access.
 *
 * Only valid for string types - returns the max string length (excluding null terminator).
 */
const generateCapacityProperty = (
  typeInfo: TTypeInfo | undefined,
): IGeneratorOutput => {
  if (typeInfo?.isString && typeInfo.stringCapacity !== undefined) {
    return { code: String(typeInfo.stringCapacity), effects: [] };
  }
  throw new Error(`Error: .capacity is only available on string types`);
};

/**
 * Generate code for .size property access.
 *
 * Only valid for string types - returns buffer size (capacity + 1 for null terminator).
 * Use with functions like fgets that need buffer size, not max length.
 */
const generateSizeProperty = (
  typeInfo: TTypeInfo | undefined,
): IGeneratorOutput => {
  if (typeInfo?.isString && typeInfo.stringCapacity !== undefined) {
    return { code: String(typeInfo.stringCapacity + 1), effects: [] };
  }
  throw new Error(`Error: .size is only available on string types`);
};

/**
 * Bitmap field info for generating bit access code.
 */
interface BitmapFieldInfo {
  offset: number;
  width: number;
}

/**
 * Generate code for bitmap field read access.
 *
 * Single bit fields generate: ((value >> offset) & 1)
 * Multi-bit fields generate: ((value >> offset) & mask)
 */
const generateBitmapFieldAccess = (
  result: string,
  fieldInfo: BitmapFieldInfo,
): IGeneratorOutput => {
  if (fieldInfo.width === 1) {
    // Single bit: ((value >> offset) & 1)
    return { code: `((${result} >> ${fieldInfo.offset}) & 1)`, effects: [] };
  } else {
    // Multi-bit: ((value >> offset) & mask)
    const mask = (1 << fieldInfo.width) - 1;
    return {
      code: `((${result} >> ${fieldInfo.offset}) & 0x${mask.toString(16).toUpperCase()})`,
      effects: [],
    };
  }
};

// Export all generators
const accessGenerators = {
  generateCapacityProperty,
  generateSizeProperty,
  generateBitmapFieldAccess,
};

export default accessGenerators;
