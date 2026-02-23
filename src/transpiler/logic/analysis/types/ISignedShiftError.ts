/**
 * Error reported when shift operator is used with signed integer types
 *
 * Error codes:
 * - E0805: Shift operator used with signed integer operand
 *
 * MISRA C:2012 Rule 10.1: Operands shall not be of an inappropriate essential type
 * Left-shifting negative signed values is undefined behavior.
 * Right-shifting negative signed values is implementation-defined.
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface ISignedShiftError extends IBaseAnalysisError {}

export default ISignedShiftError;
