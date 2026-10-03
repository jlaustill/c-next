/**
 * A declared type whose own shape is invalid.
 *
 * Error codes:
 * - E0893: a bitmap's field widths do not add up to its size (ADR-034)
 * - E0894: an enum member's value is negative (ADR-017)
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface ITypeDeclarationError extends IBaseAnalysisError {}

export default ITypeDeclarationError;
