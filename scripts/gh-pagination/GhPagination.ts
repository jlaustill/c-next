import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import IGhCommand from "../types/IGhCommand";
import IGhPaginationOutcome from "../types/IGhPaginationOutcome";
import IGhPaginationViolation from "../types/IGhPaginationViolation";

/**
 * Every `gh` read in this repository must be bounded, and must be able to tell
 * when its bound was reached (issue #1416).
 *
 * `gh issue list` and `gh pr list` default to 30 items. The REST API defaults to
 * 30 per page. Neither says so: a filter over a truncated page returns a shorter
 * answer, not an error, so the caller reads "nothing matched" where the truth is
 * "nothing matched on page one".
 *
 * This has now happened twice in the same file. The first time, `/issue-check`
 * ranked 50 of 213 open issues. The second time, its in-flight detector reported
 * no assigned issues while #1449 was assigned, in `WIP`, and had a "Starting
 * work" comment 34 minutes old -- and it recommended that issue as free work.
 *
 * The recurrence is the argument for a gate rather than a rule. The first fix
 * landed a comment saying `gh` "returns the most recently updated first", which
 * is false -- both list commands return CREATED-descending. Believing otherwise
 * makes an *assigned* issue feel safe unbounded, because an assigned issue is
 * active by definition. The wrong mechanism sat six lines above the next
 * instance of the bug and read as a reason it could not happen.
 *
 * There is no exemption mechanism and no write mode, for the reason
 * `AdrIndependence` gives: a gate that can be opted out of eventually is.
 *
 * KNOWN LIMIT: this is a text scanner. A paginator assembled programmatically is
 * invisible to it -- `release-milestones.ts` and `setup-project.ts` build argv
 * arrays and hand-roll correct `hasNextPage` loops, and would stay silent if
 * they did not. Nested connection caps (`fieldValues(first: 20)` on a board that
 * has 14 fields) are likewise out of reach: `--paginate` cannot advance an inner
 * connection, so there is no flag whose absence would prove anything. Those need
 * a reader, and headroom recorded where they are written.
 */
class GhPagination {
  /**
   * How far a command may run past its first line. Bounded so that one stray
   * apostrophe in prose swallows a window rather than the rest of the file.
   */
  static readonly LOOKAHEAD = 40;

  /**
   * What starts a command. Deliberately wider than the rules below -- every
   * subcommand, not only the ones that can fail -- so that narrowing happens in
   * `classify`, where it is visible, rather than here where a miss is silent.
   */
  static readonly INVOCATION_SOURCE =
    "(?<![\\w.$-])gh\\s+(?:api|issue|pr|run|release|workflow|cache|search)\\b";

  /** A read that returns a page: `gh <thing> list`, or a `gh search` subcommand. */
  static readonly LIST_COMMAND =
    /^gh\s+(?:issue|pr|run|release|workflow|cache)\s+list\b|^gh\s+search\s+(?:issues|prs|repos|code|commits)\b/;

  /** `--limit N` or `-L N`. `-L` must not be the tail of a longer flag. */
  static readonly LIMIT = /(?:--limit|(?<![\w-])-L)[= ]\s*\d+/;

  /** A write cannot truncate a result set, because it does not read one. */
  static readonly WRITE = /(?:-X|--method)[= ]\s*(?:POST|PUT|PATCH|DELETE)\b/i;

  /** `gh api graphql`, which pages by cursor rather than by `--limit`. */
  static readonly GRAPHQL = /^gh\s+api\s+graphql\b/;

  /** Any other `gh api`, which pages by `--paginate`. */
  static readonly REST = /^gh\s+api\b/;

  /** A numeric connection cap inside a GraphQL query. */
  static readonly CONNECTION_CAP = /(?:first|last):\s*\d+/;

  /**
   * `--paginate` advances a cursor variable named `$endCursor` and no other. A
   * query that pages on `$cursor` compiles, runs, and re-fetches page one
   * forever -- `after` stays null, nothing errors, nothing terminates.
   */
  static readonly END_CURSOR = /\$endCursor\b/;

  /**
   * Path segments that name a collection. The discriminator is the LAST segment:
   * `issues/1449` is one issue and cannot truncate, `issues/1449/comments` is a
   * page of comments and can.
   */
  static readonly COLLECTION_SEGMENTS: ReadonlySet<string> = new Set([
    "artifacts",
    "assignees",
    "branches",
    "checks",
    "collaborators",
    "comments",
    "commits",
    "contributors",
    "deployments",
    "environments",
    "events",
    "forks",
    "issues",
    "jobs",
    "labels",
    "members",
    "milestones",
    "notifications",
    "projects",
    "pulls",
    "releases",
    "repos",
    "reviews",
    "rulesets",
    "runs",
    "secrets",
    "stargazers",
    "statuses",
    "subscribers",
    "tags",
    "teams",
    "variables",
    "workflows",
  ]);

  /**
   * Whether a line is prose rather than something anyone runs. Covers a shell or
   * YAML `#`, a TypeScript `//`, and a doc-comment `*` -- this file's own header
   * writes `gh api` in prose, and so do three comments in the skills that exist
   * precisely to describe the trap.
   */
  static isProse(line: string, column: number): boolean {
    if (line.slice(0, column).includes("#")) return true;
    return /^\s*(?:\*|\/\/)/.test(line);
  }

  /**
   * Whether the command so far is unfinished. A trailing `\` and an unclosed
   * single quote are the same fact -- more lines belong to this command -- so
   * one predicate covers shell continuations and the multi-line `-f query='…'`
   * bodies the board queries are written with.
   */
  static isOpen(text: string): boolean {
    if (/\\$/.test(text.trimEnd())) return true;
    const quotes = text.match(/(?<!\\)'/g);
    return quotes !== null && quotes.length % 2 === 1;
  }

  /** Every invocation in one file, continuation lines joined. */
  static commandsIn(text: string): IGhCommand[] {
    const commands: IGhCommand[] = [];
    const lines = text.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
      const finder = new RegExp(GhPagination.INVOCATION_SOURCE, "g");
      let match = finder.exec(lines[index]);
      while (match !== null) {
        if (!GhPagination.isProse(lines[index], match.index)) {
          commands.push({
            line: index + 1,
            text: GhPagination.join(lines, index, match.index),
          });
        }
        match = finder.exec(lines[index]);
      }
    }

    return commands;
  }

  /** One command's text, consuming following lines while it stays open. */
  static join(lines: string[], start: number, column: number): string {
    let text = lines[start].slice(column);
    let index = start;

    while (
      GhPagination.isOpen(text) &&
      index - start < GhPagination.LOOKAHEAD &&
      index + 1 < lines.length
    ) {
      const next = lines[index + 1];
      if (/^\s*```/.test(next)) break;
      text = `${text.trimEnd().replace(/\\$/, "")}\n${next}`;
      index += 1;
    }

    return text;
  }

  /**
   * The API path a `gh api` call reads: the first path-shaped non-flag token.
   *
   * Quotes come off BEFORE the shape test, not after. A path is quoted exactly
   * when it carries a query string -- `'…/comments?per_page=100'` -- so testing
   * the quoted form would return null for every paginated call and report it
   * sound because the path was unreadable, not because a bound was found. That
   * is a guard passing for a reason unrelated to what it asserts.
   */
  static apiPath(command: string): string | null {
    const tokens = command.replace(GhPagination.REST, "").split(/\s+/);

    for (const token of tokens) {
      const bare = token.replace(/^["']|["']$/g, "");
      if (bare.startsWith("-")) continue;
      if (/^[A-Za-z][\w.-]*(?:\/[^\s'"|)]+)+/.test(bare)) return bare;
    }

    return null;
  }

  /** Whether a path returns a page rather than a single resource. */
  static isCollection(path: string): boolean {
    if (path.includes("?")) return true;
    const segments = path.split("/").filter((segment) => segment.length > 0);
    const last = segments[segments.length - 1];
    return (
      last !== undefined &&
      GhPagination.COLLECTION_SEGMENTS.has(last.toLowerCase())
    );
  }

  /** Which bound a command is missing, or `null` when it is sound. */
  static classify(command: string): IGhPaginationViolation["kind"] | null {
    if (GhPagination.WRITE.test(command)) return null;

    if (GhPagination.LIST_COMMAND.test(command)) {
      return GhPagination.LIMIT.test(command) ? null : "unbounded-list";
    }

    if (GhPagination.GRAPHQL.test(command)) {
      if (!GhPagination.CONNECTION_CAP.test(command)) return null;
      if (!/--paginate\b/.test(command)) return "unpaginated-graphql";
      return GhPagination.END_CURSOR.test(command)
        ? null
        : "unpaginated-graphql";
    }

    if (GhPagination.REST.test(command)) {
      const path = GhPagination.apiPath(command);
      if (path === null || !GhPagination.isCollection(path)) return null;
      return /--paginate\b/.test(command) ? null : "unpaginated-collection";
    }

    return null;
  }

  /** Every violation in one file's text. */
  static scanFile(file: string, text: string): IGhPaginationViolation[] {
    const violations: IGhPaginationViolation[] = [];

    for (const command of GhPagination.commandsIn(text)) {
      const kind = GhPagination.classify(command.text);
      if (kind === null) continue;
      violations.push({
        file,
        line: command.line,
        kind,
        detail: command.text.replace(/\s+/g, " ").trim().slice(0, 120),
      });
    }

    return violations;
  }

  /**
   * Tracked files that could hold an invocation. Derived from `git grep`, never
   * a maintained list, and matched on a string far broader than the rules -- a
   * candidate filter that shares the rules' regex would hide files exactly the
   * way the defect under gate hides issues.
   */
  static candidates(rootDir: string): string[] {
    try {
      const found = execFileSync("git", ["grep", "-lIF", "gh ", "--", "."], {
        cwd: rootDir,
        encoding: "utf-8",
        maxBuffer: 64 * 1024 * 1024,
      });
      return found.split("\n").filter((line) => line.length > 0);
    } catch (error) {
      // `git grep -l` exits 1 for "no matches", which is clean. Anything else is
      // a real failure and must not be reported as an empty, passing scan.
      if ((error as { status?: number }).status === 1) return [];
      throw error;
    }
  }

  static run(rootDir: string): IGhPaginationOutcome {
    const failures: IGhPaginationViolation[] = [];
    let scanned = 0;

    for (const file of GhPagination.candidates(rootDir).sort()) {
      scanned += 1;
      failures.push(
        ...GhPagination.scanFile(
          file,
          readFileSync(join(rootDir, file), "utf-8"),
        ),
      );
    }

    return { failures, scanned };
  }
}

export default GhPagination;
