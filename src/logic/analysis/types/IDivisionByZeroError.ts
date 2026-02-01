/**
 * Error reported when division by zero is detected (ADR-051)
 *
 * Error codes:
 * - E0800: Division by literal zero
 * - E0801: Division by const that evaluates to zero
 * - E0802: Modulo by literal zero
 * - E0803: Modulo by const that evaluates to zero
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IDivisionByZeroError extends IBaseAnalysisError {
  /** Operator used ('/' or '%') */
  operator: string;
}

export default IDivisionByZeroError;
