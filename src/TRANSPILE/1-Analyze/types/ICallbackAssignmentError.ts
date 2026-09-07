/**
 * ADR-029 callback typing.
 *
 * Error codes:
 * - E0879: a function placed into a callback-typed slot whose signature
 *   differs from the slot's type
 * - E0880: a function that is itself a callback type placed into a slot of
 *   another callback type (nominal typing)
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface ICallbackAssignmentError extends IBaseAnalysisError {}

export default ICallbackAssignmentError;
