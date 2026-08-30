import { describe, expect, it } from "vitest";

import ReleaseItems from "../releases/ReleaseItems";

const closedEvent = (closer: unknown): unknown => ({ closer });

describe("ReleaseItems.fromIssueNodes", () => {
  it("takes the merge commit of the pull request that closed the issue", () => {
    expect(
      ReleaseItems.fromIssueNodes([
        {
          number: 1314,
          stateReason: "COMPLETED",
          milestone: null,
          timelineItems: {
            nodes: [closedEvent({ mergeCommit: { oid: "cb5c696c" } })],
          },
        },
      ] as never),
    ).toEqual([
      {
        number: 1314,
        kind: "issue",
        milestone: null,
        notPlanned: false,
        candidateShas: ["cb5c696c"],
      },
    ]);
  });

  it("takes the commit itself when a commit closed the issue directly", () => {
    // 41 of this repository's closed issues were closed by a commit rather than
    // a pull request, so the closer has an `oid` and no `mergeCommit`.
    expect(
      ReleaseItems.fromIssueNodes([
        {
          number: 7,
          timelineItems: { nodes: [closedEvent({ oid: "deadbeef" })] },
        },
      ] as never)[0].candidateShas,
    ).toEqual(["deadbeef"]);
  });

  it("uses the last close, so a reopened issue is judged by the one that stuck", () => {
    expect(
      ReleaseItems.fromIssueNodes([
        {
          number: 9,
          timelineItems: {
            nodes: [
              closedEvent({ oid: "first" }),
              closedEvent({ oid: "second" }),
            ],
          },
        },
      ] as never)[0].candidateShas,
    ).toEqual(["second"]);
  });

  it("falls back to a linked merged pull request when the close has no closer", () => {
    // #1356 was closed by hand while linked to #1348. Without this fallback it
    // reads as underivable, which is the difference between 343 and 354.
    expect(
      ReleaseItems.fromIssueNodes([
        {
          number: 1356,
          timelineItems: { nodes: [closedEvent(null)] },
          closedByPullRequestsReferences: {
            nodes: [{ state: "MERGED", mergeCommit: { oid: "71fe06f4" } }],
          },
        },
      ] as never)[0].candidateShas,
    ).toEqual(["71fe06f4"]);
  });

  it("ignores a linked pull request that was closed without merging", () => {
    // The negative control: an abandoned pull request shipped nothing, so its
    // branch must never name a release.
    expect(
      ReleaseItems.fromIssueNodes([
        {
          number: 11,
          timelineItems: { nodes: [] },
          closedByPullRequestsReferences: {
            nodes: [{ state: "CLOSED", mergeCommit: { oid: "abandoned" } }],
          },
        },
      ] as never)[0].candidateShas,
    ).toEqual([]);
  });

  it("prefers the closer over a linked pull request", () => {
    expect(
      ReleaseItems.fromIssueNodes([
        {
          number: 12,
          timelineItems: { nodes: [closedEvent({ oid: "closer" })] },
          closedByPullRequestsReferences: {
            nodes: [{ state: "MERGED", mergeCommit: { oid: "linked" } }],
          },
        },
      ] as never)[0].candidateShas,
    ).toEqual(["closer", "linked"]);
  });

  it("marks a not-planned issue so no release can name it", () => {
    expect(
      ReleaseItems.fromIssueNodes([
        { number: 1238, stateReason: "NOT_PLANNED" },
      ] as never)[0],
    ).toMatchObject({ notPlanned: true, candidateShas: [] });
  });

  it("carries the milestone the issue currently claims", () => {
    expect(
      ReleaseItems.fromIssueNodes([
        { number: 1157, milestone: { title: "v0.3.1" } },
      ] as never)[0].milestone,
    ).toBe("v0.3.1");
  });
});

describe("ReleaseItems.fromPullRequestNodes", () => {
  it("takes the merge commit and never reports not-planned", () => {
    expect(
      ReleaseItems.fromPullRequestNodes([
        { number: 1199, milestone: null, mergeCommit: { oid: "5820a1ca" } },
      ] as never),
    ).toEqual([
      {
        number: 1199,
        kind: "pull request",
        milestone: null,
        notPlanned: false,
        candidateShas: ["5820a1ca"],
      },
    ]);
  });

  it("yields no candidate for a merged pull request with no merge commit", () => {
    expect(
      ReleaseItems.fromPullRequestNodes([{ number: 20 }] as never)[0]
        .candidateShas,
    ).toEqual([]);
  });
});
