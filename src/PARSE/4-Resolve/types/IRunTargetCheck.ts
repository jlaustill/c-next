import type ITranspileError from "../../../types/ITranspileError";

/**
 * What `ProgramChecks.runTarget` reports: the run's target when it resolved,
 * the errors to report when it did not, and whether the run goes on. A
 * parse-only run with no target goes on with neither (ADR-049).
 */
interface IRunTargetCheck {
  /**
   * Whether the run continues. Decided here, from the target's kind, rather
   * than inferred by the host from `errors` being empty: a `rejected` target
   * stops the run whatever errors it carries (#1922 review).
   */
  readonly proceed: boolean;
  readonly target: { readonly name: string; readonly source: string } | null;
  readonly errors: readonly ITranspileError[];
}

export default IRunTargetCheck;
