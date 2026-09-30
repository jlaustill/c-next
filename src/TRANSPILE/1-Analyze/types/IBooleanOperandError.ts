/**
 * Error reported when an arithmetic, bitwise, shift or relational operator is
 * applied to an essentially Boolean operand.
 *
 * Error codes:
 * - E0807: Operator not valid on a bool operand
 *
 * MISRA C:2012 Rule 10.1: "Operands shall not be of an inappropriate essential
 * type." A bool is permitted only for the logical operators (&&, ||, !), for
 * equality (=, !=), and as a controlling expression -- it is not a number.
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IBooleanOperandError extends IBaseAnalysisError {}

export default IBooleanOperandError;
