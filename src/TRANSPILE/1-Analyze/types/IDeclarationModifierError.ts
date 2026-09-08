/**
 * ADR-049 declaration modifiers.
 *
 * Error codes:
 * - E0889: `atomic` and `volatile` on one declaration
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IDeclarationModifierError extends IBaseAnalysisError {}

export default IDeclarationModifierError;
