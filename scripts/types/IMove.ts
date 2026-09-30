/**
 * One entry of `scripts/move-modules/MOVES.ts`: a directory or file that moves,
 * with the reason it belongs where it goes.
 */
interface IMove {
  /** Path relative to the repository root. A directory moves with its tree. */
  readonly from: string;
  readonly to: string;
  /** Why this destination, in the terms the admission rule uses. */
  readonly because: string;
}

export default IMove;
