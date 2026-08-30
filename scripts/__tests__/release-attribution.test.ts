import { describe, expect, it } from "vitest";

import ReleaseAttribution from "../releases/ReleaseAttribution";
import type IReleaseItem from "../types/IReleaseItem";
import type IReleaseWindow from "../types/IReleaseWindow";

/**
 * Three releases and the work in flight after the last tag. The unreleased
 * window carries the name of the release being prepared, which is why
 * `IReleaseWindow.milestone` is a plain string rather than a tag.
 */
const WINDOWS: readonly IReleaseWindow[] = [
  { milestone: "v0.2.18", commits: ["aaa1", "aaa2"] },
  { milestone: "v0.3.0", commits: ["bbb1", "bbb2"] },
  { milestone: "v0.3.1", commits: ["ccc1", "ccc2"] },
];

const item = (overrides: Partial<IReleaseItem> = {}): IReleaseItem => ({
  number: 1,
  kind: "issue",
  milestone: null,
  notPlanned: false,
  candidateShas: [],
  ...overrides,
});

describe("ReleaseAttribution.index", () => {
  it("maps every commit in a window to that window's milestone", () => {
    const index = ReleaseAttribution.index(WINDOWS);
    expect(index.get("aaa1")).toBe("v0.2.18");
    expect(index.get("ccc2")).toBe("v0.3.1");
  });

  it("gives a commit claimed twice to the earlier release", () => {
    // Two tags on one commit, or a tag off the mainline. `git rev-list`
    // partitions history so this is rare, but the earlier release is the
    // truthful answer when it happens: the commit was already shipping.
    const index = ReleaseAttribution.index([
      { milestone: "v0.2.18", commits: ["shared"] },
      { milestone: "v0.3.0", commits: ["shared"] },
    ]);
    expect(index.get("shared")).toBe("v0.2.18");
  });

  it("returns an empty index for no windows", () => {
    expect(ReleaseAttribution.index([]).size).toBe(0);
  });
});

describe("ReleaseAttribution.owns", () => {
  it("owns an answer derived from a commit or from not-planned", () => {
    expect(ReleaseAttribution.owns("shipped")).toBe(true);
    expect(ReleaseAttribution.owns("not-planned")).toBe(true);
  });

  it("does not own an answer it could not derive", () => {
    // Both derive `null`, and writing that null would replace a human's answer
    // with an absence of one.
    expect(ReleaseAttribution.owns("not-shipped")).toBe(false);
    expect(ReleaseAttribution.owns("underivable")).toBe(false);
  });
});

describe("ReleaseAttribution.attribute", () => {
  const index = ReleaseAttribution.index(WINDOWS);

  it("names the release whose window contains the closing commit", () => {
    expect(
      ReleaseAttribution.attribute(item({ candidateShas: ["bbb2"] }), index),
    ).toMatchObject({ derived: "v0.3.0", reason: "shipped" });
  });

  it("falls through to a later candidate when the first is unknown", () => {
    // The second candidate is the commit reached through
    // `closedByPullRequestsReferences`, which recovers an issue closed by hand
    // while still linked to its pull request -- #1356 is one of 11.
    expect(
      ReleaseAttribution.attribute(
        item({ candidateShas: ["unknown", "ccc1"] }),
        index,
      ),
    ).toMatchObject({ derived: "v0.3.1", reason: "shipped" });
  });

  it("prefers the earlier candidate when both are known", () => {
    expect(
      ReleaseAttribution.attribute(
        item({ candidateShas: ["bbb1", "ccc1"] }),
        index,
      ),
    ).toMatchObject({ derived: "v0.3.0" });
  });

  it("gives a not-planned item no release even when a fix landed", () => {
    // The negative control for the rule above: an item can be closed
    // not-planned after partial work merged. Nothing shipped for it, so no
    // release names it -- #1347 carried `v0.3.1` and should carry nothing.
    expect(
      ReleaseAttribution.attribute(
        item({ notPlanned: true, candidateShas: ["bbb1"] }),
        index,
      ),
    ).toMatchObject({ derived: null, reason: "not-planned" });
  });

  it("reports not-shipped when the merge commit is on no release", () => {
    // #1276 and #1284 are `MERGED` on GitHub but merged into
    // `fix/1205-struct-init-header-prototype`, which never landed. GitHub's
    // own `state: MERGED` conflates merged with shipped.
    expect(
      ReleaseAttribution.attribute(item({ candidateShas: ["orphan"] }), index),
    ).toMatchObject({ derived: null, reason: "not-shipped" });
  });

  it("reports underivable when nothing links the item to a commit", () => {
    expect(ReleaseAttribution.attribute(item(), index)).toMatchObject({
      derived: null,
      reason: "underivable",
    });
  });

  it("carries the item's identity and current claim through unchanged", () => {
    expect(
      ReleaseAttribution.attribute(
        item({
          number: 1157,
          kind: "issue",
          milestone: "v0.3.1",
          candidateShas: ["bbb1"],
        }),
        index,
      ),
    ).toEqual({
      number: 1157,
      kind: "issue",
      current: "v0.3.1",
      derived: "v0.3.0",
      reason: "shipped",
    });
  });
});

describe("ReleaseAttribution.plan", () => {
  it("separates a write from an answer already correct", () => {
    const plan = ReleaseAttribution.plan(
      [
        item({ number: 1157, milestone: "v0.3.1", candidateShas: ["bbb1"] }),
        item({ number: 1314, milestone: "v0.3.1", candidateShas: ["ccc1"] }),
      ],
      WINDOWS,
    );
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]).toMatchObject({ number: 1157, derived: "v0.3.0" });
    expect(plan.settled).toHaveLength(1);
    expect(plan.settled[0]).toMatchObject({ number: 1314 });
    expect(plan.referrals).toHaveLength(0);
  });

  it("plans clearing the milestone of a not-planned item", () => {
    const plan = ReleaseAttribution.plan(
      [item({ number: 1347, milestone: "v0.3.1", notPlanned: true })],
      WINDOWS,
    );
    expect(plan.changes[0]).toMatchObject({ number: 1347, derived: null });
  });

  it("leaves a not-planned item alone when it already claims nothing", () => {
    // #1238 is not-planned with no milestone, and must not become a write.
    const plan = ReleaseAttribution.plan(
      [item({ number: 1238, milestone: null, notPlanned: true })],
      WINDOWS,
    );
    expect(plan.changes).toHaveLength(0);
    expect(plan.settled).toHaveLength(1);
  });

  it("never writes over a human's answer it cannot derive", () => {
    const plan = ReleaseAttribution.plan(
      [
        item({ number: 1276, milestone: "v0.3.1", candidateShas: ["orphan"] }),
        item({ number: 916, milestone: "v0.2.7" }),
      ],
      WINDOWS,
    );
    expect(plan.changes).toHaveLength(0);
    expect(plan.referrals.map((r) => r.number)).toEqual([916, 1276]);
  });

  it("lists needed milestones in release order, not item order", () => {
    // A report ordered by item number would read v0.3.1 before v0.2.18 here,
    // and the entry point creates milestones in this order.
    const plan = ReleaseAttribution.plan(
      [
        item({ number: 10, candidateShas: ["ccc1"] }),
        item({ number: 20, candidateShas: ["aaa1"] }),
      ],
      WINDOWS,
    );
    expect(plan.milestones).toEqual(["v0.2.18", "v0.3.1"]);
  });

  it("omits a milestone no change needs", () => {
    const plan = ReleaseAttribution.plan(
      [item({ number: 10, candidateShas: ["bbb1"] })],
      WINDOWS,
    );
    expect(plan.milestones).toEqual(["v0.3.0"]);
  });

  it("sorts each bucket by item number", () => {
    const plan = ReleaseAttribution.plan(
      [
        item({ number: 30, candidateShas: ["aaa1"] }),
        item({ number: 10, candidateShas: ["bbb1"] }),
        item({ number: 20, candidateShas: ["ccc1"] }),
      ],
      WINDOWS,
    );
    expect(plan.changes.map((c) => c.number)).toEqual([10, 20, 30]);
  });
});

describe("ReleaseAttribution.describe", () => {
  const assignment = (over = {}) => ({
    number: 1157,
    kind: "issue" as const,
    current: "v0.3.1",
    derived: "v0.3.0",
    reason: "shipped" as const,
    ...over,
  });

  it("names both sides of the move and how it was decided", () => {
    expect(ReleaseAttribution.describe(assignment())).toBe(
      "#1157 issue: v0.3.1 -> v0.3.0 [shipped]",
    );
  });

  it("spells an absent current milestone rather than leaving a gap", () => {
    expect(ReleaseAttribution.describe(assignment({ current: null }))).toBe(
      "#1157 issue: (none) -> v0.3.0 [shipped]",
    );
  });

  it("spells an absent derived milestone, so a clear reads as a clear", () => {
    // #1347: closed not_planned while carrying v0.3.1. "-> (none)" is the
    // whole content of that line; an empty right-hand side would read as a
    // formatting bug rather than a milestone being removed.
    expect(
      ReleaseAttribution.describe(
        assignment({ number: 1347, derived: null, reason: "not-planned" }),
      ),
    ).toBe("#1347 issue: v0.3.1 -> (none) [not-planned]");
  });

  it("distinguishes a pull request from an issue", () => {
    expect(
      ReleaseAttribution.describe(
        assignment({
          number: 1276,
          kind: "pull request",
          derived: null,
          reason: "not-shipped",
        }),
      ),
    ).toBe("#1276 pull request: v0.3.1 -> (none) [not-shipped]");
  });
});
