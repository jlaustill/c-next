/**
 * One construct whose shape a safety standard dictated, rather than the
 * obvious translation.
 *
 * CLAUDE.md makes emitting these a C-Next standard: the generated C is the
 * certification artifact, so a reviewer must be able to trace each non-obvious
 * construct back to the rule that shaped it, and must not mistake it for
 * accidental complexity.
 */
interface IComplianceAnnotation {
  /** Rule number as the standard writes it, e.g. `21.15`. */
  readonly rule: string;

  /** What the generated construct does instead of the naive translation. */
  readonly what: string;

  /**
   * What the naive form would have done, and why the rule forbids it.
   *
   * This is the half CLAUDE.md is specific about and the half that drifted: an
   * annotation naming the C-Next construct explains nothing to someone reading
   * the C. Rendered inside parentheses, so it carries no trailing period of its
   * own, and it must not contain a comment opener -- a nested one is MISRA
   * C:2012 Rule 3.1, which would make the annotation itself a violation.
   */
  readonly why: string;
}

export default IComplianceAnnotation;
