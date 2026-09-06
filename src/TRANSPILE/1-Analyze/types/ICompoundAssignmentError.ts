/**
 * Compound assignment on a target that is not a whole storage location.
 *
 * Error codes:
 * - E0857: compound operator on a bit index, bit range, slice or string
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface ICompoundAssignmentError extends IBaseAnalysisError {}

export default ICompoundAssignmentError;
