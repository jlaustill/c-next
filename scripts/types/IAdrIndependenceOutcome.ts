import IAdrViolation from "./IAdrViolation";

/**
 * The result of one rewrite-test scan over `docs/decisions/` (issue #1403).
 */
interface IAdrIndependenceOutcome {
  /** Every violation found. Non-empty means the gate fails; there are no exemptions. */
  failures: IAdrViolation[];
  /** Total ADRs scanned, so the report can say what the gate covered. */
  scanned: number;
}

export default IAdrIndependenceOutcome;
