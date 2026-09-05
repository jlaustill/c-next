/**
 * Issue #1397: the classification `printResult` and `getCounterUpdates` used to
 * make independently, and disagree on.
 *
 * The integration test in `no-snapshot-reporting.test.ts` proves the harness
 * reports a missing snapshot coherently end to end. This one pins the mapping
 * itself, so a new result kind cannot be added without an answer here -- which
 * is the property that stops the two consumers drifting apart again.
 */
import { describe, it, expect } from "vitest";
import TestOutcome from "../utils/TestOutcome";
import type ITestResult from "../types/ITestResult";

/** A result carrying only the fields the classification reads. */
const resultWith = (fields: Partial<ITestResult>): ITestResult => ({
  passed: false,
  ...fields,
});

describe("TestOutcome.classify (Issue #1397)", () => {
  it("a passing result is a pass, with no skip reason", () => {
    expect(TestOutcome.classify(resultWith({ passed: true }))).toEqual({
      kind: "passed",
      execSkip: null,
    });
  });

  it("a skipped execution carries the reason that was recorded", () => {
    // Issue #1397: the reason is read, not assumed. `arm` used to be printed
    // for every skip, including the two that are transpile-only.
    expect(
      TestOutcome.classify(
        resultWith({ passed: true, skippedExec: true, skipReason: "arm" }),
      ),
    ).toEqual({ kind: "passed", execSkip: "arm" });

    expect(
      TestOutcome.classify(
        resultWith({
          passed: true,
          skippedExec: true,
          skipReason: "transpile-only",
        }),
      ),
    ).toEqual({ kind: "passed", execSkip: "transpile-only" });
  });

  it("a skip with no recorded reason is unspecified, not guessed", () => {
    expect(
      TestOutcome.classify(resultWith({ passed: true, skippedExec: true })),
    ).toEqual({ kind: "passed", execSkip: "unspecified" });
  });

  it("an updated snapshot is its own kind, not a plain pass", () => {
    expect(
      TestOutcome.classify(resultWith({ passed: true, updated: true })),
    ).toEqual({ kind: "updated" });
  });

  it("a failing result is a failure", () => {
    expect(TestOutcome.classify(resultWith({ passed: false }))).toEqual({
      kind: "failed",
      missingSnapshot: false,
    });
  });

  it("a missing snapshot is a failure, with the reason carried on it", () => {
    // The whole defect in one assertion: this must not be a third kind sitting
    // beside "passed" and "failed", or the buckets stop partitioning the run.
    expect(
      TestOutcome.classify(resultWith({ passed: false, noSnapshot: true })),
    ).toEqual({ kind: "failed", missingSnapshot: true });
  });

  it("a missing snapshot on a PASSING result does not make it a failure", () => {
    // Defensive, not a state the harness reaches today: under `--update` the
    // existence check runs AFTER the snapshot is written, so a freshly created
    // snapshot is never reported missing. What this pins is the PRECEDENCE --
    // `passed` is asked first -- so that if a passing result ever does carry
    // `noSnapshot`, it is not silently reclassified as a failure.
    expect(
      TestOutcome.classify(
        resultWith({ passed: true, updated: true, noSnapshot: true }),
      ),
    ).toEqual({ kind: "updated" });
  });
});
