/**
 * Issue #1388: GitHub's answer about a closed item, reduced to what attribution
 * needs.
 *
 * The node shapes are declared locally rather than in `scripts/types/`: they
 * describe one GraphQL response, not a concept the rest of the repository
 * shares, and exporting them would make a response shape look like a contract.
 *
 * Candidate order is the point of this file. `ClosedEvent.closer` is the direct
 * answer; `closedByPullRequestsReferences` is the fallback that recovers an
 * issue closed by hand while still linked to its pull request -- 11 of the 412
 * closed issues in this repository, #1356 among them.
 */

import type IReleaseItem from "../types/IReleaseItem";

interface ICommitRef {
  readonly oid?: string | null;
}

interface IIssueNode {
  readonly number: number;
  readonly stateReason?: string | null;
  readonly milestone?: { readonly title: string } | null;
  readonly timelineItems?: {
    readonly nodes?: readonly ({
      readonly closer?:
        | ({ readonly mergeCommit?: ICommitRef | null } & ICommitRef)
        | null;
    } | null)[];
  } | null;
  readonly closedByPullRequestsReferences?: {
    readonly nodes?: readonly ({
      readonly state?: string | null;
      readonly mergeCommit?: ICommitRef | null;
    } | null)[];
  } | null;
}

interface IPullRequestNode {
  readonly number: number;
  readonly milestone?: { readonly title: string } | null;
  readonly mergeCommit?: ICommitRef | null;
}

class ReleaseItems {
  /** Drops empties so `candidateShas` never carries a hole to look up. */
  private static compact(
    shas: readonly (string | null | undefined)[],
  ): string[] {
    return shas.filter(
      (sha): sha is string => typeof sha === "string" && sha !== "",
    );
  }

  static fromIssueNodes(nodes: readonly IIssueNode[]): IReleaseItem[] {
    return nodes.map((node) => {
      // The last close is the one that stuck; an issue reopened and closed
      // again carries several.
      const events = node.timelineItems?.nodes ?? [];
      const closer = events.at(-1)?.closer;
      const linked = (node.closedByPullRequestsReferences?.nodes ?? [])
        .filter((pr) => pr?.state === "MERGED")
        .map((pr) => pr?.mergeCommit?.oid);

      return {
        number: node.number,
        kind: "issue" as const,
        milestone: node.milestone?.title ?? null,
        notPlanned: node.stateReason === "NOT_PLANNED",
        candidateShas: ReleaseItems.compact([
          closer?.mergeCommit?.oid ?? closer?.oid,
          ...linked,
        ]),
      };
    });
  }

  static fromPullRequestNodes(
    nodes: readonly IPullRequestNode[],
  ): IReleaseItem[] {
    return nodes.map((node) => ({
      number: node.number,
      kind: "pull request" as const,
      milestone: node.milestone?.title ?? null,
      // A merged pull request shipped something by definition; only issues
      // carry `not_planned`.
      notPlanned: false,
      candidateShas: ReleaseItems.compact([node.mergeCommit?.oid]),
    }));
  }
}

export default ReleaseItems;
