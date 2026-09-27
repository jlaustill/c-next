/**
 * Utility class for analyzing literal values in the parse tree.
 *
 * Extracted from DivisionByZeroAnalyzer and FloatModuloAnalyzer
 * to eliminate duplicate literal checking code.
 */

import * as Parser from "../PARSE/2-Parse/grammar/CNextParser";

/**
 * A float literal's shape as the grammar spells one: digits, an optional
 * fraction, an optional exponent and an optional width suffix, captured. The
 * grammar also requires a fraction or an exponent, which `[.eE]` asserts
 * beside it -- in the pattern, that requirement doubled every arm.
 */
const FLOAT_LITERAL = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?:[fF](32|64))?$/;

/**
 * Static utility methods for literal analysis
 */
class LiteralUtils {
  /**
   * Check if a literal represents zero, in any C-Next literal format
   * (decimal, hex, binary, float, each with or without a suffix).
   *
   * @param ctx - The literal context from the parse tree
   * @returns true if the literal is zero
   */
  static isZero(ctx: Parser.LiteralContext): boolean {
    return LiteralUtils.isZeroText(ctx.getText());
  }

  /**
   * Whether a numeric literal's text is zero, by its VALUE rather than its
   * spelling -- for a node's text, and for a const's initializer, which
   * arrives as text from a declaration that may be in another file (#1664
   * box 7). The spelling test this replaced missed `00`, `0x00`, `0x00u8`
   * and every suffixed float (`0.0f32`). Anything that is not a numeric
   * literal (a string, a char, `false`) is not zero.
   */
  static isZeroText(text: string): boolean {
    const trimmed = text.trim();
    const integer = LiteralUtils.parseIntegerLiteral(
      trimmed.replace(/[uUiI](?:8|16|32|64)$/, ""),
    );
    if (integer !== undefined) return integer === 0;
    return (
      LiteralUtils.floatLiteralWidth(trimmed) !== null &&
      LiteralUtils.isFloatZero(trimmed.replace(/[fF](?:32|64)$/, ""))
    );
  }

  /**
   * Check if a float literal string represents zero.
   * Issue #1010: Detect float zero for division-by-zero checking.
   *
   * Handles: 0.0, .0, 0., 0.0f, 0.0F, 0.0e0, 0.0E0, etc.
   *
   * @param text - The float literal text
   * @returns true if the float is zero
   */
  static isFloatZero(text: string): boolean {
    // Remove optional float suffix (f, F)
    const withoutSuffix = text.replace(/[fF]$/, "");

    // Parse to number and check if zero
    const value = Number.parseFloat(withoutSuffix);
    return value === 0;
  }

  /**
   * Check if a literal is a floating-point number.
   *
   * @param ctx - The literal context from the parse tree
   * @returns true if the literal is a float
   */
  static isFloat(ctx: Parser.LiteralContext): boolean {
    return LiteralUtils.floatLiteralWidth(ctx.getText()) !== null;
  }

  /**
   * The width of a floating literal's type, read from its text: 32 for
   * `2.5f32`, 64 for `2.5f64` and for an unsuffixed `2.5` (a C `double`).
   * Null when the text is not a floating literal.
   *
   * #1668: the one decision of whether a literal is floating. It used to be
   * made three ways, each by a partial test that some other literal also
   * passes. A trailing `f32` also ends the hex integer `0xFF32`, which the
   * render layer then emitted as `0xFf`. A `.` also occurs in the char literal
   * `'.'`, which E0804 then rejected as a floating modulo operand. So the text
   * must match the grammar's FLOAT_LITERAL / SUFFIXED_FLOAT shape as a whole.
   */
  static floatLiteralWidth(text: string): 32 | 64 | null {
    const match = FLOAT_LITERAL.exec(text);
    if (!match || !/[.eE]/.test(text)) return null;
    return match[1] === "32" ? 32 : 64;
  }

  /**
   * ADR-024: Get the type from a literal (suffixed or unsuffixed).
   *
   * #1668: moved here from 2.2's ExpressionTypeResolver so that 2.1 can type a
   * composite's literal operand with the same rule 2.2 uses. Composite typing is
   * one decision (`CompositeType`) that both layers read, and it treats a
   * floating operand as a veto, so both have to agree on which literal operands
   * are floating.
   */
  static typeOf(ctx: Parser.LiteralContext): string | null {
    const text = ctx.getText();

    if (text === "true" || text === "false") return "bool";

    const suffixMatch = /([uUiI])(8|16|32|64)$/.exec(text);
    if (suffixMatch) {
      const signChar = suffixMatch[1].toLowerCase();
      const width = suffixMatch[2];
      return (signChar === "u" ? "u" : "i") + width;
    }

    // A plain float literal (no suffix) has type double in C
    const floatWidth = LiteralUtils.floatLiteralWidth(text);
    if (floatWidth !== null) {
      return `f${floatWidth}`;
    }

    // Plain integer literals (no suffix) have type int in C
    // Check for integer: starts with digit, no decimal point
    if (/^\d+$/.test(text) || /^0[xXbBoO][\da-fA-F]+$/.test(text)) {
      return "int";
    }

    return null;
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

  /**
   * The value of an integer literal as written in C-Next source, with any
   * width suffix (`9u8`, `3i32`): decimal, hex or binary. Null for anything
   * else, and for a leading-zero literal (`010`), which the emitted C reads as
   * octal while `parseIntegerLiteral` reads decimal -- #1728 owns what it
   * means; until then no rule asserts a value C may disagree with (#1076).
   */
  static integerValue(text: string): number | null {
    if (/^0\d/.test(text)) return null;
    const match = /^(0[xX][\da-fA-F]+|0[bB][01]+|\d+)([uUiI]\d+)?$/.exec(text);
    if (match === null) return null;
    return LiteralUtils.parseIntegerLiteral(match[1]) ?? null;
  }
}

export default LiteralUtils;
