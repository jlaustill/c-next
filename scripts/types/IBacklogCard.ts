/** One card in the column being ordered, as the board currently holds it. */
interface IBacklogCard {
  /** Issue or PR number -- the form `Blocked by` names cards in. */
  number: number;

  /** Project item id: what `updateProjectV2ItemPosition` addresses. */
  itemId: string;

  /**
   * The raw `Blocked by` text, exactly as the field holds it.
   *
   * Free-form and append-only, so it is prose with references in it, not a
   * list. Read it through `BlockedByField`, never with a bare `#\d+` scan.
   */
  blockedBy: string;

  /** Issue title. Reporting only; nothing keys on it. */
  title: string;
}

export default IBacklogCard;
