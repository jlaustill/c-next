/**
 * ADR-024 integer conversions.
 *
 * Error codes:
 * - E0868: an integer literal does not fit the target type's range
 * - E0869: an implicit narrowing or sign-changing conversion
 * - E0891: an implicit floating-to-integer conversion
 * - E0914: a string value landing in an integer, float or bool
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IIntegerConversionError extends IBaseAnalysisError {}

export default IIntegerConversionError;
