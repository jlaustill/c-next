/**
 * Error reported when a binary operator combines operands of different
 * essential type categories (signed vs unsigned).
 *
 * Error codes:
 * - E0810: Mixed essential type category in a binary operation
 * - E0811: An integer combined with a header macro whose type C-Next cannot
 *   read, by an operator that reaches a clamp helper (#1688, ADR-024)
 * - E0812: The same, by any other Rule 10.4 operator or a conditional's arms
 *
 * MISRA C:2012 Rule 10.4: "Both operands of an operator in which the usual
 * arithmetic conversions are performed shall have the same essential type
 * category." Combining a signed and an unsigned value implicitly relies on the
 * usual arithmetic conversions, whose result can be surprising (ADR-024).
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IMixedTypeCategoryError extends IBaseAnalysisError {}

export default IMixedTypeCategoryError;
