/**
 * Shared utilities for C and C++ symbol collectors.
 * Used by the C collectors in logic/symbols/c/ and C++ collectors in logic/symbols/cpp/.
 */

/**
 * Reserved field names that conflict with C-Next built-in properties.
 * These should not be used as struct field names.
 *
 * Note: "length" was removed from this list (ADR-058) since .length is now deprecated.
 * Structs can have fields named "length" without conflict.
 */
const RESERVED_FIELD_NAMES = new Set<string>([]);

/**
 * Parse array dimensions from declarator text using regex.
 * Extracts both numeric values and macro names from square bracket notation.
 *
 * Issue #981: Support macro-sized array dimensions like [BUF_SIZE].
 * Without this, struct fields with macro-sized arrays are incorrectly treated
 * as non-arrays, causing bit extraction instead of array access.
 *
 * @param text - The declarator text containing array notation
 * @returns Array of dimension sizes (numbers) or macro names (strings),
 *          e.g., [8] returns [8], [BUF_SIZE] returns ["BUF_SIZE"], [2][N] returns [2, "N"]
 */
function parseArrayDimensions(text: string): (number | string)[] {
  const dimensions: (number | string)[] = [];
  // Match any bracket content: digits, identifiers, or expressions
  // Captures: [8], [BUF_SIZE], [N], [SIZE + 1], etc.
  const arrayMatches = text.match(/\[([^\]]+)\]/g);

  if (arrayMatches) {
    for (const match of arrayMatches) {
      const content = match.slice(1, -1).trim();
      // Try to parse as numeric first
      const numericValue = Number.parseInt(content, 10);
      if (!Number.isNaN(numericValue) && String(numericValue) === content) {
        // Pure numeric dimension
        dimensions.push(numericValue);
      } else {
        // Macro name or expression - store as string
        dimensions.push(content);
      }
    }
  }

  return dimensions;
}

/**
 * Map C/C++ type names to their bit widths.
 * Supports stdint.h types and standard C types commonly used as enum backing types.
 *
 * @param typeName - The C/C++ type name (e.g., "uint8_t", "int", "unsigned long")
 * @returns Bit width (8, 16, 32, 64) or 0 if unknown
 */
function getTypeWidth(typeName: string): number {
  const typeWidths: Record<string, number> = {
    // stdint.h types
    uint8_t: 8,
    int8_t: 8,
    uint16_t: 16,
    int16_t: 16,
    uint32_t: 32,
    int32_t: 32,
    uint64_t: 64,
    int64_t: 64,
    // Standard C types (common sizes)
    char: 8,
    "signed char": 8,
    "unsigned char": 8,
    short: 16,
    "short int": 16,
    "signed short": 16,
    "signed short int": 16,
    "unsigned short": 16,
    "unsigned short int": 16,
    int: 32,
    "signed int": 32,
    unsigned: 32,
    "unsigned int": 32,
    long: 32,
    "long int": 32,
    "signed long": 32,
    "signed long int": 32,
    "unsigned long": 32,
    "unsigned long int": 32,
    "long long": 64,
    "long long int": 64,
    "signed long long": 64,
    "signed long long int": 64,
    "unsigned long long": 64,
    "unsigned long long int": 64,
  };
  return typeWidths[typeName] ?? 0;
}

/**
 * Check if a field name is reserved in C-Next.
 *
 * @param fieldName - The field name to check
 * @returns true if the field name conflicts with C-Next built-in properties
 */
function isReservedFieldName(fieldName: string): boolean {
  return RESERVED_FIELD_NAMES.has(fieldName);
}

/**
 * Get the list of reserved field names for error messages.
 */
function getReservedFieldNames(): string[] {
  return Array.from(RESERVED_FIELD_NAMES);
}

/**
 * Generate a warning message for a reserved field name.
 *
 * @param language - "C" or "C++"
 * @param structName - Name of the struct containing the field
 * @param fieldName - The reserved field name
 * @returns Warning message string
 */
function getReservedFieldWarning(
  language: "C" | "C++",
  structName: string,
  fieldName: string,
): string {
  return (
    `Warning: ${language} header struct '${structName}' has field '${fieldName}' ` +
    `which conflicts with C-Next's .${fieldName} property. ` +
    `Consider renaming the field or be aware that '${structName}.${fieldName}' ` +
    `may not work as expected in C-Next code.`
  );
}

class SymbolUtils {
  static readonly parseArrayDimensions = parseArrayDimensions;
  static readonly getTypeWidth = getTypeWidth;
  static readonly isReservedFieldName = isReservedFieldName;
  static readonly getReservedFieldNames = getReservedFieldNames;
  static readonly getReservedFieldWarning = getReservedFieldWarning;
}

export default SymbolUtils;
