/**
 * Issue #1219: which matrix cells one ADR's fixtures actually occupy.
 */
interface IMatrixOccupancy {
  /** Zero-padded ADR number. */
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
}

export default IMatrixOccupancy;
