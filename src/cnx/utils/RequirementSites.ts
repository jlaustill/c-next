import type IRequirementSite from "../types/IRequirementSite";

/**
 * Issue #1143: Identity and accumulation for requirement source sites.
 *
 * "Is this the same site?" was written out three times -- in
 * `CodeGenState.requireToolchain`, in `CodeGenState.noteDeferredSite` (now
 * `ToolchainRequirements.record` and `.noteDeferredSite`, #1452; `record` was
 * deleted by #1997), and in
 * `RequirementAggregator.merge` (now `.union`, #1928). Adding a column to
 * `IRequirementSite`, or deciding that an unlocated site should merge with a
 * located one, would have been three edits that must agree. jscpd cannot see
 * it: each copy is four lines.
 *
 * The key-to-sites fold around it was three copies too, and they shared a
 * quirk: the first list seen for a key went in without dedup, so the result
 * depended on list order. All three now call `accumulate` (#1928).
 */
class RequirementSites {
  /** Two sites are the same when they name the same place. */
  static same(left: IRequirementSite, right: IRequirementSite): boolean {
    return left.sourcePath === right.sourcePath && left.line === right.line;
  }

  /**
   * Add `sites` under `key`, skipping any already there -- the first list for
   * a key included. A key with no sites is still recorded. Mutates `into`.
   */
  static accumulate<K>(
    into: Map<K, IRequirementSite[]>,
    key: K,
    sites: readonly IRequirementSite[],
  ): void {
    let existing = into.get(key);
    if (existing === undefined) {
      existing = [];
      into.set(key, existing);
    }
    for (const site of sites) {
      RequirementSites.addUnique(existing, site);
    }
  }

  /** Append `site` unless an equal one is already present. Mutates `sites`. */
  private static addUnique(
    sites: IRequirementSite[],
    site: IRequirementSite,
  ): void {
    if (sites.some((seen) => RequirementSites.same(seen, site))) return;
    sites.push(site);
  }
}

export default RequirementSites;
