/**
 * Error reported about a function CALL, once the callee has been resolved.
 *
 * Error codes:
 * - E0422: called before definition (ADR-030)
 * - E0423: recursive call (MISRA C:2012 Rule 17.2)
 * - E0902: importing a dynamic memory function from C/C++ (ADR-003)
 *
 * E0902 sits here rather than with the NULL-check codes because it is a fact
 * about RESOLUTION: the same name is an error when it came from a header and
 * fine when the author defined it (#1306 review).
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IFunctionCallError extends IBaseAnalysisError {
  /** Name of the function that was called */
  functionName: string;
}

export default IFunctionCallError;
