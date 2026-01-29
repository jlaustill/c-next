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
import IBaseAnalysisError from "./IBaseAnalysisError";

interface INullCheckError extends IBaseAnalysisError {
  /** Name of the function or literal involved */
  functionName: string;
}

export default INullCheckError;
