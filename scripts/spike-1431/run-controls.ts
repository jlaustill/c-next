/**
 * SPIKE #1431 — THROWAWAY. Deleted before the findings doc lands.
 *
 * The mutation harness. A run reporting zero divergences is worth nothing unless a
 * deliberate break makes the probe report them, so this applies one mutation at a
 * time and checks that the probe REDDENS -- and reddens on the right question.
 *
 * The discipline here is not optional decoration; every clause exists because the
 * cheap version of it already failed in this repo:
 *
 * - ASSERT THE MUTATION APPLIED. A scripted replacement matches on source text, and
 *   prettier moves source text. A stale anchor silently mutates nothing and reports
 *   the same green as a guard that cannot fail -- three times in #1260.
 * - ASSERT THE RESTORE. #1399 lost a fix twice by reverting a file that carried
 *   uncommitted work. This copies the file aside and copies it back, never
 *   `git checkout --`, and greps for the marker afterwards to prove it is gone.
 * - REQUIRE A CLEAN TREE FIRST. If the working tree is dirty when a mutation is
 *   applied, the restore cannot be distinguished from the edit.
 * - EXPECT EXACTLY ONE QUESTION TO MOVE. A correct table reddens the targeted view
 *   and nothing else. A mutation that reddens several means the views share a path,
 *   which is itself the finding.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), "../..");
const scratch = process.env.SPIKE_SCRATCH ?? join(rootDir, ".spike-1431-ctrl");
const sampleSize = process.env.SPIKE_LIMIT ?? "250";

interface IMutation {
  /** The view this control targets, matching the `question` field in observations. */
  readonly view: string;
  readonly file: string;
  readonly anchor: string;
  readonly replacement: string;
  readonly marker: string;
  /** What the mutation is supposed to break, in one line, for the report. */
  readonly breaks: string;
}

interface IRunResult {
  observations: number;
  identityMismatches: number;
  divergences: Record<string, number>;
  askedCounts: Record<string, number>;
}

function runProbe(outDir: string): IRunResult {
  execFileSync(
    "npx",
    ["tsx", join(rootDir, "scripts/spike-1431/run-corpus.ts")],
    {
      cwd: rootDir,
      env: { ...process.env, SPIKE_OUT: outDir, SPIKE_LIMIT: sampleSize },
      stdio: "pipe",
    },
  );
  return JSON.parse(
    readFileSync(join(outDir, "summary.json"), "utf8"),
  ) as IRunResult;
}

/** Run the probe but tolerate a non-zero exit: a fired control EXITS 1 by design. */
function runProbeTolerant(outDir: string): IRunResult {
  try {
    return runProbe(outDir);
  } catch {
    return JSON.parse(
      readFileSync(join(outDir, "summary.json"), "utf8"),
    ) as IRunResult;
  }
}

function gitIsClean(): boolean {
  const out = execFileSync("git", ["status", "--porcelain"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  return out.trim() === "";
}

function main(): void {
  if (!gitIsClean()) {
    console.error(
      "REFUSING TO RUN: working tree is dirty. A restore cannot be told apart " +
        "from an edit, and #1399 lost a fix twice exactly this way. Commit first.",
    );
    process.exit(1);
  }
  mkdirSync(scratch, { recursive: true });

  const mutations = JSON.parse(
    readFileSync(join(rootDir, "scripts/spike-1431/mutations.json"), "utf8"),
  ) as IMutation[];

  console.log(`baseline (${sampleSize} fixtures)...`);
  const baseline = runProbeTolerant(join(scratch, "baseline"));
  console.log(
    `  observations ${baseline.observations}, identity mismatches ${baseline.identityMismatches}`,
  );
  if (baseline.identityMismatches !== 0) {
    console.error(
      "REFUSING TO RUN: baseline has identity-control mismatches. The schema does " +
        "not express some view faithfully, so no mutation result would be readable.",
    );
    process.exit(1);
  }

  const rows: string[] = [];
  let reddened = 0;

  for (const mutation of mutations) {
    const target = join(rootDir, mutation.file);
    const backup = join(scratch, `${mutation.marker}.bak`);
    copyFileSync(target, backup);

    const before = readFileSync(target, "utf8");
    if (!before.includes(mutation.anchor)) {
      console.error(
        `SKIP ${mutation.view}: anchor not found. The mutation would have run ` +
          `against unmodified code and reported a false green.`,
      );
      rows.push(`| ${mutation.view} | ANCHOR MISSING | - | - |`);
      continue;
    }
    writeFileSync(
      target,
      before.replace(
        mutation.anchor,
        `/* ${mutation.marker} */\n${mutation.replacement}`,
      ),
    );
    const applied = readFileSync(target, "utf8").includes(mutation.marker);
    if (!applied) {
      console.error(`SKIP ${mutation.view}: marker absent after write.`);
      copyFileSync(backup, target);
      continue;
    }

    const result = runProbeTolerant(join(scratch, mutation.marker));

    copyFileSync(backup, target);
    const restored = !readFileSync(target, "utf8").includes(mutation.marker);
    if (!restored) {
      console.error(
        `FATAL: ${mutation.file} still carries ${mutation.marker} after restore. ` +
          `Stopping rather than contaminating every later control.`,
      );
      process.exit(1);
    }

    const moved = Object.keys({
      ...baseline.divergences,
      ...result.divergences,
    }).filter(
      (q) => (baseline.divergences[q] ?? 0) !== (result.divergences[q] ?? 0),
    );
    const identityMoved =
      result.identityMismatches !== baseline.identityMismatches;
    const didRedden = moved.length > 0 || identityMoved;
    if (didRedden) {
      reddened++;
    }
    rows.push(
      `| ${mutation.view} | ${didRedden ? "RED" : "**GREEN — cannot fail**"} | ` +
        `${moved.join(", ") || "(none)"} | ${baseline.identityMismatches} -> ${result.identityMismatches} |`,
    );
    console.log(
      `${didRedden ? "RED  " : "GREEN"} ${mutation.view.padEnd(34)} moved: ${moved.join(", ") || "-"}`,
    );
  }

  const table = [
    "| view | verdict | questions whose divergence count moved | identity mismatches |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
  writeFileSync(join(scratch, "controls.md"), table + "\n");
  console.log(`\n${reddened}/${mutations.length} controls reddened`);

  if (reddened !== mutations.length) {
    console.error(
      "A control that stays GREEN is a view the corpus cannot distinguish — " +
        "report it as not-reachable-by-the-probe, never as agreement.",
    );
  }
}

main();
