import type IRequirementSite from "../transpiler/types/IRequirementSite";

/**
 * Issue #1143: Identity and accumulation for requirement source sites.
 *
 * "Is this the same site?" was written out three times -- in
 * `CodeGenState.requireToolchain`, in `CodeGenState.noteDeferredSite`, and in
 * `RequirementAggregator.merge`. Adding a column to `IRequirementSite`, or
 * deciding that an unlocated site should merge with a located one, would have
 * been three edits that must agree. jscpd cannot see it: each copy is four
 * lines.
 */
class RequirementSites {
  /** Two sites are the same when they name the same place. */
  static same(left: IRequirementSite, right: IRequirementSite): boolean {
    return left.sourcePath === right.sourcePath && left.line === right.line;
  }

  /** Append `site` unless an equal one is already present. Mutates `sites`. */
  static addUnique(sites: IRequirementSite[], site: IRequirementSite): void {
    if (sites.some((seen) => RequirementSites.same(seen, site))) return;
    sites.push(site);
  }
}

export default RequirementSites;
