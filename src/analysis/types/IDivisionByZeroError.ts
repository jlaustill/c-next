/**
 * Error reported when division by zero is detected (ADR-051)
 *
 * Error codes:
 * - E0800: Division by literal zero
 * - E0801: Division by const that evaluates to zero
 * - E0802: Modulo by literal zero
 * - E0803: Modulo by const that evaluates to zero
 */
interface IDivisionByZeroError {
  /** Error code (E0800-E0803) */
  code: string;
  /** Operator used ('/' or '%') */
  operator: string;
  /** Line number where the error occurred */
  line: number;
  /** Column number where the error occurred */
  column: number;
  /** Human-readable error message */
  message: string;
  /** Optional help text with suggested fix */
  helpText?: string;
}

export default IDivisionByZeroError;
