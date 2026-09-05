import IGhPaginationViolation from "./IGhPaginationViolation";

/**
 * The result of one scan over every tracked file that could hold a `gh`
 * invocation (issue #1416).
 */
interface IGhPaginationOutcome {
  /** Every violation found. Non-empty means the gate fails; there are no exemptions. */
  failures: IGhPaginationViolation[];
  /**
   * Files read, so the report says what the gate covered. A collapse in this
   * number is how a broken candidate filter becomes visible — the filter hiding
   * files is the same defect this gate exists to catch.
   */
  scanned: number;
}

export default IGhPaginationOutcome;
