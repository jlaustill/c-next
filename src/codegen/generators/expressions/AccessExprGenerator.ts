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
  const effects: TGeneratorEffect[] = [];

  // Special case: main function's args.length -> argc
  if (ctx.mainArgsName && ctx.primaryId === ctx.mainArgsName) {
    return { code: "argc", effects, skipContinue: false };
  }

  // Check if we're accessing a struct member (cfg.magic.length)
  if (ctx.previousStructType && ctx.previousMemberName) {
    const fieldInfo = ctx.getStructFieldInfo(
      ctx.previousStructType,
      ctx.previousMemberName,
    );
    if (fieldInfo) {
      const memberType = fieldInfo.type;
      const dimensions = fieldInfo.dimensions;
      const isStringField = memberType.startsWith("string<");

      if (dimensions && dimensions.length > 1 && isStringField) {
        // String array field: string<64> arr[4]
        if (ctx.subscriptDepth === 0) {
          // ts.arr.length -> return element count (first dimension)
          return { code: String(dimensions[0]), effects, skipContinue: true };
        } else {
          // ts.arr[0].length -> strlen(ts.arr[0])
          effects.push({ type: "include", header: "string" });
          return {
            code: `strlen(${ctx.result})`,
            effects,
            skipContinue: true,
          };
        }
      } else if (dimensions && dimensions.length === 1 && isStringField) {
        // Single string field: string<64> str
        // ts.str.length -> strlen(ts.str)
        effects.push({ type: "include", header: "string" });
        return { code: `strlen(${ctx.result})`, effects, skipContinue: true };
      } else if (
        dimensions &&
        dimensions.length > 0 &&
        ctx.subscriptDepth < dimensions.length
      ) {
        // Multi-dim array member with partial subscript
        return {
          code: String(dimensions[ctx.subscriptDepth]),
          effects,
          skipContinue: true,
        };
      } else if (
        dimensions &&
        dimensions.length > 0 &&
        ctx.subscriptDepth >= dimensions.length
      ) {
        // Array member fully subscripted -> return element bit width
        const bitWidth =
          TYPE_WIDTH[memberType] || C_TYPE_WIDTH[memberType] || 0;
        if (bitWidth > 0) {
          return { code: String(bitWidth), effects, skipContinue: true };
        } else {
          return {
            code: `/* .length: unsupported element type ${memberType} */0`,
            effects,
            skipContinue: true,
          };
        }
      } else {
        // Non-array member -> return bit width
        const bitWidth =
          TYPE_WIDTH[memberType] || C_TYPE_WIDTH[memberType] || 0;
        if (bitWidth > 0) {
          return { code: String(bitWidth), effects, skipContinue: true };
        } else {
          return {
            code: `/* .length: unsupported type ${memberType} */0`,
            effects,
            skipContinue: true,
          };
        }
      }
    }
  }

  // Fall back to checking the current resolved identifier's type
  const typeInfo = ctx.typeInfo;

  if (!typeInfo) {
    return {
      code: `/* .length: unknown type for ${ctx.result} */0`,
      effects,
      skipContinue: false,
    };
  }

  // ADR-045: String type handling
  if (typeInfo.isString) {
    if (typeInfo.arrayDimensions && typeInfo.arrayDimensions.length > 1) {
      // String array: arrayDimensions: [4, 65]
      if (ctx.subscriptDepth === 0) {
        // arr.length -> return element count (first dimension)
        return {
          code: String(typeInfo.arrayDimensions[0]),
          effects,
          skipContinue: false,
        };
      } else {
        // arr[0].length -> strlen(arr[0])
        effects.push({ type: "include", header: "string" });
        return { code: `strlen(${ctx.result})`, effects, skipContinue: false };
      }
    } else {
      // Single string: arrayDimensions: [65]
      // str.length -> strlen(str)
      if (
        ctx.currentIdentifier &&
        ctx.lengthCache?.has(ctx.currentIdentifier)
      ) {
        return {
          code: ctx.lengthCache.get(ctx.currentIdentifier)!,
          effects,
          skipContinue: false,
        };
      } else {
        effects.push({ type: "include", header: "string" });
        const target = ctx.currentIdentifier ?? ctx.result;
        return { code: `strlen(${target})`, effects, skipContinue: false };
      }
    }
  } else if (
    typeInfo.isArray &&
    typeInfo.arrayDimensions &&
    typeInfo.arrayDimensions.length > 0 &&
    ctx.subscriptDepth < typeInfo.arrayDimensions.length
  ) {
    // ADR-036: Multi-dimensional array length
    return {
      code: String(typeInfo.arrayDimensions[ctx.subscriptDepth]),
      effects,
      skipContinue: false,
    };
  } else if (
    typeInfo.isArray &&
    typeInfo.arrayDimensions &&
    typeInfo.arrayDimensions.length > 0 &&
    ctx.subscriptDepth >= typeInfo.arrayDimensions.length
  ) {
    // Array fully subscripted -> return element bit width
    if (typeInfo.isEnum) {
      // ADR-017: Enum array element .length returns 32
      return { code: "32", effects, skipContinue: false };
    } else if (typeInfo.baseType.startsWith("string<") || typeInfo.isString) {
      // ADR-045/Issue #136: String array element .length -> strlen
      effects.push({ type: "include", header: "string" });
      return { code: `strlen(${ctx.result})`, effects, skipContinue: false };
    } else {
      const elementBitWidth = TYPE_WIDTH[typeInfo.baseType] || 0;
      if (elementBitWidth > 0) {
        return { code: String(elementBitWidth), effects, skipContinue: false };
      } else {
        return {
          code: `/* .length: unsupported element type ${typeInfo.baseType} */0`,
          effects,
          skipContinue: false,
        };
      }
    }
  } else if (typeInfo.isEnum && !typeInfo.isArray) {
    // ADR-017: Enum types default to 32-bit width
    return { code: "32", effects, skipContinue: false };
  } else if (!typeInfo.isArray) {
    // Integer bit width - return the compile-time constant
    return { code: String(typeInfo.bitWidth), effects, skipContinue: false };
  } else {
    // Unknown length
    return {
      code: `/* .length unknown for ${ctx.currentIdentifier} */0`,
      effects,
      skipContinue: false,
    };
  }
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
