/**
 * `this` used outside a `scope` (ADR-016).
 *
 * Error codes:
 * - E0431: `this` can only be used inside a scope
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IThisOutsideScopeError extends IBaseAnalysisError {}

export default IThisOutsideScopeError;
