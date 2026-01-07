/**
 * Error reported when NULL safety rules are violated (ADR-047)
 *
 * Error codes:
 * - E0901: C library function can return NULL - must check result
 * - E0902: C library function returns pointer - not supported in v1
 * - E0903: NULL can only be used in comparison context
 * - E0904: Cannot store C function pointer return in variable
 */
export interface INullCheckError {
  /** Error code (E0901-E0904) */
  code: string;
  /** Name of the function or literal involved */
  functionName: string;
  /** Line number where the error occurred */
  line: number;
  /** Column number where the error occurred */
  column: number;
  /** Human-readable error message */
  message: string;
  /** Optional help text with suggested fix */
  helpText?: string;
}

export default INullCheckError;
