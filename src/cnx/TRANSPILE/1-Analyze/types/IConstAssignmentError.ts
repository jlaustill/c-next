/**
 * ADR-071 read-only enforcement.
 *
 * Error codes:
 * - E0900: a write to a binding not declared `mut` -- an assignment whose
 *   target is, or is reached through, it, a `safe_div`/`safe_mod` output, or
 *   an argument to a `mut` parameter
 * - E0899: a `mut` binding nothing writes
 */
import IBaseAnalysisError from "./IBaseAnalysisError";

interface IConstAssignmentError extends IBaseAnalysisError {}

export default IConstAssignmentError;
