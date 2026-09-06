/**
 * ADR-045 string declarations.
 *
 * Error codes, grouped by what the author has to change:
 * - E0862: the declaration does not state a capacity this pass can determine
 * - E0863: a string at file scope is initialized by something other than a literal
 * - E0864: the initializer does not fit the declared capacity
 * - E0865: a substring's bounds exceed its source
 * - E0866: a string array's initializer does not match its declaration
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IStringDeclarationError extends IBaseAnalysisError {}

export default IStringDeclarationError;
