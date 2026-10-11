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
}

export default BinaryExprUtils;
