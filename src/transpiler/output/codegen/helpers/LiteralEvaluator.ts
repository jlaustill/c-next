/**
 * Literal Evaluator
 *
 * Evaluates numeric literals from C-Next source code, handling
 * hex (0x), binary (0b), and decimal formats.
 *
 * Extracted from TypeValidator to reduce cognitive complexity
 * and eliminate code duplication.
 */

/**
 * Static utility for evaluating numeric literals
 */
class LiteralEvaluator {
  /**
   * Parse a literal text into a numeric value
   *
   * Handles:
   * - Hex literals: 0xFF, 0XFF
   * - Binary literals: 0b1010, 0B1010
   * - Decimal literals: 123, 123u8, 123i32
   *
   * @param text The literal text to parse
   * @returns The numeric value, or null if not a valid literal
   */
  static parseLiteral(text: string): number | null {
    if (text.startsWith("0x") || text.startsWith("0X")) {
      // Hex literal
      return Number.parseInt(text.slice(2), 16);
    }

    if (text.startsWith("0b") || text.startsWith("0B")) {
      // Binary literal
      return Number.parseInt(text.slice(2), 2);
    }

    // Decimal literal (strip any type suffix like u8, i32)
    const numMatch = /^\d+/.exec(text);
    if (numMatch) {
      return Number.parseInt(numMatch[0], 10);
    }

    return null;
  }

  /**
   * Apply sign to a value based on whether negative prefix was detected
   *
   * @param value The parsed numeric value (or null)
   * @param isNegative Whether the expression had a negative prefix
   * @returns The signed value, or null if value was null
   */
  static applySign(value: number | null, isNegative: boolean): number | null {
    if (value === null) {
      return null;
    }
    return isNegative ? -value : value;
  }
}

export default LiteralEvaluator;
