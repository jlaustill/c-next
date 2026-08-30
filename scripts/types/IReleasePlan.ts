import type IReleaseAssignment from "./IReleaseAssignment";

/**
 * Every item sorted into what the run should do about it.
 *
 * Returned as data rather than acted on, following `IManifestOutcome`: the
 * ordering between "this is a write" and "this is a referral" is then reachable
 * from a test instead of living inside a CLI entry point.
 */
interface IReleasePlan {
  /** Writes to make: the item's milestone disagrees with an owned answer. */
  readonly changes: readonly IReleaseAssignment[];
  /** Owned answers the item already carries. */
  readonly settled: readonly IReleaseAssignment[];
  /** Not owned. Reported for a human, never written. */
  readonly referrals: readonly IReleaseAssignment[];
  /** Milestone titles `changes` needs to exist, in release order. */
  readonly milestones: readonly string[];
}

export default IReleasePlan;
