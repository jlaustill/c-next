#!/usr/bin/env tsx
/**
 * Issue #1388: give every closed issue and merged pull request the milestone of
 * the release it actually shipped in.
 *
 * Which release something shipped in is a fact about the repository -- the
 * first tag containing the merge commit that closed it -- so it is derived here
 * rather than recorded by hand. Recorded by hand it drifts: every pull request
 * merged from #1327 onward carried no milestone and nothing noticed for four
 * days, while #1157 carried `v0.3.1` although its fix was already an ancestor
 * of the `v0.3.0` tag.
 *
 * Usage:
 *   npm run release:milestones:check   - report drift, write nothing, exit 1 if any
 *   npm run release:milestones         - apply the drift
 *
 * Both modes consider every release, because the index has to be complete for
 * "shipped in no release" to mean anything. That makes the run idempotent and
 * self-healing: it is the backfill, the tag-time step, and the drift check, and
 * there is only one derivation behind all three.
 *
 * Two parts are deliberately not automated. An item closed by hand with no
 * linked commit cannot be attributed -- 58 of 412 here -- and is reported for a
 * human instead of guessed at; the reasoning is in `ReleaseAttribution`. And a
 * milestone is never deleted, only created and closed, because deleting one
 * detaches every item silently.
 */

import { execFileSync } from "node:child_process";

import chalk from "chalk";

import ReleaseAttribution from "./releases/ReleaseAttribution";
import ReleaseItems from "./releases/ReleaseItems";
import ReleaseWindows from "./releases/ReleaseWindows";
import type IReleaseAssignment from "./types/IReleaseAssignment";
import type IReleaseItem from "./types/IReleaseItem";

const OWNER = "jlaustill";
const REPO = "c-next";

/** The branch releases are cut from; the unreleased window is measured to it. */
const DEFAULT_BRANCH = "main";

/**
 * GitHub asks for roughly a second between writes and answers a burst with a
 * secondary rate limit rather than an error you can retry blindly. A backfill
 * is ~400 writes, so it is paced rather than fired.
 */
const WRITE_INTERVAL_MS = 1100;

/** First backoff after a rejected write; doubled on each further attempt. */
const RETRY_BASE_MS = 15_000;

interface IMilestone {
  number: number;
  title: string;
  state: string;
}

const ISSUE_QUERY = `
query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    issues(first: 100, after: $after, states: CLOSED, orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number stateReason milestone { title }
        timelineItems(last: 20, itemTypes: [CLOSED_EVENT]) {
          nodes { ... on ClosedEvent { closer {
            ... on PullRequest { mergeCommit { oid } }
            ... on Commit { oid }
          } } }
        }
        closedByPullRequestsReferences(first: 10, includeClosedPrs: true) {
          nodes { state mergeCommit { oid } }
        }
      }
    }
  }
}`;

const PR_QUERY = `
query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 100, after: $after, states: MERGED, orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes { number milestone { title } mergeCommit { oid } }
    }
  }
}`;

function gh(args: readonly string[]): string {
  return execFileSync("gh", [...args], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function git(args: readonly string[]): string {
  return execFileSync("git", [...args], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Whether a ref resolves, without failing the run when it does not. */
function refExists(ref: string): boolean {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function lines(output: string): string[] {
  return output.split("\n").filter((line) => line.length > 0);
}

/** Walks a paginated connection, returning every node. */
function paginate(query: string, path: string): unknown[] {
  const nodes: unknown[] = [];
  let after: string | null = null;
  for (;;) {
    const args = [
      "api",
      "graphql",
      "-f",
      `owner=${OWNER}`,
      "-f",
      `name=${REPO}`,
    ];
    if (after !== null) {
      args.push("-f", `after=${after}`);
    }
    args.push("-f", `query=${query}`);
    const page = JSON.parse(gh(args)).data.repository[path];
    nodes.push(...page.nodes);
    if (page.pageInfo.hasNextPage !== true) {
      return nodes;
    }
    after = page.pageInfo.endCursor;
  }
}

/**
 * Every milestone, open and closed.
 *
 * Read as one JSON object per line rather than as an array: `gh api --paginate`
 * concatenates each page's array, so the response is only valid JSON when the
 * result fits in one page. `--jq` streaming sidesteps that, and `--slurp` is
 * not in every `gh` version.
 */
function milestones(): IMilestone[] {
  return lines(
    gh([
      "api",
      "--paginate",
      `repos/${OWNER}/${REPO}/milestones?state=all&per_page=100`,
      "--jq",
      ".[] | {number, title, state}",
    ]),
  ).map((line) => JSON.parse(line) as IMilestone);
}

async function pause(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Creates a milestone if it is missing, and returns every milestone by title. */
function ensureMilestones(
  needed: readonly string[],
  existing: readonly IMilestone[],
  tagDates: ReadonlyMap<string, string>,
): Map<string, number> {
  const byTitle = new Map(existing.map((m) => [m.title, m.number]));
  for (const title of needed) {
    if (byTitle.has(title)) {
      continue;
    }
    const args = [
      "api",
      `repos/${OWNER}/${REPO}/milestones`,
      "-X",
      "POST",
      "-f",
      `title=${title}`,
      "-f",
      "description=Release milestone. Assigned by scripts/release-milestones.ts: the closing merge commit is contained in this release.",
    ];
    const due = tagDates.get(title);
    if (due !== undefined) {
      args.push("-f", `due_on=${due}`);
    }
    const created = JSON.parse(gh([...args, "--jq", "{number:.number}"]));
    byTitle.set(title, created.number);
    console.log(chalk.green(`  created milestone ${title}`));
  }
  return byTitle;
}

/**
 * One milestone write, retried through a secondary rate limit.
 *
 * `-f` sends an empty string, which is how the REST API is told to clear a
 * milestone; `-F` sends the number as a typed value. A cleared milestone and a
 * milestone numbered zero are different requests, so the flag is chosen by the
 * value rather than fixed.
 */
async function writeMilestone(
  change: IReleaseAssignment,
  byTitle: ReadonlyMap<string, number>,
): Promise<void> {
  const target =
    change.derived === null ? "" : String(byTitle.get(change.derived));
  const args = [
    "api",
    `repos/${OWNER}/${REPO}/issues/${change.number}`,
    "-X",
    "PATCH",
    change.derived === null ? "-f" : "-F",
    `milestone=${target}`,
    "--jq",
    ".number",
  ];

  for (let attempt = 0; ; attempt += 1) {
    try {
      gh(args);
      return;
    } catch (error) {
      // A backfill is a thousand writes, so a secondary rate limit is a normal
      // event rather than a failure. Three attempts, then let it stop -- the
      // run is idempotent, so re-running resumes where it left off.
      if (attempt >= 2) {
        throw error;
      }
      const wait = RETRY_BASE_MS * 2 ** attempt;
      console.warn(
        chalk.yellow(`  #${change.number} write failed, retrying in ${wait}ms`),
      );
      await pause(wait);
    }
  }
}

async function applyChanges(
  changes: readonly IReleaseAssignment[],
  byTitle: ReadonlyMap<string, number>,
): Promise<void> {
  for (const [done, change] of changes.entries()) {
    await writeMilestone(change, byTitle);
    console.log(
      chalk.green(
        `  [${done + 1}/${changes.length}] ${ReleaseAttribution.describe(change)}`,
      ),
    );
    await pause(WRITE_INTERVAL_MS);
  }
}

function collectItems(): IReleaseItem[] {
  return [
    ...ReleaseItems.fromIssueNodes(paginate(ISSUE_QUERY, "issues") as never),
    ...ReleaseItems.fromPullRequestNodes(
      paginate(PR_QUERY, "pullRequests") as never,
    ),
  ];
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "check";
  if (mode !== "apply" && mode !== "check") {
    console.error(chalk.red(`Unknown mode '${mode}'. Use apply or check.`));
    process.exit(1);
  }

  const tagRefs = lines(
    git([
      "for-each-ref",
      "--sort=creatordate",
      "--format=%(refname:short)\t%(creatordate:iso-strict)",
      "refs/tags",
    ]),
  ).map((line) => line.split("\t"));
  const tags = tagRefs.map(([tag]) => tag);
  const tagDates = new Map(tagRefs.map(([tag, date]) => [tag, date]));

  const existing = milestones();
  const preparing = ReleaseWindows.preparing(
    existing.filter((m) => m.state === "open").map((m) => m.title),
    tags,
  );
  const head = ReleaseWindows.headRef(
    [`origin/${DEFAULT_BRANCH}`, DEFAULT_BRANCH, "HEAD"],
    refExists,
  );
  const windows = ReleaseWindows.build(
    tags,
    preparing === null ? null : { milestone: preparing, head },
    (range) => lines(git(["rev-list", range])),
  );
  console.log(
    chalk.cyan(
      `${windows.length} release window(s)` +
        (preparing === null
          ? ""
          : `, preparing ${preparing} measured to ${head}`),
    ),
  );

  const plan = ReleaseAttribution.plan(collectItems(), windows);
  console.log(
    chalk.cyan(
      `${plan.settled.length} already correct, ${plan.changes.length} to change, ` +
        `${plan.referrals.length} for a human`,
    ),
  );

  for (const referral of plan.referrals) {
    console.warn(chalk.yellow(`  ${ReleaseAttribution.describe(referral)}`));
  }
  // A `not-shipped` item whose merge commit simply is not in this clone yet
  // reads exactly like one merged into a stack that never landed. The run only
  // writes answers it owns, so a stale checkout costs a false referral rather
  // than a wrong milestone -- but the reader still has to be told which they
  // are looking at.
  if (plan.referrals.some((referral) => referral.reason === "not-shipped")) {
    console.warn(
      chalk.yellow(
        "  note: `not-shipped` means the merge commit is on no tag and not on " +
          "HEAD. Run `git fetch` and re-run if this clone may be behind.",
      ),
    );
  }

  if (plan.changes.length === 0) {
    console.log(
      chalk.green("Every derivable item names the release it shipped in."),
    );
    return;
  }

  if (mode === "check") {
    console.error(
      chalk.red(
        `${plan.changes.length} item(s) name the wrong release:\n` +
          plan.changes
            .map((change) => `  ${ReleaseAttribution.describe(change)}`)
            .join("\n") +
          `\n\nRun: npm run release:milestones`,
      ),
    );
    process.exit(1);
  }

  const byTitle = ensureMilestones(plan.milestones, existing, tagDates);
  await applyChanges(plan.changes, byTitle);
  console.log(chalk.green(`Applied ${plan.changes.length} change(s).`));
}

main().catch((error: unknown) => {
  console.error(
    chalk.red(error instanceof Error ? error.message : String(error)),
  );
  process.exit(1);
});
