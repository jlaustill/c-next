import ISectionSummary from "./ISectionSummary";

/**
 * Overall coverage summary
 */
interface ICoverageSummary {
  /** Total coverage items in coverage.md */
  totalItems: number;

  /** Items marked as tested [x] */
  testedItems: number;

  /** Items not tested [ ] */
  untestedItems: number;

  /** Items that have annotations in test files */
  annotatedItems: number;

  /** Number of mismatches found */
  mismatchCount: number;

  /** Overall coverage percentage */
  coveragePercentage: number;

  /** Per-section breakdown */
  sections: ISectionSummary[];
}

export default ICoverageSummary;
