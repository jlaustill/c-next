/**
 * ExpressionEvaluator - Evaluates constant expressions for symbol collection.
 * Handles hex, binary, and decimal integer literals.
 */

class ExpressionEvaluator {
  /**
   * Evaluate a constant expression string to a number.
   * Supports:
   * - Hexadecimal: 0x1F, 0X1F
   * - Binary: 0b1010, 0B1010
   * - Decimal: 42, -10
   *
   * @param expr The expression string
   * @returns The numeric value
   * @throws Error if the expression is invalid
   */
  static evaluateConstant(expr: string): number {
    // Handle hex literals
    if (expr.startsWith("0x") || expr.startsWith("0X")) {
      return Number.parseInt(expr, 16);
    }

    // Handle binary literals
    if (expr.startsWith("0b") || expr.startsWith("0B")) {
      return Number.parseInt(expr.substring(2), 2);
    }

    // Handle decimal
    const value = Number.parseInt(expr, 10);
    if (Number.isNaN(value)) {
      throw new TypeError(`Invalid constant expression: ${expr}`);
    }

    return value;
  }
}

export default ExpressionEvaluator;
