/**
 * A type named where a value goes (#1975 review, #2078).
 *
 * Error code:
 * - E0897: a chain that names a type does not end reading a length of it
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface ITypeNameValueError extends IBaseAnalysisError {}

export default ITypeNameValueError;
