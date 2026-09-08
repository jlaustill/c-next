/**
 * ADR-058 explicit length properties.
 *
 * Error code:
 * - E0867: a length property is not available on the type it is asked of
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface ILengthPropertyError extends IBaseAnalysisError {}

export default ILengthPropertyError;
