/**
 * `return` inside a `critical` block (ADR-050).
 *
 * Error codes:
 * - E0853: returning from a critical section leaves interrupts disabled
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface ICriticalSectionError extends IBaseAnalysisError {}

export default ICriticalSectionError;
