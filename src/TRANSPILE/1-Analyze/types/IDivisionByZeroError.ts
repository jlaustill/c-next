/**
 * Error reported when division by zero is detected (ADR-051)
 *
 * Error codes, for a divisor that is zero at compile time -- a literal, a const
 * or a constant expression, integer or float (ADR-051 §1, §4):
 * - E0800: Division by zero
 * - E0802: Modulo by zero
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IDivisionByZeroError extends IBaseAnalysisError {
  /** Operator used ('/' or '%') */
  operator: string;
}

export default IDivisionByZeroError;
