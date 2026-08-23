import type IFileResult from "../transpiler/types/IFileResult";
import type IRecordedRequirement from "../transpiler/types/IRecordedRequirement";
import type IRequirementSite from "../transpiler/types/IRequirementSite";
import type TRequirementKey from "../transpiler/types/TRequirementKey";
import RequirementSites from "./RequirementSites";

/**
 * Issue #1143: Fold per-file toolchain requirements into a project-level view.
 *
 * A static matrix can only say what C-Next *might* need. Merging what each file
 * actually recorded is what lets the transpiler answer the question a user
 * choosing a toolchain is really asking: what does *this* project need?
 */
class RequirementAggregator {
  /** Union file requirements by key, concatenating their source sites. */
  static merge(files: readonly IFileResult[]): readonly IRecordedRequirement[] {
    const merged = new Map<TRequirementKey, IRequirementSite[]>();

    for (const file of files) {
      for (const entry of file.requirements ?? []) {
        const sites = merged.get(entry.key);
        if (sites === undefined) {
          merged.set(entry.key, [...entry.sites]);
          continue;
        }
        for (const site of entry.sites) {
          RequirementSites.addUnique(sites, site);
        }
      }
    }

    return Array.from(merged.entries()).map(([key, sites]) => ({
      key,
      sites: RequirementAggregator.sortSites(sites),
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
