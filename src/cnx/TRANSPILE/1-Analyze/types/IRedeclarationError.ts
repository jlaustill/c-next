/**
 * A name declared twice in one C scope (#2011).
 *
 * Error codes:
 * - E0425: symbol defined multiple times
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IRedeclarationError extends IBaseAnalysisError {}

export default IRedeclarationError;
