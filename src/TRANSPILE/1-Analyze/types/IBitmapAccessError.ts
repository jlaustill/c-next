/**
 * ADR-034 bitmap access.
 *
 * Error codes:
 * - E0881: a literal wider than the bitmap field it is assigned to
 * - E0882: a member that the bitmap does not declare
 * - E0883: bracket indexing where ADR-034 requires a named field
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IBitmapAccessError extends IBaseAnalysisError {}

export default IBitmapAccessError;
