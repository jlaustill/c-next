/**
 * Issue #1893: blockers are GitHub's built-in "Blocked by" relationship, and
 * the board's free-text `Blocked by` field is retired.
 *
 * The readers that matter most are not code. `/issue-check` and `/start-issue`
 * are prompts, so no type checker sees them: a skill that kept querying the
 * old field would read every card as unblocked, in silence, once the field is
 * gone -- the failure the migration exists to end. So the rule is checked
 * against the text itself, both ways: nothing tracked still reads the field,
 * and each skill that decides blocked-ness still reads the relationship.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The spellings of a read of the retired board field. */
const FIELD_READ =
  /field\.name\s*==\s*"Blocked by"|fieldValueByName\(\s*name:\s*"Blocked by"|BLOCKED_FIELD/;

/** A read of the built-in relationship, by GraphQL or by REST. */
const RELATIONSHIP_READ = /blockedBy\(first:|dependencies\/blocked_by/;

/** The skills that decide whether a card is blocked. */
const DECIDERS = [
  ".claude/skills/issue-check/SKILL.md",
  ".claude/skills/start-issue/SKILL.md",
];

const SELF = "scripts/__tests__/blocked-by-source.test.ts";

function tracked(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
    .split("\n")
    .filter((path) => /\.(ts|md|ya?ml|sh)$/.test(path) && path !== SELF);
}

describe("the spellings this file recognizes", () => {
  it.each([
    ['[.fieldValues.nodes[]|select(.field.name=="Blocked by")|.text]'],
    ['blocked: fieldValueByName(name: "Blocked by") {'],
    ["ProjectBoard.BLOCKED_FIELD"],
  ])("reports a read of the retired field: %s", (line) => {
    expect(FIELD_READ.test(line)).toBe(true);
  });

  it.each([
    ['select(.field.name=="Status")'],
    ['"Blocked by" is the built-in relationship'],
  ])("passes a line that does not read it: %s", (line) => {
    expect(FIELD_READ.test(line)).toBe(false);
  });

  it.each([
    [
      "content { ... on Issue { number blockedBy(first: 50) { nodes { number } } } }",
    ],
    [
      "gh api --paginate 'repos/o/r/issues/1/dependencies/blocked_by?per_page=100'",
    ],
  ])("recognizes a read of the relationship: %s", (line) => {
    expect(RELATIONSHIP_READ.test(line)).toBe(true);
  });
});

describe("blockers are read from the built-in relationship (#1893)", () => {
  it("nothing tracked reads the retired board field", () => {
    const readers = tracked().filter((path) =>
      FIELD_READ.test(readFileSync(join(repoRoot, path), "utf8")),
    );
    expect(readers).toEqual([]);
  });

  it.each(DECIDERS)("%s reads the built-in relationship", (path) => {
    expect(readFileSync(join(repoRoot, path), "utf8")).toMatch(
      RELATIONSHIP_READ,
    );
  });
});
