/**
 * Issue #1397: a fixture with no `.expected.*` snapshot is tallied into BOTH
 * `noSnapshot` and `failed`. The summary prints it under `Skipped:`, the exit
 * code is 1, and no `FAIL` line names it — so the `Failed:` total and the
 * failure detail disagree, and nothing in the output says why the run is red.
 *
 * `printResult` and `getCounterUpdates` each classified the same result and
 * drew their own conclusion; nothing made the two agree, and they did not. Both
 * now read one outcome from `TestOutcome.classify`, which is what this guards --
 * the divergence, not just the symptom it happened to produce.
 *
 * The two assertions are the issue's two named defects. The two controls are
 * what stop an over-correction:
 *
 *   - a missing snapshot must STILL fail the build — a fixture that asserts
 *     nothing must not report green (the #1227 shape), and "stop failing" is
 *     explicitly not what this issue asks for;
 *   - a fixture WITH a snapshot must still pass, printing no failure line, so a
 *     fix cannot buy agreement by reporting everything as failed.
 *
 * The assertions state the invariant rather than one particular remedy, because
 * the issue left the choice open: either label a missing snapshot a failure and
 * print a `FAIL` line naming it, or keep `Skipped` genuinely skipped and count
 * it apart from `failed`. Both satisfy this test -- it pins the property, not
 * the wording -- and both were red before the fix.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const harness = join(repoRoot, "scripts", "test.ts");

/** One fixture, minimal, so the run's outcome is attributable to it alone. */
const FIXTURE = `// Issue #1397: fixture used to probe missing-snapshot reporting
i32 main() {
    return 0;
}
`;

/** Built without a literal control character so the source stays printable. */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

interface IHarnessRun {
  status: number;
  output: string;
  /** Fixtures printed under a `FAIL` line. */
  failLines: string[];
  passed: number;
  failed: number;
  skipped: number;
}

/** Read `  Label: N` out of the summary. Absent means the harness printed 0. */
function summaryCount(output: string, label: string): number {
  const match = new RegExp(`${label}:\\s+(\\d+)`).exec(output);
  return match ? Number.parseInt(match[1], 10) : 0;
}

/**
 * Run the real harness over `dir`. `--transpile-only` keeps the run off gcc so
 * the reporting behavior under test is what decides the outcome.
 */
function runHarness(dir: string, extraArgs: string[] = []): IHarnessRun {
  const run = spawnSync(
    process.execPath,
    ["--import", "tsx", harness, dir, "--transpile-only", ...extraArgs],
    {
      encoding: "utf-8",
      cwd: repoRoot,
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
        // This child is spawned, not forked, so it has no `process.send` and
        // falls outside the guard that keeps vitest workers off `test-utils`'
        // auto-rebuild path. Without this, `npm run unit` would build the
        // project as a side effect and could rewrite `dist/index.js` under a
        // concurrent `npm test`. What is asserted here is how the harness
        // REPORTS, so a stale bundle is immaterial.
        CNEXT_SKIP_DIST_REBUILD: "1",
      },
    },
  );

  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.replace(ANSI, "");

  return {
    status: run.status ?? -1,
    output,
    failLines: output.split("\n").filter((line) => /^FAIL\s/.test(line)),
    passed: summaryCount(output, "Passed"),
    failed: summaryCount(output, "Failed"),
    skipped: summaryCount(output, "Skipped"),
  };
}

describe("missing-snapshot reporting (Issue #1397)", () => {
  let workDir: string;
  let withoutSnapshot: IHarnessRun;
  let withSnapshot: IHarnessRun;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "cnext-1397-"));
    writeFileSync(join(workDir, "missing-snapshot.test.cnx"), FIXTURE);

    // Red case: exactly one fixture, no `.expected.*` beside it.
    withoutSnapshot = runHarness(workDir);

    // Control: the same fixture once its snapshots exist.
    runHarness(workDir, ["--update"]);
    withSnapshot = runHarness(workDir);
  }, 300_000);

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it("reproduces the state under test: one fixture, no snapshot", () => {
    expect(withoutSnapshot.output).toContain("missing-snapshot.test.cnx");
    expect(withoutSnapshot.passed).toBe(0);
  });

  it("counts the fixture in exactly one terminal bucket", () => {
    // The printed buckets must partition the run. Before the fix they did not:
    // the same fixture sat inside `Failed:` and inside `Skipped:`, summing to 2
    // for one fixture.
    expect(
      withoutSnapshot.passed + withoutSnapshot.failed + withoutSnapshot.skipped,
      `one fixture, but the summary buckets sum to ${
        withoutSnapshot.passed +
        withoutSnapshot.failed +
        withoutSnapshot.skipped
      }:\n${withoutSnapshot.output}`,
    ).toBe(1);
  });

  it("names every fixture it counts in the Failed total", () => {
    // The summary and the detail must agree: a fixture inside `Failed:` has a
    // `FAIL` line naming it. Before the fix, `Failed: 1` printed with zero.
    expect(
      withoutSnapshot.failLines.length,
      `Failed: ${withoutSnapshot.failed} but ${withoutSnapshot.failLines.length} FAIL lines printed:\n${withoutSnapshot.output}`,
    ).toBe(withoutSnapshot.failed);
  });

  it("CONTROL: a missing snapshot still fails the build", () => {
    // Not a request to stop failing — a fixture that asserts nothing must not
    // report green. A fix that turns this run green is the wrong fix.
    expect(withoutSnapshot.status).toBe(1);
  });

  it("CONTROL: the same fixture passes once its snapshot exists", () => {
    expect(withSnapshot.status).toBe(0);
    expect(withSnapshot.passed).toBe(1);
    expect(withSnapshot.failed).toBe(0);
    expect(withSnapshot.skipped).toBe(0);
    expect(withSnapshot.failLines).toHaveLength(0);
  });

  it("states the real reason execution was skipped, not a fixed one", () => {
    // Issue #1397: the note was hard-coded to ARM on every skip, while two of
    // the three skips are transpile-only. Host-independent: `--transpile-only`
    // returns before the ARM check is ever reached, so this holds on an ARM
    // runner too.
    expect(withSnapshot.output).toContain("exec skipped: transpile-only");
    expect(withSnapshot.output).not.toContain("exec skipped: ARM");
  });
});
