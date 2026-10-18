/** One issue or pull request card on a project board, as the board holds it. */
interface IBoardItem {
  /** Project item id: what a Status write or a reposition addresses. */
  itemId: string;

  /**
   * Node id of the issue or pull request. The identity of a card across
   * boards: issue numbers repeat between repositories, so a number is not one.
   */
  contentId: string;

  /** The card's Status option name, or undefined when none is set. */
  status: string | undefined;

  /** `owner/name` of the repository the issue or pull request belongs to. */
  repository: string;

  /** Issue or PR number within that repository. Reporting only. */
  number: number;
}

export default IBoardItem;
