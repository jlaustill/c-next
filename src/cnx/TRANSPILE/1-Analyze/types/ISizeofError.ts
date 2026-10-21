/**
 * ADR-023: cnx has no `sizeof`.
 *
 * Error codes:
 * - E0603: `sizeof` is written; a size is ADR-058's `.type_byte_length`
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface ISizeofError extends IBaseAnalysisError {}

export default ISizeofError;
