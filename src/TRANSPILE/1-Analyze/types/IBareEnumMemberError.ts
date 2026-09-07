/**
 * ADR-017 bare enum members.
 *
 * Error codes:
 * - E0424: an enum member written bare where nothing names its enum
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IBareEnumMemberError extends IBaseAnalysisError {}

export default IBareEnumMemberError;
