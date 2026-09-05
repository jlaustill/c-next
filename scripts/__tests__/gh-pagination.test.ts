import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import GhPagination from "../gh-pagination/GhPagination";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Every fixture below is assembled through `GH` rather than written literally.
 *
 * This file is a tracked file, so the repository scan at the bottom reads it the
 * same as any other -- and an unbounded command written out in full here would
 * be a real violation, because a command in a committed file is ready to copy
 * and run whatever its surrounding prose claims. Building the text from a variable
 * how a test about broken commands avoids containing one.
 */
const GH = "gh";

function kinds(text: string): string[] {
  return GhPagination.scanFile("fixture.md", text).map(
    (violation) => violation.kind,
  );
}

describe("GhPagination — list commands default to 30", () => {
  it.each([
    ["issue list", `${GH} issue list --state open --json number`],
    ["pr list", `${GH} pr list --state open --json number`],
    ["run list", `${GH} run list --workflow=x.yml`],
    ["search issues", `${GH} search issues --owner jlaustill`],
  ])("flags an unbounded %s", (_name, command) => {
    expect(kinds(command)).toEqual(["unbounded-list"]);
  });

  it.each([
    ["--limit", `${GH} issue list --state open --limit 1000 --json number`],
    ["-L", `${GH} issue list --state open -L 5 --json number`],
    ["--limit=", `${GH} pr list --limit=200 --json number`],
  ])("accepts a list bounded with %s", (_name, command) => {
    expect(kinds(command)).toEqual([]);
  });
});

describe("GhPagination — REST collections page at 30", () => {
  it.each([
    [
      "a nested comments collection",
      `${GH} api repos/o/r/issues/1449/comments`,
    ],
    ["a query string", `${GH} api repos/o/r/issues?state=open`],
    ["a bare collection", `${GH} api repos/o/r/rulesets`],
    [
      "a quoted path with per_page",
      `${GH} api 'repos/o/r/issues/1/comments?per_page=100'`,
    ],
  ])("flags %s with no --paginate", (_name, command) => {
    expect(kinds(command)).toEqual(["unpaginated-collection"]);
  });

  it.each([
    ["a single issue", `${GH} api repos/o/r/issues/1449 --jq '.state'`],
    ["a single repo", `${GH} api repos/o/r --jq '.description'`],
    [
      "a paginated collection",
      `${GH} api --paginate 'repos/o/r/issues/1/comments?per_page=100'`,
    ],
  ])("accepts %s", (_name, command) => {
    expect(kinds(command)).toEqual([]);
  });

  // The negative control. A write cannot truncate a result set, and without this
  // exclusion the assignee POST in start-issue is a false positive -- the only
  // one the rules produced across the whole repository.
  it("does not flag a write to a collection", () => {
    expect(
      kinds(`${GH} api -X POST repos/o/r/issues/1/assignees -f x=y`),
    ).toEqual([]);
  });
});

describe("GhPagination — GraphQL pages by cursor, not by --limit", () => {
  const query = "items(first: 100, after: $CURSOR) { nodes { id } }";

  it("flags a connection cap with no --paginate", () => {
    expect(kinds(`${GH} api graphql -f query='${query}'`)).toEqual([
      "unpaginated-graphql",
    ]);
  });

  // --paginate advances $endCursor and no other name. On $cursor the query
  // compiles, runs, and re-fetches page one forever: `after` stays null,
  // nothing errors, nothing terminates.
  it("flags --paginate driving a cursor that is not $endCursor", () => {
    expect(kinds(`${GH} api graphql --paginate -f query='${query}'`)).toEqual([
      "unpaginated-graphql",
    ]);
  });

  it("accepts --paginate driving $endCursor", () => {
    const paged = query.replace("$CURSOR", "$endCursor");
    expect(kinds(`${GH} api graphql --paginate -f query='${paged}'`)).toEqual(
      [],
    );
  });

  it("accepts a query with no connection cap", () => {
    expect(kinds(`${GH} api graphql -f query='{ viewer { login } }'`)).toEqual(
      [],
    );
  });
});

describe("GhPagination — commands span lines two ways", () => {
  it("sees a --limit on a backslash continuation", () => {
    expect(
      kinds(`${GH} issue list --state open \\\n  --limit 1000 --json number`),
    ).toEqual([]);
  });

  it("sees a connection cap inside a multi-line quoted query body", () => {
    const command = `${GH} api graphql -f query='\nquery {\n  items(first: 100) { nodes { id } }\n}'`;
    expect(kinds(command)).toEqual(["unpaginated-graphql"]);
  });

  it("reports the line the command starts on, not where it ends", () => {
    const text = `intro\nfiller\n${GH} issue list --state open \\\n  --json number`;
    expect(GhPagination.scanFile("fixture.md", text)).toMatchObject([
      { line: 3, kind: "unbounded-list" },
    ]);
  });

  it("stops joining at a fence rather than running on", () => {
    const text = `${GH} api graphql -f query='\n\`\`\`\nitems(first: 100)`;
    expect(kinds(text)).toEqual([]);
  });
});

describe("GhPagination — prose is not a command", () => {
  it.each([
    ["a shell comment", `# ${GH} issue list --state open`],
    ["a TypeScript comment", `// ${GH} issue list --state open`],
    ["a doc-comment line", ` * ${GH} api repos/o/r/issues?state=open`],
    ["a trailing comment", `run something  # ${GH} pr list --state open`],
  ])("ignores %s", (_name, text) => {
    expect(kinds(text)).toEqual([]);
  });
});

describe("GhPagination — the repository", () => {
  const outcome = GhPagination.run(repoRoot);

  // Guards the selector so the assertion below cannot pass vacuously. A broken
  // candidate filter would otherwise report a clean repository -- the same
  // silent-truncation shape this gate exists to catch, one level up.
  it("finds candidate files to scan at all", () => {
    expect(outcome.scanned).toBeGreaterThan(100);
  });

  it("has no unbounded gh read", () => {
    expect(
      outcome.failures.map(
        (violation) => `${violation.file}:${violation.line} ${violation.kind}`,
      ),
    ).toEqual([]);
  });
});
