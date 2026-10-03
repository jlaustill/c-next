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
