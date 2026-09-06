/**
 * ADR-025 switch statements.
 *
 * Error codes:
 * - E0711: switch on a `bool` (MISRA C:2012 Rule 16.7)
 * - E0712: fewer than two clauses (MISRA C:2012 Rule 16.6)
 * - E0713: duplicate case value
 * - E0714: the clauses do not cover the enum's variants exactly
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface ISwitchStatementError extends IBaseAnalysisError {}

export default ISwitchStatementError;
