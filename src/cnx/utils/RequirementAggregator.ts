import type IFileResult from "../types/IFileResult";
import type IRecordedRequirement from "../types/IRecordedRequirement";
import type IRequirementSite from "../types/IRequirementSite";
import type TRequirementKey from "../types/TRequirementKey";
import RequirementSites from "./RequirementSites";

/**
 * Issue #1143: Fold per-file toolchain requirements into a project-level view.
 *
 * A static matrix can only say what cnx *might* need. Merging what each file
 * actually recorded is what lets the transpiler answer the question a user
 * choosing a toolchain is really asking: what does *this* project need?
 */
class RequirementAggregator {
  /** Union file requirements by key, concatenating their source sites. */
  static merge(files: readonly IFileResult[]): readonly IRecordedRequirement[] {
    return RequirementAggregator.union(
      files.map((file) => file.requirements ?? []),
    ).map((entry) => ({
      key: entry.key,
      sites: RequirementAggregator.sortSites(entry.sites),
    }));
  }

  /**
   * Union requirement lists by key, keeping every distinct site in the order
   * first seen. Feeds `merge` only: one file's list is a view of its emission
   * plan (#1997), which has one entry per key already.
   */
  static union(
    lists: readonly (readonly IRecordedRequirement[])[],
  ): readonly IRecordedRequirement[] {
    const merged = new Map<TRequirementKey, IRequirementSite[]>();

    for (const list of lists) {
      for (const entry of list) {
        RequirementSites.accumulate(merged, entry.key, entry.sites);
      }
    }

    return Array.from(merged.entries()).map(([key, sites]) => ({
      key,
      sites,
    }));
  }

  /** Stable site ordering, so reports and snapshots do not churn. */
  private static sortSites(
    sites: readonly IRequirementSite[],
  ): readonly IRequirementSite[] {
    return sites.slice().sort((left, right) => {
      const byPath = left.sourcePath.localeCompare(right.sourcePath);
      if (byPath !== 0) return byPath;
      return (left.line ?? 0) - (right.line ?? 0);
    });
  }
}

export default RequirementAggregator;
