/**
 * Running totals for a test run.
 *
 * Issue #1397: this shape was spelled inline at four sites -- the per-result
 * counter updates, both runners' return types, and main's accumulator -- so a
 * counter added to one could be missed by the others with nothing to catch it.
 *
 * `noSnapshot` counts a SUBSET of `failed`, not a bucket beside it, so the
 * totals still partition the fixtures. Reading it as a peer of `passed` and
 * `failed` is what made one fixture show up in two buckets at once.
 *
 * Specifically it counts failures with no snapshot in ANY mode: the flag comes
 * from `every` over the mode results, so a dual-mode fixture that has its
 * `.expected.c` but not its `.expected.cpp` is a missing-snapshot failure this
 * number does not include. That fixture reports the missing path by name, which
 * is more useful than the generic line, so the narrower count is deliberate.
 */
interface ITestTotals {
  passed: number;
  failed: number;
  updated: number;
  noSnapshot: number;
}

export default ITestTotals;
