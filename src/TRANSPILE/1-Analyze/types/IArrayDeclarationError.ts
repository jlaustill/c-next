/**
 * ADR-035 array initializers and ADR-036 array declaration shape.
 *
 * Error codes:
 * - E0866: an array's initializer does not match its declaration -- not a
 *   list, or the wrong number of elements for a dimension
 * - E0874: a C-style array declaration or parameter (dimensions after the name)
 * - E0875: an unbounded array parameter
 * - E0876: the fill-all form on an array whose size is inferred
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IArrayDeclarationError extends IBaseAnalysisError {}

export default IArrayDeclarationError;
