/**
 * Issue #1219: Per-cell obligation, following the eslint model.
 *
 * `off` is not merely "unset" -- it is the recorded claim that the cell cannot
 * exist for this feature (a division cannot appear in a file-scope
 * initializer). That makes an exemption a reviewable statement in the ADR
 * rather than an unwritten assumption.
 *
 * Undeclared cells default to `off`, so adding the tool blocks nothing until a
 * cell is deliberately opted in.
 */
type TMatrixSeverity = "off" | "warn" | "error";

export default TMatrixSeverity;
