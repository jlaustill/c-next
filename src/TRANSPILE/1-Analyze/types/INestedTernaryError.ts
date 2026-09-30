/**
 * A ternary nested inside another ternary's branches (ADR-022).
 *
 * Error codes:
 * - E0710: nested ternary is not allowed
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface INestedTernaryError extends IBaseAnalysisError {}

export default INestedTernaryError;
