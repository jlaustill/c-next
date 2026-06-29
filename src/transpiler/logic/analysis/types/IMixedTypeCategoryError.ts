/**
 * Error reported when a binary operator combines operands of different
 * essential type categories (signed vs unsigned).
 *
 * Error codes:
 * - E0810: Mixed essential type category in a binary operation
 *
 * MISRA C:2012 Rule 10.4: "Both operands of an operator in which the usual
 * arithmetic conversions are performed shall have the same essential type
 * category." Combining a signed and an unsigned value implicitly relies on the
 * usual arithmetic conversions, whose result can be surprising (ADR-024).
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IMixedTypeCategoryError extends IBaseAnalysisError {}

export default IMixedTypeCategoryError;
