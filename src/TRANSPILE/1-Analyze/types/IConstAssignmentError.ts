/**
 * ADR-013 const enforcement.
 *
 * Error codes:
 * - E0877: an assignment whose target is, or is reached through, a `const`
 *   variable or parameter
 * - E0878: a `const` value passed to a function's non-const parameter
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IConstAssignmentError extends IBaseAnalysisError {}

export default IConstAssignmentError;
