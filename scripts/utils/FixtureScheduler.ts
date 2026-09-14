/**
 * Issue #1488: hands out fixtures so that no two sharing a helper `.cnx` run at
 * the same time.
 *
 * A fixture's pipeline run writes its dependencies' generated files in place,
 * so two fixtures sharing one write the same generated `.h` concurrently. The
 * snapshot comparison then reads a file mid-rewrite and reports a mismatch that
 * does not exist -- the same commit failing on CI and passing on re-run, with
 * the blame landing on whichever pull request happened to be running.
 *
 * #1544 removed the standalone helper re-transpile that used to be the second
 * writer. One writer per fixture remains, so a shared helper is still written
 * once per fixture per mode and the lock is still what orders them.
 *
 * A fixture's include closure acts as a lock. Fixtures that share nothing -- the
 * overwhelming majority -- are unconstrained and still run fully parallel.
 *
 * This is a class rather than scheduling logic inlined in the worker pool
 * because the states worth testing are the ones a green suite cannot reach:
 * everything left is blocked, or a worker died holding a lock. Reaching those
 * through the pool would require killing a child process; here they are three
 * lines of setup.
 */
class FixtureScheduler {
  private readonly pending: string[];
  private readonly helpersByFixture: Map<string, readonly string[]>;
  private readonly activeHelpers = new Set<string>();

  /**
   * @param fixtures   Every fixture to run, in the order they should be offered.
   * @param helpersOf  The files a fixture's run reads or rewrites -- its include
   *                   closure. Injected rather than imported so the scheduler is
   *                   testable without a filesystem.
   */
  constructor(
    fixtures: readonly string[],
    helpersOf: (fixture: string) => readonly string[],
  ) {
    this.pending = [...fixtures];
    this.helpersByFixture = new Map(
      fixtures.map((fixture) => [fixture, helpersOf(fixture)]),
    );
  }

  /** Fixtures not yet handed out. */
  get pendingCount(): number {
    return this.pending.length;
  }

  /**
   * The next fixture none of whose helpers is held, removed from the queue, or
   * `null` when every remaining fixture is blocked.
   *
   * Returning `null` is NOT "done" -- the caller must leave that worker idle and
   * re-offer when a release happens, or the run hangs with work outstanding.
   */
  claim(): string | null {
    const index = this.pending.findIndex((fixture) =>
      this.helpersOf(fixture).every(
        (helper) => !this.activeHelpers.has(helper),
      ),
    );
    if (index === -1) {
      return null;
    }
    const [fixture] = this.pending.splice(index, 1);
    for (const helper of this.helpersOf(fixture)) {
      this.activeHelpers.add(helper);
    }
    return fixture;
  }

  /**
   * Release the helpers a claimed fixture held.
   *
   * Safe to call with `undefined` or a fixture that was never claimed: the crash
   * paths call it without knowing whether the worker held anything.
   */
  release(fixture: string | undefined): void {
    if (!fixture) {
      return;
    }
    for (const helper of this.helpersOf(fixture)) {
      this.activeHelpers.delete(helper);
    }
  }

  private helpersOf(fixture: string): readonly string[] {
    return this.helpersByFixture.get(fixture) ?? [];
  }
}

export default FixtureScheduler;
