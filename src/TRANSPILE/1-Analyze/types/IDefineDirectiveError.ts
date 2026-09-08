/**
 * ADR-037 preprocessor directives.
 *
 * Error codes:
 * - E0501: a function-like macro, `#define NAME(args) …`
 * - E0502: a `#define` carrying a value, `#define NAME value`
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IDefineDirectiveError extends IBaseAnalysisError {}

export default IDefineDirectiveError;
