/**
 * A closed issue or merged pull request, as attribution sees it.
 *
 * `candidateShas` is ordered most-authoritative first. The closing event's own
 * commit comes before the one reached through `closedByPullRequestsReferences`,
 * which recovers an issue closed by hand while still linked to its pull request
 * -- 11 of the 412 closed issues in this repository (#1388).
 */
interface IReleaseItem {
  readonly number: number;
  readonly kind: "issue" | "pull request";
  readonly milestone: string | null;
  readonly notPlanned: boolean;
  readonly candidateShas: readonly string[];
}

export default IReleaseItem;
