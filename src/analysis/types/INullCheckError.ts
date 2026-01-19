/**
 * Error reported when NULL safety rules are violated (ADR-046, supersedes ADR-047)
 *
 * Error codes:
 * - E0901: C library function can return NULL - must check result (stream functions)
 * - E0902: C library function is forbidden (malloc, free, etc. - ADR-003)
 * - E0903: NULL can only be used in comparison context
 * - E0904: Cannot store stream function return in variable (must use inline check)
 * - E0905: Missing c_ prefix for nullable C type
 * - E0906: Invalid c_ prefix on non-nullable type
 * - E0907: NULL comparison on non-nullable variable
 * - E0908: Missing NULL check before use of c_ variable
 */
interface INullCheckError {
  /** Error code (E0901-E0908) */
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
