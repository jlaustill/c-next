/**
 * TypeResolver - Converts string type representations to TType.
 *
 * This utility handles the conversion from the old string-based type system
 * (e.g., "u32", "string<32>", "u8[10]") to the new TType discriminated union.
 */
import type TType from "../transpiler/types/TType";
import TTypeUtils from "./TTypeUtils";
import PrimitiveKindUtils from "./PrimitiveKindUtils";

// Regex patterns for type parsing
const STRING_TYPE_PATTERN = /^string\s*<\s*(\d+)\s*>$/;
const ARRAY_TYPE_PATTERN = /^(.+?)(\[\s*[^\]]+\s*\])+$/;
const ARRAY_DIMENSION_PATTERN = /\[\s*([^\]]+)\s*\]/g;
const EXTERNAL_TYPE_PATTERN = /[:<>]/;
const ENUM_PREFIX_PATTERN = /^E[A-Z]/;

class TypeResolver {
  /**
   * Parse a string type representation and return the corresponding TType.
   *
   * @param typeString - String representation of a type (e.g., "u32", "string<32>", "u8[10]")
   * @returns The corresponding TType object
   * @throws Error if the type string is empty or invalid
   */
  static resolve(typeString: string): TType {
    const trimmed = typeString.trim();

    if (trimmed === "") {
      throw new Error("Cannot resolve empty type string");
    }

    // Check for string type: string<N>
    const stringMatch = STRING_TYPE_PATTERN.exec(trimmed);
    if (stringMatch) {
      const capacity = Number.parseInt(stringMatch[1], 10);
      return TTypeUtils.createString(capacity);
    }

    // Check for array type: baseType[dim1][dim2]...
    const arrayMatch = ARRAY_TYPE_PATTERN.exec(trimmed);
    if (arrayMatch) {
      return TypeResolver.parseArrayType(trimmed, arrayMatch[1]);
    }

    // Check for external type (contains :: or < > for templates)
    if (EXTERNAL_TYPE_PATTERN.test(trimmed)) {
      return TTypeUtils.createExternal(trimmed);
    }

    // Check for primitive type
    if (PrimitiveKindUtils.isPrimitive(trimmed)) {
      return TTypeUtils.createPrimitive(trimmed);
    }

    // Check for enum (E prefix convention)
    // LIMITATION: This heuristic assumes enums start with 'E' followed by uppercase.
    // It may misclassify: enums without 'E' prefix, or structs named like 'EFoo'.
    // For accurate resolution, use SymbolRegistry to check against known types.
    if (ENUM_PREFIX_PATTERN.test(trimmed)) {
      return TTypeUtils.createEnum(trimmed);
    }

    // Default to struct type
    return TTypeUtils.createStruct(trimmed);
  }

  /**
   * Parse an array type and return the TType.
   */
  private static parseArrayType(fullType: string, baseTypeStr: string): TType {
    // Extract all dimensions from the full type string
    const dimensions: (number | string)[] = [];
    let match: RegExpExecArray | null = null;

    // Reset lastIndex for global regex
    ARRAY_DIMENSION_PATTERN.lastIndex = 0;

    while ((match = ARRAY_DIMENSION_PATTERN.exec(fullType)) !== null) {
      const dimStr = match[1].trim();
      const dimNum = Number.parseInt(dimStr, 10);

      if (Number.isNaN(dimNum)) {
        // String dimension (C macro)
        dimensions.push(dimStr);
      } else {
        dimensions.push(dimNum);
      }
    }

    // Resolve the base type (recursively handles string<N> as base type)
    const elementType = TypeResolver.resolve(baseTypeStr.trim());

    return TTypeUtils.createArray(elementType, dimensions);
  }

  /**
   * Convert a TType back to its string representation.
   *
   * This is useful for round-trip compatibility and debugging.
   *
   * @param type - The TType object to convert
   * @returns String representation of the type
   */
  static getTypeName(type: TType): string {
    switch (type.kind) {
      case "primitive":
        return type.primitive;
      case "string":
        return `string<${type.capacity}>`;
      case "struct":
        return type.name;
      case "enum":
        return type.name;
      case "bitmap":
        return type.name;
      case "callback":
        return type.name;
      case "register":
        return type.name;
      case "external":
        return type.name;
      case "array": {
        const elementName = TypeResolver.getTypeName(type.elementType);
        const dims = type.dimensions.map((d) => `[${d}]`).join("");
        return `${elementName}${dims}`;
      }
    }
  }
}

export default TypeResolver;
