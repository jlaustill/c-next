/**
 * Issue #1488: the mutual exclusion that stops two fixtures sharing a helper
 * `.cnx` from running at once. See FixtureScheduler.
 *
 * These cover the states a green suite cannot reach — everything left blocked,
 * and a holder disappearing without finishing — which is where the risk sits.
 */

import FixtureScheduler from "../utils/FixtureScheduler";

/** Fixture -> its include closure, for a scheduler with no filesystem. */
const schedulerFor = (
  graph: Record<string, string[]>,
  order?: string[],
): FixtureScheduler =>
  new FixtureScheduler(order ?? Object.keys(graph), (f) => graph[f] ?? []);

describe("FixtureScheduler", () => {
  it("hands out fixtures that share nothing, in order", () => {
    const s = schedulerFor({ a: [], b: [] });

    expect(s.claim()).toBe("a");
    expect(s.claim()).toBe("b");
    expect(s.claim()).toBeNull();
  });

  it("does not hand out two fixtures sharing a helper at once", () => {
    const s = schedulerFor({ a: ["types.cnx"], b: ["types.cnx"] });

    expect(s.claim()).toBe("a");
    expect(s.claim()).toBeNull();
  });

  it("hands out the second once the first releases", () => {
    const s = schedulerFor({ a: ["types.cnx"], b: ["types.cnx"] });

    const first = s.claim();
    expect(first).toBe("a");
    s.release(first!);

    expect(s.claim()).toBe("b");
  });

  it("skips a blocked fixture and takes a later unblocked one", () => {
    // `b` shares with `a`; `c` shares nothing, so a worker asking while `a` is
    // in flight must get `c` rather than stalling behind `b`.
    const s = schedulerFor({ a: ["types.cnx"], b: ["types.cnx"], c: [] });

    expect(s.claim()).toBe("a");
    expect(s.claim()).toBe("c");
    expect(s.claim()).toBeNull();
  });

  it("blocks on ANY shared helper, not only an identical closure", () => {
    const s = schedulerFor({ a: ["x.cnx", "y.cnx"], b: ["y.cnx", "z.cnx"] });

    expect(s.claim()).toBe("a");
    expect(s.claim()).toBeNull();
  });

  it("releasing a fixture that was never claimed is safe", () => {
    const s = schedulerFor({ a: ["types.cnx"], b: ["types.cnx"] });

    // The crash paths release without knowing whether the worker held anything.
    s.release(undefined);
    s.release("never-queued");

    expect(s.claim()).toBe("a");
    expect(s.claim()).toBeNull();
  });

  it("frees the lock when a holder is released without finishing", () => {
    // A worker dying mid-fixture: its helpers must not stay locked forever, or
    // every fixture sharing them is unreachable for the rest of the run.
    const s = schedulerFor({ a: ["types.cnx"], b: ["types.cnx"] });

    const crashed = s.claim();
    s.release(crashed!);

    expect(s.claim()).toBe("b");
    expect(s.pendingCount).toBe(0);
  });

  it("drains completely when every fixture shares one helper", () => {
    // The worst case for the lock: full serialization must still terminate,
    // with every fixture handed out exactly once.
    const graph = { a: ["t.cnx"], b: ["t.cnx"], c: ["t.cnx"] };
    const s = schedulerFor(graph);

    const seen: string[] = [];
    for (let guard = 0; guard < 10 && s.pendingCount > 0; guard++) {
      const claimed = s.claim();
      if (claimed === null) {
        throw new Error("blocked with nothing in flight — would hang");
      }
      seen.push(claimed);
      s.release(claimed);
    }

    expect(seen).toEqual(["a", "b", "c"]);
    expect(s.pendingCount).toBe(0);
  });

  it("reports pendingCount so the crash path can decide to replace a worker", () => {
    const s = schedulerFor({ a: [], b: [] });

    expect(s.pendingCount).toBe(2);
    s.claim();
    expect(s.pendingCount).toBe(1);
  });
});
