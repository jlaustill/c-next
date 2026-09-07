/**
 * ADR-036 constant index bounds.
 *
 * Error codes:
 * - E0854: a compile-time array index that is negative or not below the
 *   dimension it indexes
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IArrayIndexBoundsError extends IBaseAnalysisError {}

export default IArrayIndexBoundsError;
