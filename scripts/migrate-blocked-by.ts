#!/usr/bin/env tsx
/**
 * One-time migration (#1893): every blocker the board's free-text `Blocked by`
 * field still claims becomes a GitHub built-in blocked-by relationship, and each
 * card's text is preserved verbatim in a comment, because the field is deleted
 * afterwards (#1893 owner ruling 2).
 *
 * Usage:
 *   npx tsx scripts/migrate-blocked-by.ts          - dry run: report, write nothing
 *   npx tsx scripts/migrate-blocked-by.ts --apply  - create the edges and comments
 *
 * Idempotent: an edge that already exists is not created again, and a card that
 * already carries the preservation comment does not get a second one.
 */

import { execFileSync } from "node:child_process";

import chalk from "chalk";

import BlockedByField from "./backlog/BlockedByField";
import ProjectBoard from "./utils/ProjectBoard";

const REPO = "jlaustill/c-next";

const MARKER = "<!-- blocked-by-migration #1893 -->";

/**
 * Edges `BlockedByField.parse` finds that the same field text withdraws. Not
 * derivable: the withdrawal is prose, so each one is an owner ruling.
 */
const WITHDRAWN: { card: number; blocker: number; why: string }[] = [
  {
    card: 1668,
    blocker: 1780,
    why: '#1893 owner ruling 1: the field ends "#1780 no longer gates it"',
  },
];

interface ICard {
  number: number;
  text: string;
  existing: number[];
}

function gh(args: string[]): string {
  return execFileSync("gh", args, {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Every board card whose `Blocked by` is non-empty, open and closed. */
function cardsWithText(projectId: string): ICard[] {
  const cards: ICard[] = [];
  let cursor = "";
  for (;;) {
    const page = ProjectBoard.graphql(
      `
      query($projectId: ID!, $cursor: String) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                content {
                  ... on Issue {
                    number
                    repository { nameWithOwner }
                    blockedBy(first: 50) { totalCount nodes { number } }
                  }
                }
                blocked: fieldValueByName(name: "${ProjectBoard.BLOCKED_FIELD}") {
                  ... on ProjectV2ItemFieldTextValue { text }
                }
              }
            }
          }
        }
      }
    `,
      cursor === "" ? { projectId } : { projectId, cursor },
    ) as unknown as {
      node: {
        items: {
          pageInfo: { hasNextPage: boolean; endCursor: string };
          nodes: {
            content: {
              number?: number;
              repository?: { nameWithOwner: string };
              blockedBy?: { totalCount: number; nodes: { number: number }[] };
            } | null;
            blocked: { text?: string } | null;
          }[];
        };
      };
    };
    for (const node of page.node.items.nodes) {
      const text = node.blocked?.text ?? "";
      const content = node.content;
      if (text === "" || content?.number === undefined) {
        continue;
      }
      if (content.repository?.nameWithOwner !== REPO) {
        throw new Error(`#${content.number} is not in ${REPO}`);
      }
      const blockedBy = content.blockedBy ?? { totalCount: 0, nodes: [] };
      if (blockedBy.totalCount > blockedBy.nodes.length) {
        throw new Error(`#${content.number} has more than 50 built-in edges`);
      }
      cards.push({
        number: content.number,
        text,
        existing: blockedBy.nodes.map((n) => n.number),
      });
    }
    if (!page.node.items.pageInfo.hasNextPage) {
      return cards.sort((a, b) => a.number - b.number);
    }
    cursor = page.node.items.pageInfo.endCursor;
  }
}

function claimed(card: ICard): number[] {
  return BlockedByField.parse(card.text).filter(
    (blocker) =>
      !WITHDRAWN.some((w) => w.card === card.number && w.blocker === blocker),
  );
}

function issueId(issue: number): number {
  const out = gh(["api", `repos/${REPO}/issues/${issue}`, "--jq", ".id"]);
  return Number(out.trim());
}

function hasPreservationComment(card: number): boolean {
  const out = gh([
    "api",
    "--paginate",
    `repos/${REPO}/issues/${card}/comments?per_page=100`,
    "--jq",
    `.[] | select(.body | contains("${MARKER}")) | .id`,
  ]);
  return out.trim() !== "";
}

function preservationBody(card: ICard, edges: number[]): string {
  const quoted = card.text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  const withdrawn = WITHDRAWN.filter((w) => w.card === card.number).map(
    (w) => `\n\nNot created: #${w.blocker} (${w.why}).`,
  );
  const list =
    edges.length === 0
      ? "none: the text names no blocking card"
      : edges.map((e) => `#${e}`).join(", ");
  return `${MARKER}
**This card's \`Blocked by\` text, preserved 2026-10-06 (#1893).** The board's free-text \`Blocked by\` field is being deleted (#1893 owner ruling 2). Blockers are now GitHub's built-in "Blocked by" relationship on the issue sidebar. The field's value on this card, verbatim:

${quoted}

Built-in blocked-by relationships for the blockers it claims: ${list}.${withdrawn.join("")}`;
}

function run(apply: boolean): number {
  // By owner and number, not `findProject`: that reads the token's own
  // boards, and a session token is not the board owner's.
  const board = (
    ProjectBoard.graphql(
      `query { user(login: "jlaustill") { projectV2(number: 1) { id title } } }`,
    ) as unknown as { user: { projectV2: { id: string; title: string } } }
  ).user.projectV2;
  if (board.title !== ProjectBoard.TITLE) {
    console.error(
      chalk.red(`Board 1 is "${board.title}", not "${ProjectBoard.TITLE}".`),
    );
    return 1;
  }
  const cards = cardsWithText(board.id);
  let claimedTotal = 0;
  let alreadyThere = 0;
  let created = 0;
  let comments = 0;
  for (const card of cards) {
    const edges = claimed(card);
    claimedTotal += edges.length;
    const missing = edges.filter((e) => !card.existing.includes(e));
    alreadyThere += edges.length - missing.length;
    console.log(
      `#${card.number}: claims ${edges.map((e) => `#${e}`).join(" ") || "-"}` +
        (missing.length < edges.length
          ? chalk.dim(
              `  (exists: ${edges
                .filter((e) => !missing.includes(e))
                .map((e) => `#${e}`)
                .join(" ")})`,
            )
          : ""),
    );
    if (!apply) {
      continue;
    }
    for (const blocker of missing) {
      gh([
        "api",
        "-X",
        "POST",
        `repos/${REPO}/issues/${card.number}/dependencies/blocked_by`,
        "-F",
        `issue_id=${issueId(blocker)}`,
        "--silent",
      ]);
      created += 1;
    }
    if (!hasPreservationComment(card.number)) {
      gh([
        "api",
        `repos/${REPO}/issues/${card.number}/comments`,
        "-f",
        `body=${preservationBody(card, edges)}`,
        "--silent",
      ]);
      comments += 1;
    }
  }

  console.log(
    `\n${cards.length} cards with text; ${claimedTotal} claimed edges ` +
      `(${WITHDRAWN.length} withdrawn by ruling); ${alreadyThere} already built-in.`,
  );
  if (!apply) {
    console.log(chalk.yellow("Dry run: nothing written. Re-run with --apply."));
    return 0;
  }
  console.log(`Created ${created} edges and ${comments} comments.`);

  const after = cardsWithText(board.id);
  let mismatches = 0;
  for (const card of after) {
    const missing = claimed(card).filter((e) => !card.existing.includes(e));
    if (missing.length > 0) {
      mismatches += 1;
      console.error(
        chalk.red(`#${card.number} still lacks ${missing.join(", ")}`),
      );
    }
  }
  if (after.length !== cards.length || mismatches > 0) {
    console.error(chalk.red("Re-read does not match the claimed edges."));
    return 1;
  }
  console.log(
    chalk.green(
      "Re-read: every claimed edge exists as a built-in relationship.",
    ),
  );
  return 0;
}

process.exitCode = run(process.argv.includes("--apply"));
