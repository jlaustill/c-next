/**
 * Access Expression Generator (ADR-053 A2 Phase 6)
 *
 * Generates C code for property access expressions:
 * - .length property for arrays, strings, and integers
 * - .capacity property for strings
 * - .size property for strings (buffer size = capacity + 1)
 *
 * Also provides helper for bitmap field access.
 */
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import TTypeInfo from "../../types/TTypeInfo";

// Type width mappings - C-Next integer types to their bit widths
const TYPE_WIDTH: Record<string, number> = {
  u8: 8,
  u16: 16,
  u32: 32,
  u64: 64,
  i8: 8,
  i16: 16,
  i32: 32,
  i64: 64,
  f32: 32,
  f64: 64,
  bool: 1,
};

// C type widths for header-defined types
const C_TYPE_WIDTH: Record<string, number> = {
  uint8_t: 8,
  uint16_t: 16,
  uint32_t: 32,
  uint64_t: 64,
  int8_t: 8,
  int16_t: 16,
  int32_t: 32,
  int64_t: 64,
  float: 32,
  double: 64,
};

/**
 * Context passed to property generators.
 * Contains the current expression state needed for property resolution.
 */
interface PropertyContext {
  /** Current result string being built */
  result: string;
  /** Primary identifier (if any) */
  primaryId: string | undefined;
  /** Current resolved identifier (for type lookups) */
  currentIdentifier: string | undefined;
  /** How many array dimensions have been subscripted */
  subscriptDepth: number;
  /** Previous struct type in chain (for struct member .length) */
  previousStructType: string | undefined;
  /** Previous member name in chain (for struct member .length) */
  previousMemberName: string | undefined;
  /** Type info from type registry */
  typeInfo: TTypeInfo | undefined;
  /** Main function args parameter name (for args.length -> argc) */
  mainArgsName: string | undefined;
  /** Length cache for string lengths */
  lengthCache: ReadonlyMap<string, string> | undefined;
  /** Struct field info lookup function */
  getStructFieldInfo: (
    structType: string,
    fieldName: string,
  ) => { type: string; dimensions?: number[] } | undefined;
  /** Issue #201: Bitmap bit width lookup function */
  getBitmapBitWidth?: (bitmapTypeName: string) => number | undefined;
}

/**
 * Result of property generation.
 */
interface PropertyResult {
  /** Generated code (or null if property wasn't handled) */
  code: string | null;
  /** Effects to apply */
  effects: TGeneratorEffect[];
  /** Whether to skip further processing in the loop */
  skipContinue: boolean;
}

/**
 * Get bit width for a type, checking both C-Next and C types.
 */
function getTypeBitWidth(typeName: string): number {
  return TYPE_WIDTH[typeName] || C_TYPE_WIDTH[typeName] || 0;
}

/**
 * Create a PropertyResult with strlen effect.
 */
function makeStrlenResult(expr: string, skipContinue: boolean): PropertyResult {
  return {
    code: `strlen(${expr})`,
    effects: [{ type: "include", header: "string" }],
    skipContinue,
  };
}

/**
 * Create a PropertyResult for bit width (or unsupported type comment).
 * @param isElement - true for array element types (uses "element type" in error)
 */
function makeBitWidthResult(
  typeName: string,
  skipContinue: boolean,
  isElement: boolean = false,
): PropertyResult {
  const bitWidth = getTypeBitWidth(typeName);
  if (bitWidth > 0) {
    return { code: String(bitWidth), effects: [], skipContinue };
  }
  const typeLabel = isElement ? "element type" : "type";
  return {
    code: `/* .length: unsupported ${typeLabel} ${typeName} */0`,
    effects: [],
    skipContinue,
  };
}

/**
 * Handle .length for struct member access (cfg.field.length).
 */
function handleStructMemberLength(ctx: PropertyContext): PropertyResult | null {
  if (!ctx.previousStructType || !ctx.previousMemberName) {
    return null;
  }

  const fieldInfo = ctx.getStructFieldInfo(
    ctx.previousStructType,
    ctx.previousMemberName,
  );
  if (!fieldInfo) {
    return null;
  }

  const { type: memberType, dimensions } = fieldInfo;
  const isStringField = memberType.startsWith("string<");

  // String array field: string<64> arr[4]
  if (dimensions && dimensions.length > 1 && isStringField) {
    if (ctx.subscriptDepth === 0) {
      return { code: String(dimensions[0]), effects: [], skipContinue: true };
    }
    return makeStrlenResult(ctx.result, true);
  }

  // Single string field: string<64> str
  if (dimensions?.length === 1 && isStringField) {
    return makeStrlenResult(ctx.result, true);
  }

  // Multi-dim array member with partial subscript
  if (
    dimensions &&
    dimensions.length > 0 &&
    ctx.subscriptDepth < dimensions.length
  ) {
    return {
      code: String(dimensions[ctx.subscriptDepth]),
      effects: [],
      skipContinue: true,
    };
  }

  // Array member fully subscripted -> return element bit width
  if (
    dimensions &&
    dimensions.length > 0 &&
    ctx.subscriptDepth >= dimensions.length
  ) {
    return makeBitWidthResult(memberType, true, true); // isElement=true
  }

  // Non-array member -> return bit width
  return makeBitWidthResult(memberType, true, false); // isElement=false
}

/**
 * Handle .length for string types.
 */
function handleStringLength(
  ctx: PropertyContext,
  typeInfo: TTypeInfo,
): PropertyResult {
  // String array: arrayDimensions: [4, 65]
  if (typeInfo.arrayDimensions && typeInfo.arrayDimensions.length > 1) {
    if (ctx.subscriptDepth === 0) {
      return {
        code: String(typeInfo.arrayDimensions[0]),
        effects: [],
        skipContinue: false,
      };
    }
    return makeStrlenResult(ctx.result, false);
  }

  // Single string with cached length
  if (ctx.currentIdentifier && ctx.lengthCache?.has(ctx.currentIdentifier)) {
    return {
      code: ctx.lengthCache.get(ctx.currentIdentifier)!,
      effects: [],
      skipContinue: false,
    };
  }

  // Single string: strlen(str)
  const target = ctx.currentIdentifier ?? ctx.result;
  return makeStrlenResult(target, false);
}

/**
 * Handle .length for fully subscripted array (getting element bit width).
 */
function handleFullySubscriptedArrayLength(
  ctx: PropertyContext,
  typeInfo: TTypeInfo,
): PropertyResult {
  // ADR-017: Enum array element .length returns 32
  if (typeInfo.isEnum) {
    return { code: "32", effects: [], skipContinue: false };
  }

  // ADR-045/Issue #136: String array element .length -> strlen
  if (typeInfo.baseType.startsWith("string<") || typeInfo.isString) {
    return makeStrlenResult(ctx.result, false);
  }

  // Try primitive type first
  let elementBitWidth = getTypeBitWidth(typeInfo.baseType);

  // Issue #201: Also check bitmap types
  if (
    elementBitWidth === 0 &&
    typeInfo.isBitmap &&
    typeInfo.bitmapTypeName &&
    ctx.getBitmapBitWidth
  ) {
    elementBitWidth = ctx.getBitmapBitWidth(typeInfo.bitmapTypeName) || 0;
  }

  if (elementBitWidth > 0) {
    return { code: String(elementBitWidth), effects: [], skipContinue: false };
  }

  return {
    code: `/* .length: unsupported element type ${typeInfo.baseType} */0`,
    effects: [],
    skipContinue: false,
  };
}

/**
 * Generate code for .length property access.
 *
 * Handles:
 * - Arrays: returns dimension at current subscript depth
 * - Strings: returns strlen() call
 * - Integers: returns bit width
 * - Enums: returns 32 (default enum size)
 * - main args.length: returns argc
 */
const generateLengthProperty = (ctx: PropertyContext): PropertyResult => {
  // Special case: main function's args.length -> argc
  if (ctx.mainArgsName && ctx.primaryId === ctx.mainArgsName) {
    return { code: "argc", effects: [], skipContinue: false };
  }

  // Check if we're accessing a struct member (cfg.magic.length)
  const structResult = handleStructMemberLength(ctx);
  if (structResult) {
    return structResult;
  }

  // Fall back to checking the current resolved identifier's type
  const typeInfo = ctx.typeInfo;

  if (!typeInfo) {
    return {
      code: `/* .length: unknown type for ${ctx.result} */0`,
      effects: [],
      skipContinue: false,
    };
  }

  // ADR-045: String type handling
  if (typeInfo.isString) {
    return handleStringLength(ctx, typeInfo);
  }

  // Check for array with dimensions
  const hasDimensions =
    typeInfo.isArray &&
    typeInfo.arrayDimensions &&
    typeInfo.arrayDimensions.length > 0;

  if (hasDimensions && ctx.subscriptDepth < typeInfo.arrayDimensions!.length) {
    // ADR-036: Multi-dimensional array length (partial subscript)
    return {
      code: String(typeInfo.arrayDimensions![ctx.subscriptDepth]),
      effects: [],
      skipContinue: false,
    };
  }

  if (hasDimensions && ctx.subscriptDepth >= typeInfo.arrayDimensions!.length) {
    // Array fully subscripted -> return element bit width
    return handleFullySubscriptedArrayLength(ctx, typeInfo);
  }

  if (typeInfo.isArray) {
    // Unknown length for array type
    return {
      code: `/* .length unknown for ${ctx.currentIdentifier} */0`,
      effects: [],
      skipContinue: false,
    };
  }

  if (typeInfo.isEnum) {
    // ADR-017: Enum types default to 32-bit width
    return { code: "32", effects: [], skipContinue: false };
  }

  // Integer bit width - return the compile-time constant
  return { code: String(typeInfo.bitWidth), effects: [], skipContinue: false };
};

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
  generateLengthProperty,
  generateCapacityProperty,
  generateSizeProperty,
  generateBitmapFieldAccess,
};

export default accessGenerators;
