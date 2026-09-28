/**
 * Pure utility functions for binary expression generation.
 * Extracted from BinaryExprGenerator for testability (Issue #419).
 */
import LiteralUtils from "../../../../../utils/LiteralUtils";

class BinaryExprUtils {
  /**
   * Issue #235: Try to parse a string as a numeric constant, when its value
   * is exact (#1760 review: `LiteralUtils.isExactInteger`).
   */
  static tryParseNumericLiteral(code: string): number | undefined {
    return LiteralUtils.exactIntegerLiteral(code);
  }

  /**
   * ADR-001: Map C-Next equality operator to C.
   * C-Next uses = for equality (mathematical notation), C uses ==.
   */
  static mapEqualityOperator(cnextOp: string): string {
    return cnextOp === "=" ? "==" : cnextOp;
  }

  /**
   * ADR-045: Generate strcmp comparison code for string equality.
   */
  static generateStrcmpCode(
    left: string,
    right: string,
    isNotEqual: boolean,
  ): string {
    const cmpOp = isNotEqual ? "!= 0" : "== 0";
    return `strcmp(${left}, ${right}) ${cmpOp}`;
  }

  /**
   * Issue #235: Evaluate a constant arithmetic expression.
   * Returns the result if all operands are numeric and every step is exact,
   * undefined otherwise (falls back to non-folded code). #1760 review: a step
   * past 2^53 is rounded, and `9007199254740993 - 9007199254740992` folded
   * to 0 where C computes 1.
   */
  static tryFoldConstants(
    operandCodes: string[],
    operators: string[],
  ): number | undefined {
    const values = operandCodes.map(BinaryExprUtils.tryParseNumericLiteral);

    let result = values[0];
    for (let i = 0; i < operators.length; i++) {
      result = BinaryExprUtils.applyOperator(
        operators[i],
        result,
        values[i + 1],
      );
    }
    return LiteralUtils.isExactInteger(result) ? result : undefined;
  }

  /**
   * One step of a constant fold, or undefined when an operand is unknown,
   * the divisor is zero, or the step is not exact.
   */
  private static applyOperator(
    op: string,
    left: number | undefined,
    right: number | undefined,
  ): number | undefined {
    if (!LiteralUtils.isExactInteger(left)) return undefined;
    if (!LiteralUtils.isExactInteger(right)) return undefined;
    switch (op) {
      case "*":
        return left * right;
      case "/":
        return right === 0 ? undefined : Math.trunc(left / right);
      case "%":
        return right === 0 ? undefined : left % right;
      case "+":
        return left + right;
      case "-":
        return left - right;
      default:
        return undefined;
    }
  }

  /**
   * Build a chained binary expression from operands and operators.
   * Used by relational, shift, additive, and multiplicative generators.
   */
  static buildChainedExpression(
    operands: string[],
    operators: string[],
    defaultOp: string,
  ): string {
    if (operands.length === 0) {
      return "";
    }

    let result = operands[0];
    for (let i = 1; i < operands.length; i++) {
      const op = operators[i - 1] || defaultOp;
      result += ` ${op} ${operands[i]}`;
    }

    return result;
  }
}

export default BinaryExprUtils;
