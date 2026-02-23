/**
 * Bit manipulation utilities for C code generation.
 * Pure functions that generate C code strings for bit operations.
 *
 * Extracted from CodeGenerator.ts as part of ADR-109 decomposition.
 */
class BitUtils {
  /**
   * Convert a boolean expression to an unsigned integer (0U or 1U).
   * Handles literal "true"/"false" and generates ternary for expressions.
   * Uses unsigned literals for MISRA C:2012 Rule 10.1 compliance.
   *
   * @param expr - The expression to convert
   * @returns C code string representing the unsigned integer value
   */
  static boolToInt(expr: string): string {
    if (expr === "true") return "1U";
    if (expr === "false") return "0U";
    return `(${expr} ? 1U : 0U)`;
  }

  /**
   * Generate a bit mask for the given width.
   * Uses pre-computed hex values for common widths to avoid undefined behavior.
   *
   * @param width - The bit width (number or string expression)
   * @param targetType - Optional target type for 64-bit aware mask generation
   * @returns C code string for the mask
   */
  static generateMask(width: string | number, targetType?: string): string {
    const widthNum =
      typeof width === "number" ? width : Number.parseInt(width, 10);
    const is64Bit = targetType === "u64" || targetType === "i64";
    if (!Number.isNaN(widthNum)) {
      const hex = BitUtils.maskHex(widthNum, is64Bit);
      if (hex) return hex;
    }
    // Use ULL for 64-bit types to avoid overflow on large shifts
    const one = is64Bit ? "1ULL" : "1U";
    return `((${one} << ${width}) - 1)`;
  }

  /**
   * Return pre-computed hex mask for common bit widths.
   * Returns null for uncommon widths.
   *
   * @param width - The bit width
   * @param is64Bit - Whether the target is a 64-bit type (use ULL suffix)
   * @returns Hex mask string or null
   */
  static maskHex(width: number, is64Bit = false): string | null {
    // For 64-bit targets, use ULL suffix to prevent overflow on shifts >= 32
    if (is64Bit) {
      switch (width) {
        case 8:
          return "0xFFULL";
        case 16:
          return "0xFFFFULL";
        case 32:
          return "0xFFFFFFFFULL";
        case 64:
          return "0xFFFFFFFFFFFFFFFFULL";
        default:
          return null;
      }
    }
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
   * Return the appropriate unsigned "1" literal for a given type.
   * Uses "1ULL" for 64-bit types, "1U" for others.
   * MISRA C:2012 Rule 10.1 requires unsigned operands for bitwise operations.
   *
   * @param typeName - The C-Next type name (e.g., "u64", "i32")
   * @returns "1ULL" for 64-bit types, "1U" otherwise
   */
  static oneForType(typeName: string): string {
    return typeName === "u64" || typeName === "i64" ? "1ULL" : "1U";
  }

  /**
   * Format a number as an uppercase hex string (e.g., 255 -> "0xFF").
   * Used for generating hex mask literals in generated C code.
   *
   * @param value - The numeric value to format
   * @returns Hex string like "0xFF" or "0x1F"
   */
  static formatHex(value: number): string {
    return `0x${value.toString(16).toUpperCase()}`;
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
   * @param targetType - Optional target type for 64-bit aware code generation
   * @returns C code string for the assignment
   */
  static singleBitWrite(
    target: string,
    offset: string | number,
    value: string,
    targetType?: string,
  ): string {
    const intValue = BitUtils.boolToInt(value);
    const is64Bit = targetType === "u64" || targetType === "i64";
    const one = is64Bit ? "1ULL" : "1U";
    // For 64-bit types, cast the value to ensure shift doesn't overflow
    const valueShift = is64Bit
      ? `((uint64_t)${intValue} << ${offset})`
      : `(${intValue} << ${offset})`;
    return `${target} = (${target} & ~(${one} << ${offset})) | ${valueShift};`;
  }

  /**
   * Generate read-modify-write code for multi-bit assignment.
   * Pattern: target = (target & ~(mask << offset)) | ((value & mask) << offset)
   *
   * @param target - The variable to modify
   * @param offset - Starting bit position (0-indexed)
   * @param width - Number of bits to write
   * @param value - Value to write
   * @param targetType - Optional target type for 64-bit aware code generation
   * @returns C code string for the assignment
   */
  static multiBitWrite(
    target: string,
    offset: string | number,
    width: string | number,
    value: string,
    targetType?: string,
  ): string {
    const mask = BitUtils.generateMask(width, targetType);
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
   * @param targetType - Optional target type for 64-bit aware code generation
   * @returns C code string for the assignment
   */
  static writeOnlySingleBit(
    target: string,
    offset: string | number,
    value: string,
    targetType?: string,
  ): string {
    const intValue = BitUtils.boolToInt(value);
    // For 64-bit types, cast to ensure correct shift width
    // boolToInt already returns unsigned values (1U/0U) for MISRA 10.1 compliance
    const castPrefix =
      targetType === "u64" || targetType === "i64" ? "(uint64_t)" : "";
    return `${target} = (${castPrefix}${intValue} << ${offset});`;
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
   * @param targetType - Optional target type for 64-bit aware code generation
   * @returns C code string for the assignment
   */
  static writeOnlyMultiBit(
    target: string,
    offset: string | number,
    width: string | number,
    value: string,
    targetType?: string,
  ): string {
    const mask = BitUtils.generateMask(width, targetType);
    return `${target} = ((${value} & ${mask}) << ${offset});`;
  }
}

export default BitUtils;
