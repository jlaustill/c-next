import type IBoardItem from "./IBoardItem";
import type IStatusDrift from "./IStatusDrift";

/** Everything a migrated board still disagrees with its source about. */
interface IMigrationDiff {
  /** Source cards the target does not hold, in source order. */
  missing: IBoardItem[];

  /** Cards held by both whose Status differs. */
  statusDrift: IStatusDrift[];

  /** Repositions still needed to put the target's copies in source order. */
  outOfOrder: number;
}

export default IMigrationDiff;
