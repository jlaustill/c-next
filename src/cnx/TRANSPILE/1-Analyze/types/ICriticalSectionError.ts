/**
 * `return` inside a `critical` block (ADR-050).
 *
 * Error codes:
 * - E0853: returning from a critical section leaves interrupts disabled
 * - E0916: a critical section on a target where disabling interrupts does not
 *   shut out every other context (`interrupt_mask: false`)
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface ICriticalSectionError extends IBaseAnalysisError {}

export default ICriticalSectionError;
