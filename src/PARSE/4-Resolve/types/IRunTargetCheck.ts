import type ITranspileError from "../../../types/ITranspileError";

/**
 * What `ProgramChecks.runTarget` reports: the run's target when it resolved,
 * and the errors that stop the run when it did not. Both empty is a parse-only
 * run with no target, which ADR-049 allows.
 */
interface IRunTargetCheck {
  readonly target: { readonly name: string; readonly source: string } | null;
  readonly errors: readonly ITranspileError[];
}

export default IRunTargetCheck;
