/**
 * Pure utility functions for binary expression generation.
 * Extracted from BinaryExprGenerator for testability (Issue #419).
 */
import LiteralUtils from "../../../utils/LiteralUtils";

/**
 * Issue #235: Try to parse a string as a numeric constant.
 * Delegates to LiteralUtils.parseIntegerLiteral to avoid duplication.
 */
const tryParseNumericLiteral = (code: string): number | undefined =>
  LiteralUtils.parseIntegerLiteral(code);

/**
 * ADR-001: Map C-Next equality operator to C.
 * C-Next uses = for equality (mathematical notation), C uses ==.
 */
const mapEqualityOperator = (cnextOp: string): string =>
  cnextOp === "=" ? "==" : cnextOp;

/**
 * ADR-045: Generate strcmp comparison code for string equality.
 */
const generateStrcmpCode = (
  left: string,
  right: string,
  isNotEqual: boolean,
): string => {
  const cmpOp = isNotEqual ? "!= 0" : "== 0";
  return `strcmp(${left}, ${right}) ${cmpOp}`;
};

/**
 * Issue #235: Evaluate a constant arithmetic expression.
 * Returns the result if all operands are numeric and evaluation succeeds,
 * undefined otherwise (falls back to non-folded code).
 */
const tryFoldConstants = (
  operandCodes: string[],
  operators: string[],
): number | undefined => {
  const values = operandCodes.map(tryParseNumericLiteral);

  if (values.some((v) => v === undefined)) {
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
};

class BinaryExprUtils {
  static tryParseNumericLiteral = tryParseNumericLiteral;
  static tryFoldConstants = tryFoldConstants;
  static mapEqualityOperator = mapEqualityOperator;
  static generateStrcmpCode = generateStrcmpCode;
}

export default BinaryExprUtils;
