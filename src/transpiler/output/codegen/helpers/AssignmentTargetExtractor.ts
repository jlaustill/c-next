/**
 * Helper for extracting base identifier from assignment targets.
 * SonarCloud S3776: Extracted from walkStatementForModifications().
 */
import * as Parser from "../../../logic/parser/grammar/CNextParser";

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

    // Simple identifier: x <- value
    if (target.IDENTIFIER()) {
      return {
        baseIdentifier: target.IDENTIFIER()!.getText(),
        hasSingleIndexSubscript: false,
      };
    }

    // Member access: x.field <- value
    if (target.memberAccess()) {
      return this.extractFromMemberAccess(target.memberAccess()!);
    }

    // Array access: x[i] <- value
    if (target.arrayAccess()) {
      return this.extractFromArrayAccess(target.arrayAccess()!);
    }

    return { baseIdentifier: null, hasSingleIndexSubscript: false };
  }

  /**
   * Extract from member access pattern.
   */
  private static extractFromMemberAccess(
    memberAccess: Parser.MemberAccessContext,
  ): IAssignmentTargetResult {
    const identifiers = memberAccess.IDENTIFIER();
    return {
      baseIdentifier: identifiers.length > 0 ? identifiers[0].getText() : null,
      hasSingleIndexSubscript: false,
    };
  }

  /**
   * Extract from array access pattern.
   * Single-index subscript (x[i]) is array access.
   * Two-index subscript (x[0, 8]) is bit extraction.
   */
  private static extractFromArrayAccess(
    arrayAccess: Parser.ArrayAccessContext,
  ): IAssignmentTargetResult {
    const isSingleIndex = arrayAccess.expression().length === 1;
    return {
      baseIdentifier: arrayAccess.IDENTIFIER()?.getText() ?? null,
      hasSingleIndexSubscript: isSingleIndex,
    };
  }
}

export default AssignmentTargetExtractor;
