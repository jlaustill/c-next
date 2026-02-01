/**
 * Error reported when a function parameter has a reserved naming pattern
 * Issue #227: Parameters cannot start with their function name followed by underscore
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IParameterNamingError extends IBaseAnalysisError {
  /** Name of the parameter */
  parameterName: string;
  /** Name of the containing function */
  functionName: string;
}

export default IParameterNamingError;
