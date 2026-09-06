/**
 * Error reported when a non-void function can reach the end of its body
 * without returning a value (ADR-067, Issue #1040).
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IReturnPathError extends IBaseAnalysisError {
  /** Name of the offending function */
  functionName: string;
}

export default IReturnPathError;
