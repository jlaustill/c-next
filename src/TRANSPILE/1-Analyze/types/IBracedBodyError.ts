/**
 * An `if`, `else`, `while` or `for` body that is not a braced block (#1090).
 *
 * Error codes:
 * - E0716: the body must be a braced block (MISRA C:2012 Rule 15.6)
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IBracedBodyError extends IBaseAnalysisError {}

export default IBracedBodyError;
