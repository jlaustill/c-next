/**
 * ADR-016 scope access.
 *
 * Error codes:
 * - E0435: a scope's own member referenced through the scope's name
 * - E0436: a private member reached from outside its scope
 * - E0437: a global enum or register shadowed inside a scope, reached bare
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IScopeAccessError extends IBaseAnalysisError {}

export default IScopeAccessError;
