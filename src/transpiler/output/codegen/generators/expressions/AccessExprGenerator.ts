/**
 * Access Expression Generator
 *
 * Generates C code for string buffer property access:
 * - .capacity → compile-time max string length (excluding null terminator)
 * - .size → compile-time buffer size (capacity + 1, for null terminator)
 *
 * Also provides helper for bitmap field access.
 *
 * Note: Explicit length properties (.bit_length, .byte_length, .element_count,
 * .char_count) are handled in PostfixExpressionGenerator.ts, not here.
 * The deprecated .length property was removed per ADR-058.
 */
import type IBitmapFieldLayout from "../../../../types/IBitmapFieldLayout";
import IGeneratorOutput from "../IGeneratorOutput";
import TTypeInfo from "../../../../types/TTypeInfo";
import CodeGenState from "../../../../state/CodeGenState.js";
import NarrowingCastHelper from "../../helpers/NarrowingCastHelper.js";
import invariant from "../../../../../utils/invariant";

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
  // #1322: ADR-045's storage properties are E0887 in pass 2.1, decided from
  // the subject's declared type rather than from a type info this generator
  // happens to hold.
  invariant(
    false,
    `.capacity is read from a string -- E0887 rejects this in pass 2.1, before this runs`,
  );
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
  // #1322: ADR-045's storage properties are E0887 in pass 2.1, decided from
  // the subject's declared type rather than from a type info this generator
  // happens to hold.
  invariant(
    false,
    `.size is read from a string -- E0887 rejects this in pass 2.1, before this runs`,
  );
};

/**
 * Generate code for bitmap field read access.
 *
 * Single bit fields generate: ((value >> offset) & 1)
 * Multi-bit fields generate: ((value >> offset) & mask)
 *
 * MISRA C:2012 Rule 10.3: When target type is known (via CodeGenState.expectedType),
 * wraps expression with appropriate cast. Bool targets use != 0U comparison.
 */
const generateBitmapFieldAccess = (
  result: string,
  fieldInfo: IBitmapFieldLayout,
): IGeneratorOutput => {
  let expr: string;
  if (fieldInfo.width === 1) {
    // Single bit: ((value >> offset) & 1)
    expr = `((${result} >> ${fieldInfo.offset}) & 1)`;
  } else {
    // Multi-bit: ((value >> offset) & mask)
    const mask = (1 << fieldInfo.width) - 1;
    expr = `((${result} >> ${fieldInfo.offset}) & 0x${mask.toString(16).toUpperCase()})`;
  }

  // MISRA 10.3: Add narrowing cast if target type is known
  const targetType = CodeGenState.expectedType;
  if (targetType) {
    // Bitmap operations on small types produce int in C
    expr = NarrowingCastHelper.wrap(expr, "int", targetType);
  }

  return { code: expr, effects: [] };
};

// Export all generators
const accessGenerators = {
  generateCapacityProperty,
  generateSizeProperty,
  generateBitmapFieldAccess,
};

export default accessGenerators;
