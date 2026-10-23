import TMatrixSeverity from "./TMatrixSeverity";

/**
 * Issue #1618: a position-table row its fixtures contradict -- declared
 * `warn` or `error` with no fixture there, or `off` with one.
 */
interface IPositionViolation {
  /** MatrixRule id of the code's table ("024 E0869"). */
  readonly id: string;
  /** A TMatrixPosition slug. */
  readonly position: string;
  readonly severity: TMatrixSeverity;
}

export default IPositionViolation;
