import TMatrixSeverity from "./TMatrixSeverity";

/**
 * Issue #1219: the severities one ADR declares for its matrix.
 *
 * Sparse by design -- a cell absent from the table is `off`. Listing only the
 * cells that carry an obligation keeps the table short and makes opting a cell
 * in a visible, reviewable edit rather than a character changed in a grid of
 * twenty.
 */
interface IMatrixDeclaration {
  /** Zero-padded ADR number, e.g. "051". */
  readonly adr: string;

  /** Cell key (see MatrixCell.key) to declared severity. */
  readonly severities: ReadonlyMap<string, TMatrixSeverity>;

  /** Problems found while parsing. Non-empty means the table is not usable. */
  readonly errors: readonly string[];
}

export default IMatrixDeclaration;
