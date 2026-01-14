import ICoverageItem from "./ICoverageItem";
import ITestAnnotation from "./ITestAnnotation";

/**
 * A mismatch between coverage.md and test annotations
 */
interface IMismatch {
  /** The coverage item (if found) */
  coverageItem?: ICoverageItem;

  /** The annotation (if found) */
  annotation?: ITestAnnotation;

  /** Description of the mismatch */
  issue: string;

  /** Type of mismatch */
  type: "unknown_id" | "status_mismatch" | "missing_test_file";
}

export default IMismatch;
