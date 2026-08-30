import { describe, expect, it, vi } from "vitest";

import MilestoneWriter from "../releases/MilestoneWriter";

const SLUG = "jlaustill/c-next";

describe("MilestoneWriter.patchArgs", () => {
  it("sends the milestone number as a typed field", () => {
    expect(MilestoneWriter.patchArgs(SLUG, 1314, 2)).toEqual([
      "api",
      "repos/jlaustill/c-next/issues/1314",
      "-X",
      "PATCH",
      "-F",
      "milestone=2",
      "--jq",
      ".number",
    ]);
  });

  it("clears a milestone with the documented null, not an empty string", () => {
    // The only destructive write, and the one that had never run: by the time
    // the script existed the not-planned corrections (#1347, #1238) were
    // already applied by hand, so `check` reported nothing to do. An empty
    // string through `-f` also worked, but relied on the API accepting a value
    // its documentation does not name.
    expect(MilestoneWriter.patchArgs(SLUG, 1347, null)).toContain(
      "milestone=null",
    );
  });

  it("uses one flag for both, so the argv does not depend on the value", () => {
    const set = MilestoneWriter.patchArgs(SLUG, 1, 5);
    const cleared = MilestoneWriter.patchArgs(SLUG, 1, null);
    expect(set.filter((a) => a === "-f")).toHaveLength(0);
    expect(cleared.filter((a) => a === "-f")).toHaveLength(0);
    expect(set.indexOf("-F")).toBe(cleared.indexOf("-F"));
  });

  it("patches a pull request through the issues path, as the REST API does", () => {
    expect(MilestoneWriter.patchArgs(SLUG, 1390, 2)).toContain(
      "repos/jlaustill/c-next/issues/1390",
    );
  });

  it("refuses a missing milestone number rather than writing the word undefined", () => {
    // `String(undefined)` would reach GitHub as "undefined" and return a 422
    // halfway through a backfill, saying nothing about what went wrong.
    expect(() => MilestoneWriter.patchArgs(SLUG, 99, Number.NaN)).toThrow(
      /No milestone number for #99/,
    );
  });

  it("still accepts milestone zero, which is a number and not an absence", () => {
    expect(MilestoneWriter.patchArgs(SLUG, 1, 0)).toContain("milestone=0");
  });
});

describe("MilestoneWriter.createArgs", () => {
  it("dates a release milestone so the list reads as a timeline", () => {
    const args = MilestoneWriter.createArgs(
      SLUG,
      "v0.2.7",
      "2026-02-23T15:50:49Z",
    );
    expect(args).toContain("title=v0.2.7");
    expect(args).toContain("due_on=2026-02-23T15:50:49Z");
  });

  it("omits the due date for a release that has no tag yet", () => {
    // The negative control: the milestone being prepared is not a tag, so it
    // has no date to carry, and sending an empty one would be a bad request.
    const args = MilestoneWriter.createArgs(SLUG, "v0.3.1");
    expect(args.some((a) => a.startsWith("due_on="))).toBe(false);
    expect(args).toContain("title=v0.3.1");
  });
});

describe("MilestoneWriter pacing", () => {
  it("paces writes about a second apart, as GitHub asks", () => {
    // A backfill is ~1000 writes; firing them as fast as the network allows is
    // what trips a secondary rate limit in the first place.
    expect(MilestoneWriter.intervalMs).toBeGreaterThanOrEqual(1000);
  });

  it("allows more than one attempt, so a rate limit is survivable", () => {
    expect(MilestoneWriter.maxAttempts).toBeGreaterThan(1);
  });
});

describe("MilestoneWriter.retryDelayMs", () => {
  it("doubles the backoff on each attempt", () => {
    expect(MilestoneWriter.retryDelayMs(0)).toBe(15_000);
    expect(MilestoneWriter.retryDelayMs(1)).toBe(30_000);
    expect(MilestoneWriter.retryDelayMs(2)).toBe(60_000);
  });
});

describe("MilestoneWriter.write", () => {
  const sleep = vi.fn(async () => {});

  it("writes once when the call succeeds", async () => {
    const run = vi.fn();
    const onRetry = vi.fn();
    await MilestoneWriter.write(["api"], run, sleep, onRetry);
    expect(run).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("retries a rejected write and reports each retry", async () => {
    // A backfill is ~1000 writes, so a secondary rate limit is a normal event.
    let calls = 0;
    const run = vi.fn(() => {
      calls += 1;
      if (calls < 3) throw new Error("secondary rate limit");
    });
    const onRetry = vi.fn();
    await MilestoneWriter.write(["api"], run, sleep, onRetry);
    expect(run).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 0, 15_000);
    expect(onRetry).toHaveBeenNthCalledWith(2, 1, 30_000);
  });

  it("rethrows once the attempts run out, rather than reporting a write it did not make", async () => {
    const run = vi.fn(() => {
      throw new Error("403 forbidden");
    });
    await expect(
      MilestoneWriter.write(["api"], run, sleep, vi.fn()),
    ).rejects.toThrow("403 forbidden");
    expect(run).toHaveBeenCalledTimes(MilestoneWriter.maxAttempts);
  });

  it("waits the backoff it reported before retrying", async () => {
    const waited: number[] = [];
    let calls = 0;
    await MilestoneWriter.write(
      ["api"],
      () => {
        calls += 1;
        if (calls < 2) throw new Error("rate limited");
      },
      async (ms) => {
        waited.push(ms);
      },
      vi.fn(),
    );
    expect(waited).toEqual([15_000]);
  });
});
