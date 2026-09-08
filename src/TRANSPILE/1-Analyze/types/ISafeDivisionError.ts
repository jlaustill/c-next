/**
 * ADR-051's `safe_div` / `safe_mod` call shape.
 *
 * Error codes:
 * - E0884: the call does not take exactly four arguments
 * - E0885: the first argument is not a variable to receive the result
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface ISafeDivisionError extends IBaseAnalysisError {}

export default ISafeDivisionError;
