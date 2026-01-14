/**
 * Error reported when a function is called before it's defined (ADR-030)
 */
interface IFunctionCallError {
  /** Error code (E0422) */
  code: string;
  /** Name of the function that was called */
  functionName: string;
  /** Line number where the call occurred */
  line: number;
  /** Column number where the call occurred */
  column: number;
  /** Human-readable error message */
  message: string;
}

export default IFunctionCallError;
