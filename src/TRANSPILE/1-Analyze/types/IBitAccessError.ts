/**
 * ADR-007 bit indexing.
 *
 * Error codes:
 * - E0856: more subscripts than the base's shape allows
 * - E0888: a float bit range read at file scope, where no union can be built
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IBitAccessError extends IBaseAnalysisError {}

export default IBitAccessError;
