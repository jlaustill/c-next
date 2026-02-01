/**
 * Utility class for analyzing literal values in the parse tree.
 *
 * Extracted from DivisionByZeroAnalyzer and FloatModuloAnalyzer
 * to eliminate duplicate literal checking code.
 */

import * as Parser from "../logic/parser/grammar/CNextParser";

/**
 * Static utility methods for literal analysis
 */
class LiteralUtils {
  /**
   * Check if a literal represents zero.
   *
   * Handles all C-Next literal formats:
   * - Integer: 0
   * - Hex: 0x0, 0X0
   * - Binary: 0b0, 0B0
   * - Suffixed decimal: 0u8, 0i32, etc.
   * - Suffixed hex: 0x0u8, 0x0i32, etc.
   * - Suffixed binary: 0b0u8, 0b0i32, etc.
   *
   * @param ctx - The literal context from the parse tree
   * @returns true if the literal is zero
   */
  static isZero(ctx: Parser.LiteralContext): boolean {
    const text = ctx.getText();

    // Integer literal: exactly "0"
    if (ctx.INTEGER_LITERAL()) {
      return text === "0";
    }

    // Hex literal: 0x0 or 0X0
    if (ctx.HEX_LITERAL()) {
      return text === "0x0" || text === "0X0";
    }

    // Binary literal: 0b0 or 0B0
    if (ctx.BINARY_LITERAL()) {
      return text === "0b0" || text === "0B0";
    }

    // Suffixed decimal: 0u8, 0i32, etc.
    if (ctx.SUFFIXED_DECIMAL()) {
      return text.startsWith("0u") || text.startsWith("0i");
    }

    // Suffixed hex: 0x0u8, 0x0i32, etc.
    if (ctx.SUFFIXED_HEX()) {
      return (
        text.startsWith("0x0u") ||
        text.startsWith("0x0i") ||
        text.startsWith("0X0u") ||
        text.startsWith("0X0i")
      );
    }

    // Suffixed binary: 0b0u8, 0b0i32, etc.
    if (ctx.SUFFIXED_BINARY()) {
      return (
        text.startsWith("0b0u") ||
        text.startsWith("0b0i") ||
        text.startsWith("0B0u") ||
        text.startsWith("0B0i")
      );
    }

    return false;
  }

  /**
   * Check if a literal is a floating-point number.
   *
   * @param ctx - The literal context from the parse tree
   * @returns true if the literal is a float
   */
  static isFloat(ctx: Parser.LiteralContext): boolean {
    // Check for FLOAT_LITERAL token
    if (ctx.FLOAT_LITERAL()) {
      return true;
    }

    // Fallback: check text for decimal point (not in strings)
    const text = ctx.getText();
    return text.includes(".") && !text.startsWith('"');
  }

  /**
   * Parse an integer literal string to a numeric value.
   *
   * Handles all C-Next integer formats:
   * - Decimal: 42, -17
   * - Hex: 0x2A, 0X2a
   * - Binary: 0b101010, 0B101010
   *
   * Issue #455: Used for resolving const values in array dimensions.
   *
   * @param text - The literal text to parse
   * @returns The numeric value, or undefined if not a valid integer literal
   */
  static parseIntegerLiteral(text: string): number | undefined {
    const trimmed = text.trim();

    // Decimal integer (including negative)
    if (/^-?\d+$/.test(trimmed)) {
      return Number.parseInt(trimmed, 10);
    }

    // Hex literal (0x or 0X prefix)
    if (/^0[xX][0-9a-fA-F]+$/.test(trimmed)) {
      return Number.parseInt(trimmed, 16);
    }

    // Binary literal (0b or 0B prefix)
    if (/^0[bB][01]+$/.test(trimmed)) {
      return Number.parseInt(trimmed.substring(2), 2);
    }

    return undefined;
  }
}

export default LiteralUtils;
