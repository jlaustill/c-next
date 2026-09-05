/**
 * The single point at which a finished test result becomes an outcome.
 *
 * Issue #1397: `printResult` and `getCounterUpdates` each classified an
 * `ITestResult` independently, and nothing made them agree. One routed a
 * missing snapshot to a `SKIP` line, the other counted it as `failed` on top of
 * `noSnapshot` -- one fixture in two mutually exclusive buckets, and a `Failed`
 * total that named nothing. Sharing the fields was never the problem; sharing
 * the DECISION is the fix.
 */
import type ITestResult from "../types/ITestResult";
import type TTestOutcome from "../types/TTestOutcome";

/**
 * Classify a finished result.
 *
 * A missing snapshot is deliberately NOT its own outcome. It is why a test
 * failed, so it travels on the failure rather than beside it -- which is what
 * keeps the printed buckets a partition of the fixtures.
 */
function classify(result: ITestResult): TTestOutcome {
  if (result.passed) {
    if (result.updated === true) {
      return { kind: "updated" };
    }
    return { kind: "passed", execSkipped: result.skippedExec === true };
  }

  return { kind: "failed", missingSnapshot: result.noSnapshot === true };
}

class TestOutcome {
  static classify = classify;
}

export default TestOutcome;
