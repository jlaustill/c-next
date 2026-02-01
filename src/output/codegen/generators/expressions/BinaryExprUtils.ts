/**
 * Pure utility functions for binary expression generation.
 * Extracted from BinaryExprGenerator for testability (Issue #419).
 */
import LiteralUtils from "../../../../utils/LiteralUtils";

class BinaryExprUtils {
  /**
   * Issue #235: Try to parse a string as a numeric constant.
   * Delegates to LiteralUtils.parseIntegerLiteral to avoid duplication.
   */
  static tryParseNumericLiteral(code: string): number | undefined {
    return LiteralUtils.parseIntegerLiteral(code);
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
   * Returns the result if all operands are numeric and evaluation succeeds,
   * undefined otherwise (falls back to non-folded code).
   */
  static tryFoldConstants(
    operandCodes: string[],
    operators: string[],
  ): number | undefined {
    const values = operandCodes.map(BinaryExprUtils.tryParseNumericLiteral);

    if (values.includes(undefined)) {
      return undefined;
    }

    let result = values[0] as number;
    for (let i = 0; i < operators.length; i++) {
      const op = operators[i];
      const rightValue = values[i + 1] as number;

      switch (op) {
        case "*":
          result = result * rightValue;
          break;
        case "/":
          if (rightValue === 0) {
            return undefined;
          }
          result = Math.trunc(result / rightValue);
          break;
        case "%":
          if (rightValue === 0) {
            return undefined;
          }
          result = result % rightValue;
          break;
        case "+":
          result = result + rightValue;
          break;
        case "-":
          result = result - rightValue;
          break;
        default:
          return undefined;
      }
    }

    return result;
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

  /**
   * ADR-017: Validate enum type safety for comparisons.
   * Throws if comparing different enum types or enum to integer.
   */
  static validateEnumComparison(
    leftEnumType: string | null,
    rightEnumType: string | null,
    leftIsInteger: boolean,
    rightIsInteger: boolean,
  ): void {
    if (leftEnumType && rightEnumType && leftEnumType !== rightEnumType) {
      throw new Error(
        `Error: Cannot compare ${leftEnumType} enum to ${rightEnumType} enum`,
      );
    }

    if (leftEnumType && rightIsInteger) {
      throw new Error(`Error: Cannot compare ${leftEnumType} enum to integer`);
    }

    if (rightEnumType && leftIsInteger) {
      throw new Error(`Error: Cannot compare integer to ${rightEnumType} enum`);
    }
  }
}

export default BinaryExprUtils;
