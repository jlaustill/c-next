/** One reposition: place `itemId` directly below `afterId`. */
interface IBacklogMove {
  /** Project item id of the card being moved. */
  itemId: string;

  /** Project item id of the card it must end up directly below. */
  afterId: string;

  /** Issue number of the moved card. Reporting only. */
  number: number;
}

export default IBacklogMove;
