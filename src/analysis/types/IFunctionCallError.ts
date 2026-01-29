/**
 * Error reported when a function is called before it's defined (ADR-030)
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IFunctionCallError extends IBaseAnalysisError {
  /** Name of the function that was called */
  functionName: string;
}

export default IFunctionCallError;
