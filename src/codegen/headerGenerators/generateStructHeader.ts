/**
 * Struct Header Generator
 *
 * Generates C typedef struct declarations from symbol information.
 * Used by HeaderGenerator to emit full struct definitions in headers.
 */

import IHeaderTypeInput from "./IHeaderTypeInput";
import typeUtils from "./mapType";

const { mapType } = typeUtils;

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
    const cType = mapType(fieldType);
    const dims = dimensions?.get(fieldName);

    if (dims && dims.length > 0) {
      // Array field: generate dimensions suffix
      const dimSuffix = dims.map((d) => `[${d}]`).join("");
      lines.push(`    ${cType} ${fieldName}${dimSuffix};`);
    } else {
      // Regular field
      lines.push(`    ${cType} ${fieldName};`);
    }
  }

  lines.push(`} ${name};`);

  return lines.join("\n");
}

export default generateStructHeader;
