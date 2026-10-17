/**
 * `return` inside a `critical` block (ADR-050).
 *
 * Error codes:
 * - E0853: returning from a critical section leaves interrupts disabled
 * - E0915: a critical section on a target that cannot mask interrupts
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface ICriticalSectionError extends IBaseAnalysisError {}

export default ICriticalSectionError;
