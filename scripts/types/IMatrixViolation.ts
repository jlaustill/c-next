import TMatrixSeverity from "./TMatrixSeverity";

/**
 * Issue #1219: a cell an ADR declared an obligation for that no fixture occupies.
 */
interface IMatrixViolation {
  readonly adr: string;
  readonly context: string;
  readonly relationship: string;
  /** Always `warn` or `error`; an `off` cell cannot be violated. */
  readonly severity: TMatrixSeverity;
}

export default IMatrixViolation;
