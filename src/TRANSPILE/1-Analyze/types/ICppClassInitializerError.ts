/**
 * Issue #517: C++ classes with user-defined constructors are not aggregates,
 * so a struct-initializer literal is lowered to per-field ASSIGNMENTS. Those
 * are statements, and a declaration outside a function body has no statement
 * position to emit them into.
 *
 * Error codes:
 * - E0508: a C++ class with a constructor is initialized where no statement
 *   can follow the declaration
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface ICppClassInitializerError extends IBaseAnalysisError {}

export default ICppClassInitializerError;
