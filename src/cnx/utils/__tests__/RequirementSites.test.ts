/**
 * #1928: the one key-to-sites fold `PlannedRequirements`
 * and `RequirementAggregator.union` share (`record` too, until #1997).
 */
import { describe, it, expect } from "vitest";
import RequirementSites from "../RequirementSites";
import type IRequirementSite from "../../types/IRequirementSite";

describe("RequirementSites.accumulate", () => {
  const s: IRequirementSite = { sourcePath: "a.cnx", line: 4 };

  it("drops repeats in the first list for a key, not just later ones", () => {
    const into = new Map<string, IRequirementSite[]>();

    RequirementSites.accumulate(into, "k", [s, s]);

    expect(into.get("k")).toEqual([s]);
  });

  it("does not repeat a site a later list carries again", () => {
    const into = new Map<string, IRequirementSite[]>();

    RequirementSites.accumulate(into, "k", [s]);
    RequirementSites.accumulate(into, "k", [s, { ...s, line: 5 }]);

    expect(into.get("k")).toEqual([s, { ...s, line: 5 }]);
  });

  it("records a key that arrives with no sites", () => {
    const into = new Map<string, IRequirementSite[]>();

    RequirementSites.accumulate(into, "k", []);

    expect(into.get("k")).toEqual([]);
  });

  it("does not alias the caller's list", () => {
    const into = new Map<string, IRequirementSite[]>();
    const given = [s];

    RequirementSites.accumulate(into, "k", given);
    given.push({ ...s, line: 9 });

    expect(into.get("k")).toEqual([s]);
  });
});
