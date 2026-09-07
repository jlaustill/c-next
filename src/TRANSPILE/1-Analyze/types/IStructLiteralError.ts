/**
 * ADR-014 struct initializers.
 *
 * Error codes:
 * - E0356: an explicit type written where the position already supplies one
 * - E0357: an inferred initializer in a position that supplies no type
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IStructLiteralError extends IBaseAnalysisError {}

export default IStructLiteralError;
