/**
 * Running totals for a test run.
 *
 * Issue #1397: this shape was spelled inline at four sites -- the per-result
 * counter updates, both runners' return types, and main's accumulator -- so a
 * counter added to one could be missed by the others with nothing to catch it.
 *
 * `noSnapshot` counts a SUBSET of `failed`, not a bucket beside it. A fixture
 * with no snapshot fails the run; this says how many of the failures are that,
 * so the totals still partition the fixtures. Reading it as a peer of `passed`
 * and `failed` is what made one fixture show up in two buckets at once.
 */
interface ITestTotals {
  passed: number;
  failed: number;
  updated: number;
  noSnapshot: number;
}

export default ITestTotals;
