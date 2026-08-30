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
import MilestoneWriter from "./releases/MilestoneWriter";
import ReleaseWindows from "./releases/ReleaseWindows";
import Repo from "./utils/Repo";
import type IReleaseAssignment from "./types/IReleaseAssignment";
import type IReleaseItem from "./types/IReleaseItem";

/** The branch releases are cut from; the unreleased window is measured to it. */
const DEFAULT_BRANCH = "main";

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

/**
 * Walks a paginated connection, returning every node.
 *
 * Generic rather than `unknown[]`: the concrete type flows in from the argument
 * position at the call site, so the node interfaces stay private to
 * `ReleaseItems` and no `as never` is needed. `as never` is assignable to any
 * parameter, so it would have silenced a drift between these queries and the
 * shapes that parse them -- at the boundary where a wrong assumption becomes a
 * wrong milestone written across hundreds of items.
 */
function paginate<T>(query: string, path: string): T[] {
  const nodes: T[] = [];
  let after: string | null = null;
  for (;;) {
    const args = [
      "api",
      "graphql",
      "-f",
      `owner=${Repo.OWNER}`,
      "-f",
      `name=${Repo.NAME}`,
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
      `repos/${Repo.slug()}/milestones?state=all&per_page=100`,
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
    const args = MilestoneWriter.createArgs(
      Repo.slug(),
      title,
      tagDates.get(title),
    );
    const created = JSON.parse(gh([...args, "--jq", "{number:.number}"]));
    byTitle.set(title, created.number);
    console.log(chalk.green(`  created milestone ${title}`));
  }
  return byTitle;
}

async function applyChanges(
  changes: readonly IReleaseAssignment[],
  byTitle: ReadonlyMap<string, number>,
): Promise<void> {
  for (const [done, change] of changes.entries()) {
    const milestone =
      change.derived === null
        ? null
        : (byTitle.get(change.derived) ?? Number.NaN);
    await MilestoneWriter.write(
      MilestoneWriter.patchArgs(Repo.slug(), change.number, milestone),
      (args) => gh(args),
      pause,
      (attempt, waitMs) => {
        console.warn(
          chalk.yellow(
            `  #${change.number} write failed (attempt ${attempt + 1}/${MilestoneWriter.maxAttempts}), retrying in ${waitMs}ms`,
          ),
        );
      },
    );
    console.log(
      chalk.green(
        `  [${done + 1}/${changes.length}] ${ReleaseAttribution.describe(change)}`,
      ),
    );
    await pause(MilestoneWriter.intervalMs);
  }
}

function collectItems(): IReleaseItem[] {
  return [
    ...ReleaseItems.fromIssueNodes(paginate(ISSUE_QUERY, "issues")),
    ...ReleaseItems.fromPullRequestNodes(paginate(PR_QUERY, "pullRequests")),
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
  const { milestone: preparing, ambiguous } = ReleaseWindows.preparing(
    existing.filter((m) => m.state === "open").map((m) => m.title),
    tags,
  );
  if (ambiguous.length > 0) {
    console.warn(
      chalk.yellow(
        `  warning: ${ambiguous.join(" and ")} are both open and untagged, so ` +
          "which release is in preparation cannot be told. Attributing shipped " +
          "work only; unreleased merges are left alone until one is tagged.",
      ),
    );
  }
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
        "  note: `not-shipped` means the merge commit is on no tag and not " +
          `on ${head}. Run \`git fetch\` and re-run if this clone may be behind.`,
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
