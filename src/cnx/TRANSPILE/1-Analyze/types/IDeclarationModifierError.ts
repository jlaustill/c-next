/**
 * ADR-049 declaration modifiers.
 *
 * Error codes:
 * - E0889: `atomic` and `volatile` on one declaration
 * - E0919: `atomic` and `mut` on one declaration (#2233)
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IDeclarationModifierError extends IBaseAnalysisError {}

export default IDeclarationModifierError;
