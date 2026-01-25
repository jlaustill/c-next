/**
 * Utility class for analyzing literal values in the parse tree.
 *
 * Extracted from DivisionByZeroAnalyzer and FloatModuloAnalyzer
 * to eliminate duplicate literal checking code.
 */

import * as Parser from "../parser/grammar/CNextParser";

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
}

export default LiteralUtils;
