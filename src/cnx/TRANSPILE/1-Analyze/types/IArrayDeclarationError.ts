/**
 * ADR-035 array initializers and ADR-036 array declaration shape.
 *
 * Error codes:
 * - E0866: an array's initializer has the wrong number of elements for a
 *   dimension
 *
 * 1.2 Parse reports the declaration's form (`ArrayForm`): E0866's
 * not-a-list case, E0874, E0875, E0876 and E0892.
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IArrayDeclarationError extends IBaseAnalysisError {}

export default IArrayDeclarationError;
