import type IBoardItem from "./IBoardItem";

/** One card whose Status on the target board differs from the source board's. */
interface IStatusDrift {
  /** The card on the target board: the one a Status write addresses. */
  item: IBoardItem;

  /** Its Status on the target board now. */
  from: string | undefined;

  /** Its Status on the source board: what it must become. */
  to: string;
}

export default IStatusDrift;
