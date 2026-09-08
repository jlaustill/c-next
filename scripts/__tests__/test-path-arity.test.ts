import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The harness accepts at most ONE test path.
 *
 * It used to take the first non-flag argument with `args.find(...)` and drop
 * every later one in silence, so `npm test -- dirA dirB` ran only dirA and
 * printed its result as the whole answer. Green then meant "the first path
 * passed", which is indistinguishable from "both passed" and is the more
 * reassuring of the two readings -- the shape CLAUDE.md keeps naming, where
 * nothing fails and nobody is prompted to look.
 *
 * Refusing the invocation rather than supporting several paths: running
 * multiple paths is a new capability with its own surface, and no caller in
 * the repo passes more than one. This removes a wrong answer; it adds nothing.
 *
 * Found while working #1508, by hitting it -- two directories were passed to
 * regenerate snapshots and only the first was regenerated, which then showed
 * up as an unexplained gate failure.
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const harness = join(repoRoot, "scripts", "test.ts");

function runHarness(args: string[]) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", harness, ...args, "--transpile-only"],
    {
      encoding: "utf-8",
      cwd: repoRoot,
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
        CNEXT_SKIP_DIST_REBUILD: "1",
      },
    },
  );
}

const ONE = "tests/include/adr-010-matrix-direct";
const TWO = "tests/bugs/issue-1508-transitive-link";

describe("test harness path arity (#1508 follow-up)", () => {
  it("refuses two paths instead of silently running the first", () => {
    const run = runHarness([ONE, TWO]);
    expect(run.status).toBe(1);
    expect(`${run.stdout}${run.stderr}`).toContain(
      "expected at most one test path",
    );
  });

  // Negative controls. Each is a case that must stay SILENT -- without them a
  // rule that rejected every invocation would pass the assertion above.
  it("accepts one path", () => {
    const run = runHarness([ONE]);
    expect(run.status).toBe(0);
  });

  // The no-path invocation -- what CI runs -- is deliberately NOT asserted
  // here: it walks the whole corpus and would put minutes into `npm run unit`
  // to re-prove what the `Integration Tests` job proves on every push. Named
  // rather than quietly omitted, so the gap is a decision and not an oversight.

  it("does not count the number after --jobs as a second path", () => {
    // The sharpest control: `4` is a non-flag argument sitting right beside a
    // real path, so an arity check that forgot the --jobs exclusion would
    // reject this valid invocation and only this one.
    const run = runHarness(["--jobs", "4", ONE]);
    expect(run.status).toBe(0);
    expect(`${run.stdout}${run.stderr}`).not.toContain(
      "expected at most one test path",
    );
  });
});
