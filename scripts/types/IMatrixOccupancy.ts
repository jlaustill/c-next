/**
 * Issue #1219: which matrix cells one ADR's fixtures actually occupy.
 */
interface IMatrixOccupancy {
  /** MatrixRule id: the zero-padded ADR number, or it and a rule. */
  readonly adr: string;

  /** Cell key (MatrixCell.key) to the fixtures occupying it. */
  readonly cells: ReadonlyMap<string, readonly string[]>;

  /**
   * Fixtures linked to this ADR whose context could not be established.
   *
   * Tracked separately and never counted as occupancy. A fixture with no
   * diagnostic has no position to resolve, and a diagnostic reported at the
   * synthetic 1:0 (#1235) encloses no declaration. Folding these into a cell
   * would be the file-structure guess this tool exists to avoid.
   */
  readonly fixturesWithoutContext: readonly string[];

  /**
   * #1618: for a code's matrix, the positions (TMatrixPosition) its
   * diagnostics land in, to the fixtures landing them there.
   */
  readonly positions: ReadonlyMap<string, readonly string[]>;
}

export default IMatrixOccupancy;
