/**
 * ADR-010 include directives.
 *
 * Error codes:
 * - E0503: `#include` of an implementation file (`.c`, `.cpp`, …)
 * - E0504: a `.cnx` exists where the included header does; use it instead
 * - E0506: an included C-Next file does not exist
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IIncludeDirectiveError extends IBaseAnalysisError {}

export default IIncludeDirectiveError;
