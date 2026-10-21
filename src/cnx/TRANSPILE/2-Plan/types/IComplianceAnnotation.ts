/**
 * One construct whose shape a standard dictated -- a safety standard, or the
 * C or C++ standard itself -- rather than the obvious translation.
 *
 * CLAUDE.md makes emitting these a cnx standard: the generated C is the
 * certification artifact, so a reviewer must be able to trace each non-obvious
 * construct back to the rule that shaped it, and must not mistake it for
 * accidental complexity.
 */
interface IComplianceAnnotation {
  /**
   * The standard and its rule, as each writes it: `MISRA C:2012 Rule 21.15`,
   * or `C11 6.2.1p7, C++ [basic.scope.pdecl]` for the language's own.
   */
  readonly citation: string;

  /** What the generated construct does instead of the naive translation. */
  readonly what: string;

  /**
   * What the naive form would have done, and why the rule forbids it.
   *
   * This is the half CLAUDE.md is specific about and the half that drifted: an
   * annotation naming the cnx construct explains nothing to someone reading
   * the C. Rendered inside parentheses, so it carries no trailing period of its
   * own, and it must not contain a comment opener -- a nested one is MISRA
   * C:2012 Rule 3.1, which would make the annotation itself a violation.
   */
  readonly why: string;
}

export default IComplianceAnnotation;
