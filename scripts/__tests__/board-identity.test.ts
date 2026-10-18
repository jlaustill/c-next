/**
 * Issue #2189: the board is `ProjectBoard.OWNER` / `ProjectBoard.NUMBER`, and
 * it is written with the smeltworks board GitHub App, not a personal token.
 *
 * Three copies of where the board is cannot import that declaration:
 * `project-sync.yml`'s env, and the GraphQL in the `start-issue` and
 * `issue-check` skills. They are prompts and YAML, so no type checker sees
 * them, and a stale copy fails in silence -- a skill polling the old board
 * reads every card as "not on board" while the real one moves. So each copy is
 * checked against the declaration by spelling, the way blocked-by-source.test.ts
 * checks the skills' reads of "Blocked by".
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import ProjectBoard from "../utils/ProjectBoard";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** A board looked up under a user account: the pre-#2189 location. */
const USER_BOARD = /user\(login:[^)]*\)\s*\{\s*projects?V2/;

/** A board read by owner and number, capturing both. */
const BOARD_READ =
  /organization\(login:\s*"([^"]+)"\)\s*\{\s*projectV2\(number:\s*(\d+)\)/g;

/** A workflow reading the retired personal token. */
const TOKEN_READ = /secrets\.PROJECT_TOKEN\b/;

/** The workflows that write the board. */
const WRITERS = [
  ".github/workflows/project-sync.yml",
  ".github/workflows/backlog-order.yml",
];

/** The skills that read the board. */
const READERS = [
  ".claude/skills/issue-check/SKILL.md",
  ".claude/skills/start-issue/SKILL.md",
];

const SELF = "scripts/__tests__/board-identity.test.ts";

/** History is allowed to name the old board; nothing that runs is. */
const HISTORY = /^(CHANGELOG\.md|docs\/archive\/|docs\/plans\/)/;

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function tracked(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
    .split("\n")
    .filter(
      (path) =>
        /\.(ts|md|ya?ml|sh)$/.test(path) &&
        path !== SELF &&
        !HISTORY.test(path),
    );
}

describe("the spellings this file recognizes", () => {
  it.each([
    ['query { user(login: "jlaustill") { projectV2(number: 1) {'],
    ["user(login: $owner) {\n  projectsV2(first: 100, after: $endCursor) {"],
  ])("reports a board under a user account: %s", (line) => {
    expect(USER_BOARD.test(line)).toBe(true);
  });

  it.each([
    ['organization(login: "smeltworks") { projectV2(number: 1) {'],
    ["user(login: $owner) { id }"],
  ])("passes a line that is not a user's board: %s", (line) => {
    expect(USER_BOARD.test(line)).toBe(false);
  });

  it("captures the owner and number of a board read", () => {
    const [match] =
      'organization(login: "smeltworks") { projectV2(number: 7) {'.matchAll(
        BOARD_READ,
      );
    expect(match?.slice(1)).toEqual(["smeltworks", "7"]);
  });

  it.each([["GH_TOKEN: ${{ secrets.PROJECT_TOKEN }}"]])(
    "reports a read of the retired token: %s",
    (line) => {
      expect(TOKEN_READ.test(line)).toBe(true);
    },
  );

  it.each([["# Until #2189 this was PROJECT_TOKEN, a classic PAT"]])(
    "passes prose that only names it: %s",
    (line) => {
      expect(TOKEN_READ.test(line)).toBe(false);
    },
  );
});

describe("every copy of the board's identity", () => {
  it("project-sync.yml names ProjectBoard's owner and number", () => {
    const workflow = read(".github/workflows/project-sync.yml");
    expect(/^\s+PROJECT_OWNER:\s*(\S+)\s*$/m.exec(workflow)?.[1]).toBe(
      ProjectBoard.OWNER,
    );
    expect(Number(/^\s+PROJECT_NUMBER:\s*(\d+)\s*$/m.exec(workflow)?.[1])).toBe(
      ProjectBoard.NUMBER,
    );
  });

  it.each(READERS)("%s reads ProjectBoard's board", (path) => {
    const reads = [...read(path).matchAll(BOARD_READ)].map((match) =>
      match.slice(1),
    );
    expect(reads.length).toBeGreaterThan(0);
    for (const [owner, number] of reads) {
      expect(owner).toBe(ProjectBoard.OWNER);
      expect(Number(number)).toBe(ProjectBoard.NUMBER);
    }
  });

  it("nothing tracked looks a board up under a user account", () => {
    const offenders = tracked().filter((path) => USER_BOARD.test(read(path)));
    expect(offenders).toEqual([]);
  });
});

describe("the board's writers use the GitHub App", () => {
  it("no workflow reads the retired PROJECT_TOKEN", () => {
    const offenders = tracked()
      .filter((path) => path.startsWith(".github/workflows/"))
      .filter((path) => TOKEN_READ.test(read(path)));
    expect(offenders).toEqual([]);
  });

  it.each(WRITERS)("%s mints the board token from the app", (path) => {
    const workflow = read(path);
    expect(workflow).toMatch(/uses: actions\/create-github-app-token@/);
    expect(workflow).toMatch(/app-id: \$\{\{ vars\.BOARD_APP_ID \}\}/);
    expect(workflow).toMatch(
      /private-key: \$\{\{ secrets\.BOARD_APP_PRIVATE_KEY \}\}/,
    );
  });
});
