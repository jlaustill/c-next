/**
 * One way the gate roster disagrees with what actually runs (issue #1526).
 *
 * `missing-from-gate` is the drift that motivated this check: CI gained
 * `headers:standalone:check` and `gate.sh` did not, so the roster read as
 * complete while being one short.
 */
interface IGateRosterViolation {
  kind:
    | "missing-from-gate"
    | "gate-only"
    | "roster-mismatch"
    | "count-mismatch"
    | "stale-exclusion";
  detail: string;
}

export default IGateRosterViolation;
