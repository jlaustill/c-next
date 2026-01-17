/**
 * Error reported when a function parameter has a reserved naming pattern
 * Issue #227: Parameters cannot start with their function name followed by underscore
 */
interface IParameterNamingError {
  /** Error code (E0227) - matches issue number */
  code: string;
  /** Name of the parameter */
  parameterName: string;
  /** Name of the containing function */
  functionName: string;
  /** Line number where the parameter is declared */
  line: number;
  /** Column number where the parameter is declared */
  column: number;
  /** Human-readable error message */
  message: string;
}

export default IParameterNamingError;
