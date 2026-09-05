import { describe, expect, it, beforeAll } from "vitest";

/**
 * The worker's readiness guard.
 *
 * A worker is forked into `workers` before it has processed its `init` message,
 * and #1488's "offer work to every idle worker" broadcast iterates that array.
 * An uninitialized worker therefore took a fixture and ran it with `tools`
 * undefined; the first dereference was `tools.gcc`, and the worker's own catch
 * reported the crash as `Worker error: ...` -- a FAILURE of whichever fixture it
 * happened to claim. On CI that reads as an unrelated test breaking
 * intermittently, which is how it presented on PR #1507.
 *
 * `scripts/test.ts` is the real fix: it now assigns only to workers that have
 * answered `ready`. That race is timing-dependent and cannot be pinned by a
 * test, so what is pinned here is the second half -- that if it ever happens
 * again, the message names the harness rather than blaming a fixture.
 */
describe("test-worker readiness", () => {
  let runTest: (cnxFile: string, updateMode: boolean) => Promise<unknown>;

  beforeAll(async () => {
    // The module announces itself with `process.send!` at import time, which is
    // undefined outside a forked child. Stub before importing, not after.
    process.send = ((): boolean => true) as typeof process.send;
    const module = await import("../test-worker");
    runTest = module.default;
  });

  it("refuses a test that arrives before init, and says why", async () => {
    await expect(runTest("anything.test.cnx", false)).rejects.toThrow(
      /harness scheduling fault, not a fixture failure/,
    );
  });
});
