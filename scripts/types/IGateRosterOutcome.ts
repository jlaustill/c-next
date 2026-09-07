import IGateRosterViolation from "./IGateRosterViolation";

/** The result of one gate-roster scan (issue #1526). */
interface IGateRosterOutcome {
  /** `run_check` invocations found in `gate.sh`. */
  checkCount: number;
  /** npm scripts `gate.sh` runs. */
  gateScripts: string[];
  /** npm scripts `pr-checks.yml` runs, excluding installs. */
  workflowScripts: string[];
  /** Scripts CI runs that `gate.sh` deliberately skips, paired with reasons. */
  exclusions: [string, string][];
  /** The count CLAUDE.md claims, or null when the sentence could not be read. */
  claimedCount: number | null;
  violations: IGateRosterViolation[];
}

export default IGateRosterOutcome;
