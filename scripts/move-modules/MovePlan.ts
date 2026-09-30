import IMove from "../types/IMove";

/**
 * What the move manifest still asks for, read as a sequence rather than as
 * independent entries (#1653, #1826 review).
 *
 * The manifest is a history: it records every move, and a later move can take
 * a file on from where an earlier one left it. A chain (A -> B, then B -> C)
 * and a cycle (A -> B, then B -> A) both have an entry whose `to` is not where
 * the file ends up. Read alone, the cycle's first entry looks pending as soon as
 * the file is back at A, so `--apply` undid the second move. Supersession is the
 * fact that decides it, and it lives here once.
 */
class MovePlan {
  /** Indexes of entries a later entry moves on from. */
  static superseded(moves: readonly IMove[]): Set<number> {
    const superseded = new Set<number>();
    moves.forEach((move, index) => {
      if (moves.slice(index + 1).some((later) => later.from === move.to)) {
        superseded.add(index);
      }
    });
    return superseded;
  }

  /** The entries still to perform: final ones whose source is still there. */
  static pending(
    moves: readonly IMove[],
    exists: (path: string) => boolean,
  ): IMove[] {
    const superseded = MovePlan.superseded(moves);
    return moves.filter(
      (move, index) => !superseded.has(index) && exists(move.from),
    );
  }

  /**
   * Paths nothing should import any more: every `from`, less the places files
   * finally land. In a cycle the first `from` is a final place again; in a chain
   * every `from` is stale.
   */
  static stalePaths(moves: readonly IMove[]): Set<string> {
    const superseded = MovePlan.superseded(moves);
    const finals = new Set(
      moves.filter((_, index) => !superseded.has(index)).map((move) => move.to),
    );
    return new Set(
      moves.map((move) => move.from).filter((path) => !finals.has(path)),
    );
  }
}

export default MovePlan;
