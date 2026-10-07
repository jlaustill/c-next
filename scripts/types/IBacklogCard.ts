/** One card in the column being ordered, as the board currently holds it. */
interface IBacklogCard {
  /** Issue or PR number. */
  number: number;

  /** Project item id: what `updateProjectV2ItemPosition` addresses. */
  itemId: string;

  /**
   * Every issue GitHub's built-in "Blocked by" relationship names for this
   * card, open or closed (#1893). Empty for a pull request, which has none.
   */
  blockedBy: number[];

  /** Issue title. Reporting only; nothing keys on it. */
  title: string;
}

export default IBacklogCard;
