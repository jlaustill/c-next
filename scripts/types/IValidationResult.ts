/**
 * Result of a validation step (compilation, static analysis, etc.)
 */
interface IValidationResult {
  valid: boolean;
  message?: string;
}

export default IValidationResult;
