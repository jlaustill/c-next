/**
 * ADR-052 slice assignment: `buffer[offset, length] <- value`.
 *
 * Error codes, grouped by what the author has to change rather than by which
 * line of the check failed:
 * - E0858: the TARGET cannot be sliced (element type, dimensions, capacity)
 * - E0859: the offset or length is not a compile-time constant
 * - E0860: the span does not fit the buffer (bounds, alignment, sign)
 * - E0861: the SOURCE does not fit the slice (type, width, literal range)
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface ISliceAssignmentError extends IBaseAnalysisError {}

export default ISliceAssignmentError;
