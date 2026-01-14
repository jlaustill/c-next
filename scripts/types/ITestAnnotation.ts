/**
 * Represents a coverage annotation found in a test file
 */
interface ITestAnnotation {
  /** The coverage ID from the annotation (e.g., "1.1-u8-in-ternary-expression") */
  coverageId: string;

  /** Absolute path to the test file */
  testFile: string;

  /** Relative path from tests/ directory */
  relativePath: string;

  /** Line number where annotation appears */
  lineNumber: number;
}

export default ITestAnnotation;
