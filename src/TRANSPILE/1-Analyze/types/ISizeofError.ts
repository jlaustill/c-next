/**
 * ADR-023's `sizeof` operand rules.
 *
 * Error codes:
 * - E0601: `sizeof` on an array parameter, which measures a pointer
 * - E0602: `sizeof` on an operand with side effects (MISRA C:2012 Rule 13.6)
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface ISizeofError extends IBaseAnalysisError {}

export default ISizeofError;
