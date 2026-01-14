/**
 * Represents an error or warning from the transpiler
 */
interface ITranspileError {
  /** Line number (1-based) */
  line: number;
  /** Column number (0-based) */
  column: number;
  /** Error message */
  message: string;
  /** Severity: 'error' or 'warning' */
  severity: "error" | "warning";
}

export default ITranspileError;
