/**
 * Shift operands and amounts.
 *
 * Error codes:
 * - E0805: a shift operator on a signed integer type (MISRA C:2012 Rule 10.1)
 * - E0873: a shift amount that is negative or not below the operand's width
 *   (MISRA C:2012 Rule 12.2)
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IShiftError extends IBaseAnalysisError {}

export default IShiftError;
