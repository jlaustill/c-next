/**
 * ADR-004 register access modifiers.
 *
 * Error codes:
 * - E0870: a `wo` register member is read
 * - E0871: an `ro` register member is written
 * - E0872: a write-1 register bit (`wo`/`w1s`/`w1c`) is assigned a zero
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IRegisterAccessError extends IBaseAnalysisError {}

export default IRegisterAccessError;
