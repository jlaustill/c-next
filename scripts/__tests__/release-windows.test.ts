import { describe, expect, it } from "vitest";

import ReleaseWindows from "../releases/ReleaseWindows";

describe("ReleaseWindows.releaseTags", () => {
  it("keeps only vMAJOR.MINOR.PATCH tags, in the order given", () => {
    expect(
      ReleaseWindows.releaseTags([
        "v0.2.18",
        "v1-test-coverage",
        "v0.3.0",
        "nightly",
        "v0.3",
      ]),
    ).toEqual(["v0.2.18", "v0.3.0"]);
  });

  it("preserves creation order rather than re-sorting by version", () => {
    // The question is which release first *contained* a commit, which is a fact
    // about when releases happened. A late hotfix on an old minor sorts before
    // releases that shipped long after it if you sort by name.
    expect(ReleaseWindows.releaseTags(["v0.3.0", "v0.1.72"])).toEqual([
      "v0.3.0",
      "v0.1.72",
    ]);
  });
});

describe("ReleaseWindows.build", () => {
  const ranges = (): {
    calls: string[];
    commitsIn: (r: string) => string[];
  } => {
    const calls: string[] = [];
    return {
      calls,
      commitsIn: (range: string) => {
        calls.push(range);
        return [`sha-of-${range}`];
      },
    };
  };

  it("asks for every commit reachable from the first release, not a range", () => {
    const { calls, commitsIn } = ranges();
    ReleaseWindows.build(["v0.1.0", "v0.1.1"], null, commitsIn);
    expect(calls).toEqual(["v0.1.0", "v0.1.0..v0.1.1"]);
  });

  it("gives each later release the range since its predecessor", () => {
    const { calls, commitsIn } = ranges();
    ReleaseWindows.build(["v0.1.0", "v0.1.1", "v0.2.0"], null, commitsIn);
    expect(calls.at(-1)).toBe("v0.1.1..v0.2.0");
  });

  it("appends the unreleased window under the prepared release's name", () => {
    const { calls, commitsIn } = ranges();
    const windows = ReleaseWindows.build(
      ["v0.3.0"],
      { milestone: "v0.3.1", head: "origin/main" },
      commitsIn,
    );
    expect(calls.at(-1)).toBe("v0.3.0..origin/main");
    expect(windows.at(-1)).toEqual({
      milestone: "v0.3.1",
      commits: ["sha-of-v0.3.0..origin/main"],
    });
  });

  it("omits the unreleased window when no release is being prepared", () => {
    const { commitsIn } = ranges();
    const windows = ReleaseWindows.build(["v0.3.0"], null, commitsIn);
    expect(windows.map((w) => w.milestone)).toEqual(["v0.3.0"]);
  });

  it("uses head alone when there is no tag to measure from", () => {
    const { calls, commitsIn } = ranges();
    ReleaseWindows.build([], { milestone: "v0.1.0", head: "main" }, commitsIn);
    expect(calls).toEqual(["main"]);
  });

  it("ignores a non-release tag when choosing the previous release", () => {
    const { calls, commitsIn } = ranges();
    ReleaseWindows.build(["v0.1.0", "nightly", "v0.1.1"], null, commitsIn);
    expect(calls).toEqual(["v0.1.0", "v0.1.0..v0.1.1"]);
  });
});

describe("ReleaseWindows.preparing", () => {
  it("names the open milestone that is not yet a tag", () => {
    expect(ReleaseWindows.preparing(["v0.3.1"], ["v0.2.18", "v0.3.0"])).toBe(
      "v0.3.1",
    );
  });

  it("ignores an open milestone whose release already shipped", () => {
    // A milestone stays open until someone closes it, so a shipped release can
    // still be open. Treating it as the one in preparation would attribute
    // every in-flight merge to a release that is already out.
    expect(ReleaseWindows.preparing(["v0.3.0"], ["v0.3.0"])).toBeNull();
  });

  it("ignores an open milestone that does not name a release", () => {
    // `v1 Test Coverage Complete` is one of these -- WORKFLOW.md says
    // milestones name releases and nothing else, but the repository has one.
    expect(
      ReleaseWindows.preparing(["v1 Test Coverage Complete"], ["v0.3.0"]),
    ).toBeNull();
  });

  it("returns null when nothing is being prepared", () => {
    expect(ReleaseWindows.preparing([], ["v0.3.0"])).toBeNull();
  });

  it("refuses two candidates rather than choosing by sort order", () => {
    // The run writes milestones, so a guess here is a guess written across the
    // backlog.
    expect(() =>
      ReleaseWindows.preparing(["v0.3.1", "v0.4.0"], ["v0.3.0"]),
    ).toThrow(/Ambiguous release in preparation: v0\.3\.1, v0\.4\.0/);
  });
});
