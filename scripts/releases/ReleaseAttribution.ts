/**
 * Issue #1388: which release an item shipped in, derived rather than recorded.
 *
 * Take the merge commit that closed the item and ask which release window first
 * contains it. That is a fact about the repository, so it cannot drift the way a
 * hand-set milestone does -- #1157 carried `v0.3.1` while its fix `9a5e87f9` was
 * already an ancestor of the `v0.3.0` tag, having closed one second after the
 * tag commit.
 *
 * Every decision lives here and the entry point only performs I/O and prints,
 * following `DiagnosticManifest`: ordering between "this is a write" and "this
 * is a referral" is then reachable from a test.
 *
 * What this deliberately does NOT do is guess. Two heuristics were measured for
 * the 58 of 412 closed issues with no linked commit, and both are unsafe alone:
 * `closedAt` against tag dates agreed with the authoritative answer 351/354
 * times, but only on issues closed *by* a merge, where the two coincide by
 * construction; `git log --grep` agreed 30/40, because a commit mentions an
 * issue before it fixes one. They fail in opposite directions, so those items
 * are referred to a human instead.
 */

import type IReleaseAssignment from "../types/IReleaseAssignment";
import type IReleaseItem from "../types/IReleaseItem";
import type IReleasePlan from "../types/IReleasePlan";
import type IReleaseWindow from "../types/IReleaseWindow";
import type TAttributionReason from "../types/TAttributionReason";

class ReleaseAttribution {
  /**
   * Commit SHA to the milestone that first shipped it.
   *
   * First window wins. `git rev-list <prev>..<tag>` already partitions history,
   * so a repeat means two tags on one commit or a tag off the mainline; the
   * earlier release is the truthful answer in both cases.
   */
  static index(windows: readonly IReleaseWindow[]): Map<string, string> {
    const index = new Map<string, string>();
    for (const window of windows) {
      for (const sha of window.commits) {
        if (!index.has(sha)) {
          index.set(sha, window.milestone);
        }
      }
    }
    return index;
  }

  /**
   * Whether this script's answer is authoritative enough to write.
   *
   * The single place that consequence is decided. `not-shipped` and
   * `underivable` both derive `null`, but writing that null would erase a
   * human's answer to replace it with an absence of one.
   */
  static owns(reason: TAttributionReason): boolean {
    return reason === "shipped" || reason === "not-planned";
  }

  /** The release one item shipped in, and how that was decided. */
  static attribute(
    item: IReleaseItem,
    index: ReadonlyMap<string, string>,
  ): IReleaseAssignment {
    const base = {
      number: item.number,
      kind: item.kind,
      current: item.milestone,
    };

    // Order matters: `not_planned` outranks a merge commit, because an item can
    // be closed as not-planned after a partial fix landed. Nothing shipped for
    // it, so no release names it.
    if (item.notPlanned) {
      return { ...base, derived: null, reason: "not-planned" };
    }

    for (const sha of item.candidateShas) {
      const milestone = index.get(sha);
      if (milestone !== undefined) {
        return { ...base, derived: milestone, reason: "shipped" };
      }
    }

    const reason: TAttributionReason =
      item.candidateShas.length > 0 ? "not-shipped" : "underivable";
    return { ...base, derived: null, reason };
  }

  /** Sorts every item into a write, a settled answer, or a referral. */
  static plan(
    items: readonly IReleaseItem[],
    windows: readonly IReleaseWindow[],
  ): IReleasePlan {
    const index = ReleaseAttribution.index(windows);
    const changes: IReleaseAssignment[] = [];
    const settled: IReleaseAssignment[] = [];
    const referrals: IReleaseAssignment[] = [];

    for (const item of items) {
      const assignment = ReleaseAttribution.attribute(item, index);
      if (!ReleaseAttribution.owns(assignment.reason)) {
        referrals.push(assignment);
      } else if (assignment.derived === assignment.current) {
        settled.push(assignment);
      } else {
        changes.push(assignment);
      }
    }

    const byNumber = (a: IReleaseAssignment, b: IReleaseAssignment): number =>
      a.number - b.number;

    return {
      changes: changes.sort(byNumber),
      settled: settled.sort(byNumber),
      referrals: referrals.sort(byNumber),
      milestones: ReleaseAttribution.neededMilestones(changes, windows),
    };
  }

  /** Milestone titles the changes need, in release order rather than by item. */
  private static neededMilestones(
    changes: readonly IReleaseAssignment[],
    windows: readonly IReleaseWindow[],
  ): string[] {
    const needed = new Set(
      changes
        .map((change) => change.derived)
        .filter((title): title is string => title !== null),
    );
    return windows
      .map((window) => window.milestone)
      .filter((title) => needed.has(title));
  }
}

export default ReleaseAttribution;
