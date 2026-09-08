/**
 * ADR-024 integer conversions.
 *
 * Error codes:
 * - E0868: an integer literal does not fit the target type's range
 * - E0869: an implicit narrowing or sign-changing conversion
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IIntegerConversionError extends IBaseAnalysisError {}

export default IIntegerConversionError;
