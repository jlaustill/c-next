import ICoverageItem from "./ICoverageItem";
import ICoverageSummary from "./ICoverageSummary";
import IMismatch from "./IMismatch";
import ITestAnnotation from "./ITestAnnotation";

/**
 * Complete coverage report
 */
interface ICoverageReport {
  /** When the report was generated */
  generated: Date;

  /** Summary statistics */
  summary: ICoverageSummary;

  /** All coverage items from coverage.md */
  items: ICoverageItem[];

  /** All annotations found in test files */
  annotations: ITestAnnotation[];

  /** Detected mismatches */
  mismatches: IMismatch[];

  /** Untested items (gaps) */
  gaps: ICoverageItem[];
}

export default ICoverageReport;
