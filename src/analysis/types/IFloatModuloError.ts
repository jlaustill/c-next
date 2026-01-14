/**
 * Error reported when modulo operator is used with floating-point types
 *
 * Error codes:
 * - E0804: Modulo operator used with floating-point operand
 */
interface IFloatModuloError {
  /** Error code (E0804) */
  code: string;
  /** Line number where the error occurred */
  line: number;
  /** Column number where the error occurred */
  column: number;
  /** Human-readable error message */
  message: string;
  /** Optional help text with suggested fix */
  helpText?: string;
}

export default IFloatModuloError;
