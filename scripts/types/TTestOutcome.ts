/**
 * What a finished test result MEANS -- decided once, in `TestOutcome.classify`.
 *
 * Issue #1397: printing and counting each re-derived this from `passed` and
 * `noSnapshot`, and they disagreed. A fixture with no snapshot printed as
 * `SKIP` with no `FAIL` line while being counted in `failed`, so the summary
 * and the detail contradicted each other and nothing said why the run was red.
 *
 * The point is not that the two sites read the same fields -- they did -- but
 * that each drew its own conclusion from them. Consumers switch on `kind` and
 * derive nothing themselves, so a result kind added here has to be answered
 * everywhere it matters rather than defaulting differently in each place.
 */
type TTestOutcome =
  /** Passed, and `--update` wrote its snapshot. Counts as a pass too. */
  | { kind: "updated" }
  /** Passed. `execSkipped` when the binary was not run (ARM host). */
  | { kind: "passed"; execSkipped: boolean }
  /**
   * Did not pass. `missingSnapshot` is the REASON for the failure, not an
   * outcome beside it: a fixture that asserts nothing must not report green
   * (the #1227 shape), so the run stays red and says so in one voice.
   */
  | { kind: "failed"; missingSnapshot: boolean };

export default TTestOutcome;
