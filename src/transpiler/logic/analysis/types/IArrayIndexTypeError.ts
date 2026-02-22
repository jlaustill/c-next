/**
 * Error reported when a non-unsigned-integer type is used as an array or bit subscript index.
 *
 * Error codes:
 * - E0850: Signed integer type used as subscript index
 * - E0851: Floating-point type used as subscript index
 * - E0852: Other non-integer type used as subscript index
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IArrayIndexTypeError extends IBaseAnalysisError {
  actualType: string;
}

export default IArrayIndexTypeError;
