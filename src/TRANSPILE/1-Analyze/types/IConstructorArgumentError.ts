/**
 * C++ constructor argument errors (ADR-013 / issue #375).
 *
 * Error codes:
 * - E0432: argument is not const
 * - E0433: argument names nothing declared
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IConstructorArgumentError extends IBaseAnalysisError {}

export default IConstructorArgumentError;
