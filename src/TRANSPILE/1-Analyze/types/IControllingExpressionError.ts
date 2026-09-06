/**
 * ADR-022's controlling-expression rule, MISRA C:2012 Rules 14.4 and 13.5.
 *
 * Error codes:
 * - E0701: a controlling expression is not an explicit comparison
 * - E0702: a controlling expression calls a function
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IControllingExpressionError extends IBaseAnalysisError {}

export default IControllingExpressionError;
