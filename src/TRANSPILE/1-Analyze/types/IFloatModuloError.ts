/**
 * Error reported when modulo operator is used with floating-point types
 *
 * Error codes:
 * - E0804: Modulo operator used with floating-point operand
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IFloatModuloError extends IBaseAnalysisError {}

export default IFloatModuloError;
