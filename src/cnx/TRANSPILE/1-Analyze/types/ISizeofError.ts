/**
 * ADR-023: C-Next has no `sizeof`.
 *
 * Error codes:
 * - E0603: `sizeof` is written; a size is ADR-058's `.byte_length`
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface ISizeofError extends IBaseAnalysisError {}

export default ISizeofError;
