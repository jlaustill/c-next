/**
 * ADR-068 loops and ADR-026 break/continue.
 *
 * Error codes:
 * - E0703: `break` or `continue` (ADR-026 rejects both)
 * - E0705: `forever` in a non-void function
 * - E0707: a disguised infinite loop -- `for (;;)`, or an always-true
 *   literal condition
 * - E0715: a `for` header assignment that lowers to more than one C
 *   statement -- a string copy, a slice write, an atomic read-modify-write
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface ILoopError extends IBaseAnalysisError {}

export default ILoopError;
