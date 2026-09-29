import { describe, it, expect } from "vitest";
import ConcurrencyLimit from "../ConcurrencyLimit";

/** A task that records how many tasks are running while it runs. */
function probe(state: { running: number; peak: number }): () => Promise<void> {
  return async () => {
    state.running += 1;
    state.peak = Math.max(state.peak, state.running);
    await new Promise((resolve) => setTimeout(resolve, 1));
    state.running -= 1;
  };
}

describe("ConcurrencyLimit", () => {
  it("never runs more than max tasks at once, and runs every task", async () => {
    const limit = ConcurrencyLimit.create(3);
    const state = { running: 0, peak: 0 };

    await Promise.all(Array.from({ length: 20 }, () => limit(probe(state))));

    expect(state.peak).toBe(3);
    expect(state.running).toBe(0);
  });

  it("does not exceed max when a caller arrives while a slot is handed on", async () => {
    const limit = ConcurrencyLimit.create(1);
    const state = { running: 0, peak: 0 };
    let late: Promise<void> | undefined;

    const first = limit(
      () =>
        new Promise<void>((resolve) => {
          state.running += 1;
          state.peak = Math.max(state.peak, state.running);
          setTimeout(() => {
            state.running -= 1;
            resolve();
            // Queued right behind the limiter's own continuation, so it runs
            // after the finishing task gives up its slot and before the waiter
            // resumes. A limiter that releases and THEN wakes the waiter lets
            // this caller in too, and two tasks run under a limit of one.
            void Promise.resolve().then(() => {
              late = limit(probe(state));
            });
          }, 1);
        }),
    );
    const queued = limit(probe(state));

    await Promise.all([first, queued]);
    await late;
    expect(late).toBeDefined();
    expect(state.peak).toBe(1);
  });

  it("returns each task's value and frees the slot when a task rejects", async () => {
    const limit = ConcurrencyLimit.create(1);

    await expect(
      limit(() => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
    await expect(limit(() => Promise.resolve(42))).resolves.toBe(42);
  });
});
