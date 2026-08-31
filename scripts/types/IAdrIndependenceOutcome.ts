import IAdrViolation from "./IAdrViolation";

/**
 * The result of one rewrite-test scan over `docs/decisions/` (issue #1403).
 */
interface IAdrIndependenceOutcome {
  /** Violations in ADRs that are NOT exempt. Non-empty means the gate fails. */
  failures: IAdrViolation[];
  /** Exempt ADRs that still have violations, with the count each still carries. */
  exempt: { file: string; count: number }[];
  /**
   * Exempt ADRs that are now clean. These fail the gate too: a baseline that
   * keeps entries it no longer needs stops measuring anything, and shrinking it
   * is the only signal that the cleanup is progressing.
   */
  stale: string[];
  /** Total ADRs scanned, so the report can say what the gate covered. */
  scanned: number;
}

export default IAdrIndependenceOutcome;
