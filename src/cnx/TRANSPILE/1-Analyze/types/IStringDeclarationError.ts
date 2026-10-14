/**
 * ADR-045 string declarations.
 *
 * Error codes, grouped by what the author has to change:
 * - E0864: the initializer does not fit the declared capacity
 * - E0865: a substring's bounds exceed its source
 *
 * 1.2 Parse reports the declaration's form: `StringForm` E0862 and E0863,
 * `ArrayForm` E0866 when the initializer is not a list.
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IStringDeclarationError extends IBaseAnalysisError {}

export default IStringDeclarationError;
