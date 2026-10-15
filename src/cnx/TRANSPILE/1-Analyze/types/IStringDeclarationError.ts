/**
 * ADR-045 string declarations.
 *
 * Error codes, grouped by what the author has to change:
 * - E0864: the initializer does not fit the declared capacity
 * - E0865: a substring's bounds exceed its source
 *
 * 1.2 Parse reports the declaration's form: the codes whose Source in
 * `docs/error-codes.md` is `PARSE/2-Parse/StringForm.ts` or `ArrayForm.ts`.
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IStringDeclarationError extends IBaseAnalysisError {}

export default IStringDeclarationError;
