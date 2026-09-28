/**
 * A bit range's width, as a bit writer takes it: the C for it, and its value
 * when it folds to a constant. The writer renders the mask from the pair, so a
 * caller cannot hand it a width without saying whether it folds (#1096: a
 * runtime `(1U << W) - 1U` is undefined at full width, and two writers
 * skipped the fold).
 */
interface IBitWidth {
  /** The width as generated C */
  readonly text: string;
  /** Its value, when it is a constant */
  readonly folded: number | undefined;
}

export default IBitWidth;
