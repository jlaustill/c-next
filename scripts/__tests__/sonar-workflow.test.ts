import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

interface IStep {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
}

interface IJob {
  name?: string;
  if?: string;
  "runs-on"?: string;
  steps?: IStep[];
}

interface IWorkflow {
  name: string;
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs: Record<string, IJob>;
}

function load(file: string): IWorkflow {
  return YAML.parse(
    readFileSync(join(repoRoot, ".github", "workflows", file), "utf-8"),
  ) as IWorkflow;
}

const prChecks = load("pr-checks.yml");
const sonar = load("sonar.yml");
const scanJob = sonar.jobs.scan;
const steps = scanJob.steps ?? [];
const runScripts = steps.flatMap((step) => (step.run ? [step.run] : []));

function stepUsing(action: string): IStep[] {
  return steps.filter((step) => step.uses?.startsWith(`${action}@`));
}

/**
 * #1680: a pull request from a fork gets no repository secrets, so a Sonar
 * scan inside `pr-checks.yml` cannot authenticate there. `sonar.yml` runs on
 * `workflow_run`, in the base repository's context WITH `SONAR_TOKEN` -- and
 * with the fork's files on disk. Everything below is the reason that is safe;
 * each assertion names the attack it stops.
 */
describe("sonar.yml — scans fork pull requests from a trusted context", () => {
  it("runs after PR Quality Checks completes, by that workflow's own name", () => {
    expect(sonar.on).toEqual({
      workflow_run: { workflows: [prChecks.name], types: ["completed"] },
    });
  });

  it("never runs on a self-hosted runner, because fork files land on disk", () => {
    for (const job of Object.values(sonar.jobs)) {
      expect(job["runs-on"]).toBe("ubuntu-latest");
    }
  });

  it("grants the token read scopes only", () => {
    expect(sonar.permissions).toEqual({
      actions: "read",
      contents: "read",
      "pull-requests": "read",
    });
  });

  it("executes no fork-controlled code: no package manager or node in any run step", () => {
    expect(runScripts.length).toBeGreaterThan(0);
    for (const script of runScripts) {
      expect(script).not.toMatch(/\b(npm|npx|node|yarn|pnpm|tsx)\b/);
    }
  });

  it("interpolates no event payload into a shell script (branch names are attacker-chosen)", () => {
    for (const script of runScripts) {
      expect(script).not.toMatch(/\$\{\{[^}]*github\.event/);
    }
  });

  it("checks the pull request out without credentials", () => {
    const prCheckout = stepUsing("actions/checkout").filter(
      (step) => step.with?.path === undefined,
    );
    expect(prCheckout).toHaveLength(1);
    expect(prCheckout[0].with?.["persist-credentials"]).toBe(false);
  });

  /**
   * actions/checkout refuses fork code in a `workflow_run` unless the step opts
   * in (first live run, 36252707112). The opt-in is what every test above makes
   * safe, so it belongs on the one step that needs fork code and nowhere else.
   */
  it("opts into fork checkout on the pull request step only", () => {
    const optedIn = stepUsing("actions/checkout").filter(
      (step) => step.with?.["allow-unsafe-pr-checkout"] !== undefined,
    );
    expect(optedIn).toHaveLength(1);
    expect(optedIn[0].with?.path).toBeUndefined();
    expect(optedIn[0].with?.["allow-unsafe-pr-checkout"]).toBe(true);
  });

  it("asserts the checked-out commit is the one PR Quality Checks ran on", () => {
    const assertion = runScripts.filter((script) =>
      script.includes("git rev-parse HEAD"),
    );
    expect(assertion).toHaveLength(1);
    expect(assertion[0]).toContain('"$HEAD_SHA"');
  });

  it("reads Sonar settings from the default branch, never from the fork", () => {
    const trusted = stepUsing("actions/checkout").filter(
      (step) => step.with?.path !== undefined,
    );
    expect(trusted).toHaveLength(1);
    expect(trusted[0].with?.ref).toBe(
      "${{ github.event.repository.default_branch }}",
    );

    const scan = stepUsing("SonarSource/sonarqube-scan-action");
    expect(scan).toHaveLength(1);
    expect(scan[0].with?.args).toBe(
      `-Dproject.settings=${String(trusted[0].with?.path)}/sonar-project.properties`,
    );
    expect(scan[0].env?.SONAR_HOST_URL).toBe("https://sonarcloud.io");
  });

  it("pins the scan action to a full commit SHA, not a movable tag", () => {
    const scan = stepUsing("SonarSource/sonarqube-scan-action")[0];
    expect(scan.uses).toMatch(/@[0-9a-f]{40}$/);
  });
});

/**
 * PR A of #1680's two-PR landing: `sonar.yml` takes fork pull requests and
 * `pr-checks.yml` keeps pushes and same-repository pull requests, so no pull
 * request is scanned twice or not at all. PR B moves the rest into `sonar.yml`
 * and deletes this describe with the `pr-checks.yml` job.
 */
describe("#1680 PR A — the two Sonar paths partition pull requests", () => {
  it("sonar.yml scans fork pull requests only", () => {
    expect(scanJob.if).toBe(
      "github.event.workflow_run.event == 'pull_request' && github.event.workflow_run.head_repository.full_name != github.repository",
    );
  });

  it("pr-checks.yml scans pushes and same-repository pull requests only", () => {
    expect(prChecks.jobs.sonar.if).toBe(
      "github.event_name == 'push' || !github.event.pull_request.head.repo.fork",
    );
  });

  it("All Checks Passed accepts a skipped Sonar job for a fork only", () => {
    const verify = prChecks.jobs["all-checks-passed"].steps?.[0].run ?? "";
    const sonarLines = verify
      .split("\n")
      .filter((line) => line.includes("needs.sonar.result"));
    expect(sonarLines).toHaveLength(1);
    expect(sonarLines[0]).toContain("github.event.pull_request.head.repo.fork");
  });

  it("both paths pin the same scan action", () => {
    const prChecksScan = (prChecks.jobs.sonar.steps ?? []).find((step) =>
      step.uses?.startsWith("SonarSource/sonarqube-scan-action@"),
    );
    expect(prChecksScan?.uses).toBe(
      stepUsing("SonarSource/sonarqube-scan-action")[0].uses,
    );
  });
});
