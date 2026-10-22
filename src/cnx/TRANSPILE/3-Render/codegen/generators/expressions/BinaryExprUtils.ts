/**
 * Pure utility functions for binary expression generation.
 * Extracted from BinaryExprGenerator for testability (Issue #419).
 */
import LiteralUtils from "../../../../../utils/LiteralUtils";

class BinaryExprUtils {
  /**
   * The line ADR-001's `=` as equality fires on in a comparison, or undefined
   * when it holds none: the one test the written and the folded comparison
   * share (#1735 review)
   */
  static equalityAdrLine(
    operators: ReadonlyArray<string>,
    line: number,
  ): number | undefined {
    return operators.includes("=") ? line : undefined;
  }

  /**
   * Issue #235: Try to parse a string as a numeric constant, when its value
   * is exact (#1760 review: `LiteralUtils.isExactInteger`).
   */
  static tryParseNumericLiteral(code: string): number | undefined {
    return LiteralUtils.exactIntegerLiteral(code);
  }

  /**
   * ADR-001: Map cnx equality operator to C.
   * cnx uses = for equality (mathematical notation), C uses ==.
   */
  static mapEqualityOperator(cnxOp: string): string {
    return cnxOp === "=" ? "==" : cnxOp;
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
