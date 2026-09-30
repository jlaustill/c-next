import type IBaseAnalysisError from "./IBaseAnalysisError";
import type TIdentifierViolation from "./TIdentifierViolation";

/**
 * Error reported when a declared identifier violates the underscore rule (ADR-063).
 */
interface IIdentifierSyntaxError extends IBaseAnalysisError {
  /** The offending identifier as written in the source */
  identifierName: string;

  /** Which part of the rule was broken */
  violation: TIdentifierViolation;
}

export default IIdentifierSyntaxError;
