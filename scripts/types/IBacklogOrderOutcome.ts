import type IBacklogCard from "./IBacklogCard";

/** What ordering the column by its `Blocked by` edges produced. */
interface IBacklogOrderOutcome {
  /** Every card, in the order the column should read. Top first. */
  order: IBacklogCard[];

  /** The subset whose position changes, in `order`. Empty means no writes. */
  moved: IBacklogCard[];

  /**
   * Blocker/blocked pairs where BOTH cards are in the column, so the order
   * is constrained by them. A blocker that is closed, or sitting in another
   * column, cannot be positioned relative to these and is not counted.
   */
  constraints: number;
}

export default IBacklogOrderOutcome;
