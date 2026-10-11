/**
 * Base interface for all analysis errors.
 *
 * All analyzer error interfaces extend this common base,
 * providing a consistent structure for error reporting.
 */
interface IBaseAnalysisError {
  /** Error code (e.g., E0381, E0800) */
  code: string;
  /** Line number where the error occurred */
  line: number;
  /** Column number where the error occurred */
  column: number;
  /** Human-readable error message */
  message: string;
  /** Optional help text with suggested fix */
  helpText?: string;
  /** A warning is reported and the file still compiles (E0896) */
  severity?: "error" | "warning";
}

export default IBaseAnalysisError;
