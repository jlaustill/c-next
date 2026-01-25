/**
 * Bit manipulation utilities for C code generation.
 * Pure functions that generate C code strings for bit operations.
 *
 * Extracted from CodeGenerator.ts as part of ADR-109 decomposition.
 */
class BitUtils {
  /**
   * Convert a boolean expression to an integer (0 or 1).
   * Handles literal "true"/"false" and generates ternary for expressions.
   *
   * @param expr - The expression to convert
   * @returns C code string representing the integer value
   */
  static boolToInt(expr: string): string {
    if (expr === "true") return "1";
    if (expr === "false") return "0";
    return `(${expr} ? 1 : 0)`;
  }

  /**
   * Generate a bit mask for the given width.
   * Uses pre-computed hex values for common widths to avoid undefined behavior.
   *
   * @param width - The bit width (number or string expression)
   * @returns C code string for the mask
   */
  static generateMask(width: string | number): string {
    const widthNum = typeof width === "number" ? width : parseInt(width, 10);
    if (!isNaN(widthNum)) {
      const hex = BitUtils.maskHex(widthNum);
      if (hex) return hex;
    }
    return `((1U << ${width}) - 1)`;
  }

  /**
   * Return pre-computed hex mask for common bit widths.
   * Returns null for uncommon widths.
   *
   * @param width - The bit width
   * @returns Hex mask string or null
   */
  static maskHex(width: number): string | null {
    switch (width) {
      case 8:
        return "0xFFU";
      case 16:
        return "0xFFFFU";
      case 32:
        return "0xFFFFFFFFU";
      case 64:
        return "0xFFFFFFFFFFFFFFFFULL";
      default:
        return null;
    }
  }

  /**
   * Return the appropriate "1" literal for a given type.
   * Uses "1ULL" for 64-bit types to avoid undefined behavior on large shifts.
   *
   * @param typeName - The C-Next type name (e.g., "u64", "i32")
   * @returns "1ULL" for 64-bit types, "1" otherwise
   */
  static oneForType(typeName: string): string {
    return typeName === "u64" || typeName === "i64" ? "1ULL" : "1";
  }

  /**
   * Generate code to read a single bit from a value.
   * Pattern: ((target >> offset) & 1)
   *
   * @param target - The value to read from
   * @param offset - Bit position (0-indexed)
   * @returns C code string for the bit read
   */
  static singleBitRead(target: string, offset: string | number): string {
    if (offset === 0 || offset === "0") {
      return `((${target}) & 1)`;
    }
    return `((${target} >> ${offset}) & 1)`;
  }

  /**
   * Generate code to read multiple bits from a value.
   * Pattern: ((target >> offset) & mask)
   *
   * @param target - The value to read from
   * @param offset - Starting bit position (0-indexed)
   * @param width - Number of bits to read
   * @returns C code string for the bit range read
   */
  static bitRangeRead(
    target: string,
    offset: string | number,
    width: string | number,
  ): string {
    const mask = BitUtils.generateMask(width);
    if (offset === 0 || offset === "0") {
      return `((${target}) & ${mask})`;
    }
    return `((${target} >> ${offset}) & ${mask})`;
  }

  /**
   * Generate read-modify-write code for single bit assignment.
   * Pattern: target = (target & ~(1 << offset)) | (value << offset)
   * Converts boolean values via boolToInt.
   *
   * @param target - The variable to modify
   * @param offset - Bit position (0-indexed)
   * @param value - Value to write (will be converted via boolToInt)
   * @returns C code string for the assignment
   */
  static singleBitWrite(
    target: string,
    offset: string | number,
    value: string,
  ): string {
    const intValue = BitUtils.boolToInt(value);
    return `${target} = (${target} & ~(1 << ${offset})) | (${intValue} << ${offset});`;
  }

  /**
   * Generate read-modify-write code for multi-bit assignment.
   * Pattern: target = (target & ~(mask << offset)) | ((value & mask) << offset)
   *
   * @param target - The variable to modify
   * @param offset - Starting bit position (0-indexed)
   * @param width - Number of bits to write
   * @param value - Value to write
   * @returns C code string for the assignment
   */
  static multiBitWrite(
    target: string,
    offset: string | number,
    width: string | number,
    value: string,
  ): string {
    const mask = BitUtils.generateMask(width);
    return `${target} = (${target} & ~(${mask} << ${offset})) | ((${value} & ${mask}) << ${offset});`;
  }

  /**
   * Generate write-only register code for single bit assignment.
   * No read-modify-write, just shifts the value into position.
   * Pattern: target = (value << offset)
   *
   * @param target - The register to write
   * @param offset - Bit position (0-indexed)
   * @param value - Value to write (will be converted via boolToInt)
   * @returns C code string for the assignment
   */
  static writeOnlySingleBit(
    target: string,
    offset: string | number,
    value: string,
  ): string {
    const intValue = BitUtils.boolToInt(value);
    return `${target} = (${intValue} << ${offset});`;
  }

  /**
   * Generate write-only register code for multi-bit assignment.
   * No read-modify-write, just shifts the masked value into position.
   * Pattern: target = ((value & mask) << offset)
   *
   * @param target - The register to write
   * @param offset - Starting bit position (0-indexed)
   * @param width - Number of bits to write
   * @param value - Value to write
   * @returns C code string for the assignment
   */
  static writeOnlyMultiBit(
    target: string,
    offset: string | number,
    width: string | number,
    value: string,
  ): string {
    const mask = BitUtils.generateMask(width);
    return `${target} = ((${value} & ${mask}) << ${offset});`;
  }
}

export default BitUtils;
