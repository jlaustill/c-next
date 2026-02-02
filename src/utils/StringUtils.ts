/**
 * String utilities for C code generation.
 * Pure functions that generate C code strings for string operations.
 *
 * Extracted from CodeGenerator.ts as part of ADR-109 decomposition.
 */
/** C null terminator character literal for generated code */
const C_NULL_CHAR = String.raw`'\0'`;

class StringUtils {
  /**
   * Generate strncpy with explicit null termination.
   * Used for simple string assignments: str <- "hello"
   *
   * Pattern: strncpy(target, value, capacity); target[capacity] = '\0';
   *
   * @param target - The destination variable/expression
   * @param value - The source string expression
   * @param capacity - Maximum string length (excluding null)
   * @returns C code string for the copy operation
   */
  static copyWithNull(target: string, value: string, capacity: number): string {
    return `strncpy(${target}, ${value}, ${capacity}); ${target}[${capacity}] = ${C_NULL_CHAR};`;
  }

  /**
   * Generate strncpy without explicit null termination.
   * Used for string array elements where the buffer is pre-zeroed.
   *
   * Pattern: strncpy(target, value, capacity);
   *
   * @param target - The destination expression (may include subscripts)
   * @param value - The source string expression
   * @param capacity - Maximum string length (excluding null)
   * @returns C code string for the copy operation
   */
  static copy(target: string, value: string, capacity: number): string {
    return `strncpy(${target}, ${value}, ${capacity});`;
  }

  /**
   * Generate string concatenation sequence.
   * Used for: result <- left + right
   *
   * Pattern:
   *   strncpy(target, left, capacity);
   *   strncat(target, right, capacity - strlen(target));
   *   target[capacity] = '\0';
   *
   * @param target - The destination variable
   * @param left - Left operand string expression
   * @param right - Right operand string expression
   * @param capacity - Maximum string length (excluding null)
   * @param indent - Indentation for multi-line output
   * @returns Array of C code lines for the concatenation
   */
  static concat(
    target: string,
    left: string,
    right: string,
    capacity: number,
    indent: string = "",
  ): string[] {
    return [
      `${indent}strncpy(${target}, ${left}, ${capacity});`,
      `${indent}strncat(${target}, ${right}, ${capacity} - strlen(${target}));`,
      `${indent}${target}[${capacity}] = ${C_NULL_CHAR};`,
    ];
  }

  /**
   * Generate substring extraction.
   * Used for: result <- source[start, length]
   *
   * Pattern:
   *   strncpy(target, source + start, length);
   *   target[length] = '\0';
   *
   * @param target - The destination variable
   * @param source - Source string expression
   * @param start - Starting position expression
   * @param length - Length to extract
   * @param indent - Indentation for multi-line output
   * @returns Array of C code lines for the substring
   */
  static substring(
    target: string,
    source: string,
    start: string,
    length: number,
    indent: string = "",
  ): string[] {
    return [
      `${indent}strncpy(${target}, ${source} + ${start}, ${length});`,
      `${indent}${target}[${length}] = ${C_NULL_CHAR};`,
    ];
  }

  /**
   * Generate struct field string copy.
   * Used for: config.name <- "value"
   *
   * @param structName - The struct variable name
   * @param fieldName - The field name
   * @param value - The source string expression
   * @param capacity - Maximum string length (excluding null)
   * @returns C code string for the copy operation
   */
  static copyToStructField(
    structName: string,
    fieldName: string,
    value: string,
    capacity: number,
  ): string {
    return StringUtils.copyWithNull(
      `${structName}.${fieldName}`,
      value,
      capacity,
    );
  }

  /**
   * Generate string array element copy.
   * Used for: names[i] <- "value"
   *
   * @param arrayName - The array variable name
   * @param index - The array index expression
   * @param value - The source string expression
   * @param capacity - Maximum string length (excluding null)
   * @returns C code string for the copy operation
   */
  static copyToArrayElement(
    arrayName: string,
    index: string,
    value: string,
    capacity: number,
  ): string {
    return StringUtils.copy(`${arrayName}[${index}]`, value, capacity);
  }

  /**
   * Generate struct field array element string copy.
   * Used for: config.names[i] <- "value"
   *
   * @param structName - The struct variable name
   * @param fieldName - The field name
   * @param index - The array index expression
   * @param value - The source string expression
   * @param capacity - Maximum string length (excluding null)
   * @returns C code string for the copy operation
   */
  static copyToStructFieldArrayElement(
    structName: string,
    fieldName: string,
    index: string,
    value: string,
    capacity: number,
  ): string {
    return StringUtils.copy(
      `${structName}.${fieldName}[${index}]`,
      value,
      capacity,
    );
  }
  /**
   * Get the actual character length of a string literal,
   * accounting for escape sequences like \n, \t, \\, etc.
   *
   * @param literal - The string literal including quotes (e.g., "hello\n")
   * @returns The character count (escape sequences count as 1)
   */
  static literalLength(literal: string): number {
    // Remove surrounding quotes
    const content = literal.slice(1, -1);

    let length = 0;
    let i = 0;
    while (i < content.length) {
      if (content[i] === "\\" && i + 1 < content.length) {
        // Escape sequence counts as 1 character
        i += 2;
      } else {
        i += 1;
      }
      length += 1;
    }
    return length;
  }
}

export default StringUtils;
