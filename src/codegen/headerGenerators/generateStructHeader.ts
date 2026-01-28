/**
 * Struct Header Generator
 *
 * Generates C typedef struct declarations from symbol information.
 * Used by HeaderGenerator to emit full struct definitions in headers.
 */

import IHeaderTypeInput from "./IHeaderTypeInput";
import typeUtils from "./mapType";
import ESourceLanguage from "../../types/ESourceLanguage";
import ESymbolKind from "../../types/ESymbolKind";

const { mapType } = typeUtils;

/**
 * Issue #502: Check if a symbol name refers to a C++ namespace
 * Uses the SymbolTable to detect C++ namespaces, classes, and enums
 */
function isCppNamespace(name: string, input: IHeaderTypeInput): boolean {
  const symbolTable = input.symbolTable;
  if (!symbolTable) {
    return false;
  }

  const symbols = symbolTable.getOverloads(name);
  for (const sym of symbols) {
    if (sym.sourceLanguage !== ESourceLanguage.Cpp) {
      continue;
    }
    if (
      sym.kind === ESymbolKind.Namespace ||
      sym.kind === ESymbolKind.Class ||
      sym.kind === ESymbolKind.Enum
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Issue #502: Convert underscore-separated type names to C++ namespace syntax
 * if the first part is a known C++ namespace
 */
function convertToCppNamespaceIfNeeded(
  fieldType: string,
  input: IHeaderTypeInput,
): string {
  // Only process types that contain underscores
  if (!fieldType.includes("_")) {
    return fieldType;
  }

  // Check if this looks like a qualified type
  const parts = fieldType.split("_");
  if (parts.length > 1 && isCppNamespace(parts[0], input)) {
    // It's a C++ namespaced type - convert _ to ::
    return parts.join("::");
  }

  return fieldType;
}

/**
 * Generate a C typedef struct declaration for the given struct name.
 *
 * Output format (Issue #296: uses named struct for forward declaration compatibility):
 * ```c
 * typedef struct StructName {
 *     uint32_t field1;
 *     uint8_t buffer[256];
 * } StructName;
 * ```
 *
 * @param name - The struct type name
 * @param input - Symbol information containing struct fields
 * @returns C typedef struct declaration, or forward declaration if data unavailable
 */
function generateStructHeader(name: string, input: IHeaderTypeInput): string {
  const fields = input.structFields.get(name);

  // Graceful fallback if struct data not available
  if (!fields || fields.size === 0) {
    return `typedef struct ${name} ${name};`;
  }

  const dimensions = input.structFieldDimensions.get(name);
  const lines: string[] = [];
  // Issue #296: Use named struct for forward declaration compatibility
  lines.push(`typedef struct ${name} {`);

  // Iterate fields in insertion order (Map preserves order)
  for (const [fieldName, fieldType] of fields) {
    // Issue #502: Convert C++ namespace types from _ to :: format
    const convertedType = convertToCppNamespaceIfNeeded(fieldType, input);
    const cType = mapType(convertedType);
    const dims = dimensions?.get(fieldName);
    const dimSuffix =
      dims && dims.length > 0 ? dims.map((d) => `[${d}]`).join("") : "";

    // Issue #461: Handle string<N> types which map to char[N+1]
    // The embedded dimension must come after array dimensions in C syntax
    // Example: string<64> arr[4] -> char arr[4][65], not char[65] arr[4]
    const embeddedMatch = /^(\w+)\[(\d+)\]$/.exec(cType);
    if (embeddedMatch) {
      const baseType = embeddedMatch[1];
      const embeddedDim = embeddedMatch[2];
      lines.push(`    ${baseType} ${fieldName}${dimSuffix}[${embeddedDim}];`);
    } else {
      lines.push(`    ${cType} ${fieldName}${dimSuffix};`);
    }
  }

  lines.push(`} ${name};`);

  return lines.join("\n");
}

export default generateStructHeader;
