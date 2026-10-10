import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

interface IJob {
  if?: string;
  "runs-on"?: string;
  needs?: string | string[];
}

interface IWorkflow {
  concurrency: {
    group: string;
    "cancel-in-progress"?: boolean;
    queue?: string;
  };
  jobs: Record<string, IJob>;
}

const workflow = YAML.parse(
  readFileSync(
    join(repoRoot, ".github", "workflows", "pr-checks.yml"),
    "utf-8",
  ),
) as IWorkflow;

/**
 * The shared queue protects the self-hosted runners, so a run must be in it
 * exactly when it can reach them. Both decisions are written as the same
 * expression in several places -- Actions has no way to define one once for
 * `concurrency:` and every `runs-on:` -- so this pins every copy to the queue's.
 * A fork run in the shared queue could fill it; a trusted run outside it
 * overlaps the others on the runners.
 */
describe("pr-checks.yml queue and runners agree on which runs are trusted", () => {
  const queueGroup =
    /^\$\{\{ \((?<trusted>.+)\) && 'pr-checks' \|\| format\('pr-checks-fork-\{0\}', github\.event\.pull_request\.number\) \}\}$/.exec(
      workflow.concurrency.group,
    );
  const trusted = queueGroup?.groups?.trusted ?? "";

  it("queues trusted runs in one shared group, waiting rather than replacing", () => {
    expect(trusted).not.toBe("");
    expect(workflow.concurrency.queue).toBe("max");
    expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  });

  it("sends a run to the self-hosted runners only under the queue's predicate", () => {
    const selectsRunner = `\${{ (${trusted}) && 'self-hosted' || 'ubuntu-latest' }}`;
    const offenders = Object.entries(workflow.jobs).filter((entry) => {
      const job = entry[1];
      if (job["runs-on"] === selectsRunner) return false;
      return !(job["runs-on"] === "self-hosted" && job.if === trusted);
    });

    expect(offenders.map((entry) => entry[0])).toEqual([]);
  });
});

/**
 * A superseded run cancels itself in `supersede`, and holds that job until the
 * cancellation lands. That only keeps the run's work from starting if every
 * other job waits for `supersede`, directly or through its own needs.
 */
describe("pr-checks.yml starts nothing before the superseded-run check", () => {
  function needsOf(job: IJob): string[] {
    if (job.needs === undefined) return [];
    return Array.isArray(job.needs) ? job.needs : [job.needs];
  }

  function reachesSupersede(name: string, seen: Set<string>): boolean {
    if (name === "supersede") return true;
    if (seen.has(name)) return false;
    seen.add(name);
    return needsOf(workflow.jobs[name]).some((need) =>
      reachesSupersede(need, seen),
    );
  }

  it("has a supersede job that needs nothing", () => {
    expect(workflow.jobs.supersede).toBeDefined();
    expect(needsOf(workflow.jobs.supersede)).toEqual([]);
  });

  it("makes every other job wait for it", () => {
    const unguarded = Object.keys(workflow.jobs).filter(
      (name) => !reachesSupersede(name, new Set()),
    );

    expect(unguarded).toEqual([]);
  });
});
