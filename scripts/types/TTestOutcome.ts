import type TExecSkipReason from "./TExecSkipReason";

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
 * derive nothing themselves.
 *
 * That a kind added here must be ANSWERED rather than defaulted is enforced,
 * not merely intended: each consumer ends in a `never` assignment, so a fourth
 * kind fails to compile instead of falling through to the failure branch in
 * both places. Note the enforcement is currently one-sided -- `tsconfig.json`
 * is `include: ["src/**"]`, so `scripts/` is not typechecked by CI until #1489
 * lands, and until then the guard fires at runtime rather than at build time.
 */
type TTestOutcome =
  /** Passed, and `--update` wrote its snapshot. Counts as a pass too. */
  | { kind: "updated" }
  /**
   * Passed. `execSkip` is the recorded reason the binary was not run, or
   * `null` when it was -- a reason rather than a flag, so the report can say
   * which of the three skips happened instead of always naming the rarest.
   */
  | { kind: "passed"; execSkip: TExecSkipReason | null }
  /**
   * Did not pass. `missingSnapshot` is the REASON for the failure, not an
   * outcome beside it: a fixture that asserts nothing must not report green
   * (the #1227 shape), so the run stays red and says so in one voice.
   */
  | { kind: "failed"; missingSnapshot: boolean };

export default TTestOutcome;
