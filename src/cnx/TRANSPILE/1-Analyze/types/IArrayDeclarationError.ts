/**
 * ADR-035 array initializers and ADR-036 array declaration shape.
 *
 * Error codes:
 * - E0866: an array's initializer has the wrong number of elements for a
 *   dimension
 * - E0917: a `for` header declares a variable of a header typedef that names
 *   an array (#1823); 1.2 reports one written as an array
 *
 * 1.2 Parse reports the declaration's form: the codes whose Source in
 * `docs/error-codes.md` is `PARSE/2-Parse/ArrayForm.ts`.
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IArrayDeclarationError extends IBaseAnalysisError {}

export default IArrayDeclarationError;
