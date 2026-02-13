/**
 * Helper for extracting base identifier from assignment targets.
 * SonarCloud S3776: Extracted from walkStatementForModifications().
 */
import * as Parser from "../../parser/grammar/CNextParser";

/**
 * Result from extracting assignment target base identifier.
 */
interface IAssignmentTargetResult {
  /** The base identifier name, or null if not found */
  baseIdentifier: string | null;
  /** True if target has single-index subscript (array access, not bit extraction) */
  hasSingleIndexSubscript: boolean;
}

/**
 * Extracts base identifier from various assignment target patterns.
 * With unified grammar, all patterns use IDENTIFIER postfixTargetOp*.
 */
class AssignmentTargetExtractor {
  /**
   * Extract base identifier from an assignment target.
   *
   * Handles:
   * - Simple identifier: `x <- value`
   * - Member access: `x.field <- value` (returns 'x')
   * - Array access: `x[i] <- value` (returns 'x', flags subscript)
   */
  static extract(
    target: Parser.AssignmentTargetContext | undefined,
  ): IAssignmentTargetResult {
    if (!target) {
      return { baseIdentifier: null, hasSingleIndexSubscript: false };
    }

    // All patterns have base IDENTIFIER
    const baseIdentifier = target.IDENTIFIER()?.getText() ?? null;

    // Check postfixTargetOp for subscripts
    const postfixOps = target.postfixTargetOp();
    let hasSingleIndexSubscript = false;

    for (const op of postfixOps) {
      const exprs = op.expression();
      if (exprs.length === 1) {
        // Single-index subscript (array access)
        hasSingleIndexSubscript = true;
        break;
      }
      // Two-index subscript (bit extraction) doesn't set the flag
    }

    return { baseIdentifier, hasSingleIndexSubscript };
  }
}

export default AssignmentTargetExtractor;
