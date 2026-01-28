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

class BinaryExprUtils {
  static tryParseNumericLiteral = tryParseNumericLiteral;
}

export default BinaryExprUtils;
