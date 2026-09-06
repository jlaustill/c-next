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
 * and run whatever its surrounding prose claims. Building the text from a
 * variable is how a test about broken commands avoids containing one.
 *
 * It applies to TEST NAMES and describe titles too, and to any prose naming a
 * subcommand -- three case labels and one title were written out in full here
 * and the repository scan at the bottom reported all four. Markdown has
 * backticks to mark prose; TypeScript has nothing, so a string mentioning
 * `${GH} api` is indistinguishable from one running it. That is the cost of
 * reporting an unreadable path rather than passing it, and it is the cheap
 * side of the trade: rewording is free, a silent miss is not.
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

  // A cap nested inside SINGULAR selections is reported, and rightly: it pages.
  // Measured 2026-09-06 against the live API -- `--paginate` with `$endCursor`
  // advanced `repository(...) { issues(first: 2, after: $endCursor) }`, a
  // connection two levels down, and returned twelve issues from a page size of
  // two. Raised in review as a false positive with no available fix; the fix is
  // the ordinary one, so the case stays flagged and the measurement is recorded
  // rather than the claim being taken on. What is genuinely out of reach is a
  // cap inside another CONNECTION, which would need one cursor per outer item.
  it("flags a connection nested inside a singular selection", () => {
    const nested = `query($id: ID!) { node(id: $id) { fieldValues(first: 100) { nodes { id } } } }`;
    expect(kinds(`${GH} api graphql -f query='${nested}'`)).toEqual([
      "unpaginated-graphql",
    ]);
  });

  it("accepts that same nested query once it actually pages", () => {
    const paged = `query($id: ID!, $endCursor: String) { node(id: $id) { fieldValues(first: 100, after: $endCursor) { pageInfo { hasNextPage } nodes { id } } } }`;
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

  // A bound must come from the command it bounds. One stray apostrophe in a
  // trailing comment left the quote count odd, ran the joiner into the NEXT
  // command, and absorbed its --paginate -- so an unpaginated collection read
  // classified as sound and the file reported clean. The gate's own defect,
  // and the reason a new invocation ends the previous one regardless of quotes.
  it("does not let one command borrow the next command's --paginate", () => {
    const text = [
      `${GH} api repos/o/r/issues/1/comments   # don't do this`,
      `${GH} api --paginate 'repos/o/r/pulls?per_page=100'`,
    ].join("\n");
    expect(GhPagination.scanFile("run.sh", text)).toMatchObject([
      { line: 1, kind: "unpaginated-collection" },
    ]);
  });
});

describe("GhPagination — prose is not a command", () => {
  it.each([
    ["a full-line shell comment", `# ${GH} issue list --state open`],
    ["a TypeScript comment", `// ${GH} issue list --state open`],
    ["a doc-comment line", ` * ${GH} api repos/o/r/issues?state=open`],
    ["markdown inline code", `Never write \`${GH} issue list\` unbounded.`],
    [
      "two inline spans on one line",
      `\`${GH} issue list\` and \`${GH} pr list\` default to 30.`,
    ],
  ])("ignores %s", (_name, text) => {
    expect(kinds(text)).toEqual([]);
  });

  // Controls. Each of the three was a live FALSE NEGATIVE found by probing
  // shapes the corpus does not contain; a gate that misses is worse than one
  // that over-reports, so each rule is only as wide as the corpus proves safe.
  it.each([
    [
      "a # inside a string, not a comment",
      `echo "#1"; ${GH} issue list --state open`,
    ],
    [
      "a real command, plainly indented",
      `  ${GH} issue list --state open --json number`,
    ],
  ])("still flags %s", (_name, text) => {
    expect(kinds(text)).toEqual(["unbounded-list"]);
  });

  it("still flags backtick command substitution outside markdown", () => {
    expect(
      GhPagination.scanFile(
        "run.sh",
        `X=\`${GH} issue list --state open\``,
      ).map((violation) => violation.kind),
    ).toEqual(["unbounded-list"]);
  });

  it("applies the inline-code rule only to markdown", () => {
    const inline = `Never write \`${GH} issue list\` unbounded.`;
    expect(kinds(inline)).toEqual([]);
    expect(GhPagination.scanFile("run.sh", inline)).toHaveLength(1);
  });
});

/**
 * Every case in the next four blocks was a live FALSE NEGATIVE, found in code
 * review by probing shapes this repository does not contain rather than by
 * reading the scanner. Each one ran green through `scanFile` before the fix, so
 * each is now a control against that fix regressing.
 */
describe("GhPagination — finding the endpoint in a REST invocation", () => {
  // Settled by `tokenize`: the header value stays whole and fails the path
  // shape at its colon. Splitting on whitespace left its second half standing
  // where an endpoint belongs, and a media type is path-shaped.
  it("does not mistake a header VALUE for the path", () => {
    const command = `${GH} api -H "Accept: application/vnd.github+json" repos/o/r/issues`;
    expect(GhPagination.apiPath(command)).toBe("repos/o/r/issues");
    expect(kinds(command)).toEqual(["unpaginated-collection"]);
  });

  // Settled by `VALUE_FLAGS`, and by nothing else -- this is the case that
  // reddens when it is reverted. A local file path is path-shaped, so without
  // the skip `apiPath` answers `notes/body.json`, whose last segment is not a
  // collection, and the real collection read passes as a single resource.
  // The case above stays green under that same revert, which is why it is not
  // the control it looks like.
  it.each([
    ["--input", `${GH} api --input notes/body.json repos/o/r/issues`],
    ["--template", `${GH} api --template repos/o/r/pulls repos/o/r/issues`],
  ])("does not mistake a path-shaped %s value for the path", (_n, command) => {
    expect(GhPagination.apiPath(command)).toBe("repos/o/r/issues");
    expect(kinds(command)).toEqual(["unpaginated-collection"]);
  });

  it("reads a path written with the leading slash gh accepts", () => {
    expect(GhPagination.apiPath(`${GH} api /repos/o/r/issues`)).toBe(
      "repos/o/r/issues",
    );
    expect(
      kinds(`${GH} api /repos/o/r/issues/1/comments --jq '.[].body'`),
    ).toEqual(["unpaginated-collection"]);
  });

  // An unreadable path is not a single resource, and reading it as one is how
  // both misses above stayed quiet. Reporting makes the token walk
  // self-verifying: a regression turns the gate red instead of silent.
  it("reports an endpoint it cannot read rather than passing it", () => {
    expect(kinds(`${GH} api "$ENDPOINT"`)).toEqual(["unreadable-path"]);
  });

  // ...and the report always has a fix, because --paginate settles it either
  // way: required on a collection, harmless on a single resource.
  it("accepts an unreadable endpoint that pages anyway", () => {
    expect(kinds(`${GH} api --paginate "$ENDPOINT"`)).toEqual([]);
  });
});

describe("GhPagination — a collection segment must be one GitHub serves", () => {
  it.each([
    ["check-runs", `${GH} api repos/o/r/commits/abc/check-runs`],
    ["check-suites", `${GH} api repos/o/r/commits/abc/check-suites`],
    ["pull request files", `${GH} api repos/o/r/pulls/1/files`],
    ["an issue timeline", `${GH} api repos/o/r/issues/1/timeline`],
  ])("flags %s", (_name, command) => {
    expect(kinds(command)).toEqual(["unpaginated-collection"]);
  });

  // `checks` sat in the set and is not a path GitHub serves, so it could never
  // match while both real collections read as single resources. An invented
  // segment is worse than a missing one: it looks like coverage.
  it("carries the real segments, not the one that never existed", () => {
    expect(GhPagination.COLLECTION_SEGMENTS.has("checks")).toBe(false);
    expect(GhPagination.COLLECTION_SEGMENTS.has("check-runs")).toBe(true);
  });
});

describe("GhPagination — list-shaped subcommands not spelled `list`", () => {
  it.each([
    [
      `${GH} project item-list`,
      `${GH} project item-list 1 --owner jlaustill --format json`,
    ],
    [`${GH} repo list`, `${GH} repo list jlaustill --json name`],
    [`${GH} label list`, `${GH} label list --json name`],
  ])("flags an unbounded %s", (_name, command) => {
    expect(kinds(command)).toEqual(["unbounded-list"]);
  });

  it("accepts one that is bounded", () => {
    expect(
      kinds(`${GH} project item-list 1 --limit 1000 --format json`),
    ).toEqual([]);
  });

  // Controls. These subcommands are visible to the scanner now, so a write or a
  // non-list read through one must stay silent; all three are live in this repo.
  it.each([
    [
      "a secret write",
      `${GH} secret set PROJECT_TOKEN --repo jlaustill/c-next`,
    ],
    ["a repo edit", `${GH} repo edit jlaustill/c-next --description x`],
    ["a repo clone", `${GH} repo clone jlaustill/c-next`],
  ])("does not flag %s", (_name, command) => {
    expect(kinds(command)).toEqual([]);
  });
});

describe("GhPagination — a bound may be a shell variable", () => {
  it.each([
    ["bare", `${GH} issue list --limit $LIMIT --json number`],
    ["quoted", `${GH} issue list --limit "$GH_ISSUE_LIMIT" --json number`],
    ["braced", `${GH} issue list --limit "\${LIMIT}" --json number`],
  ])("accepts a %s variable as the bound", (_name, command) => {
    expect(kinds(command)).toEqual([]);
  });

  // The control: a variable is a bound, an absent flag is not. Widening the
  // rule to accept `$LIMIT` must not make it accept nothing at all.
  it("still flags a list with no --limit of any kind", () => {
    expect(kinds(`${GH} issue list --state open --json number`)).toEqual([
      "unbounded-list",
    ]);
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
