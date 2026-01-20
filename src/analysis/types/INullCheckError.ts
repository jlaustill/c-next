/**
 * Error reported when NULL safety rules are violated (ADR-046)
 *
 * Error codes:
 * - E0901: C library function can return NULL - must check result
 * - E0902: Dynamic allocation function forbidden (ADR-003)
 * - E0903: NULL can only be used in comparison context
 * - E0904: Cannot store C function pointer return in variable
 * - E0905: Missing c_ prefix for nullable C type
 * - E0906: Invalid c_ prefix on non-nullable type
 * - E0907: NULL comparison on non-nullable variable
 * - E0908: Nullable c_ variable used without prior NULL check (flow analysis)
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
