/**
 * BooleanHelper
 *
 * Helper class for boolean conversion logic in code generation.
 * Extracts testable pure functions from CodeGenerator.
 */

class BooleanHelper {
  /**
   * Convert boolean literal to integer literal for C code generation.
   * C89 doesn't have native bool type, so we convert to 0/1.
   *
   * @param expr - Expression string (may be "true", "false", or any expression)
   * @returns "1" for "true", "0" for "false", or wrapped ternary otherwise
   */
  static foldBooleanToInt(expr: string): string {
    if (expr === "true") return "1";
    if (expr === "false") return "0";
    return `(${expr} ? 1 : 0)`;
  }

  /**
   * Check if an expression is a boolean literal.
   */
  static isBooleanLiteral(expr: string): boolean {
    return expr === "true" || expr === "false";
  }

  /**
   * Convert a boolean literal to its integer equivalent.
   * Returns null if not a boolean literal.
   */
  static booleanLiteralToInt(expr: string): string | null {
    if (expr === "true") return "1";
    if (expr === "false") return "0";
    return null;
  }
}

export default BooleanHelper;
