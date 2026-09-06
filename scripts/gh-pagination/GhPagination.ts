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
 * they did not.
 *
 * KNOWN LIMIT, deliberate: a command inside a heredoc body is reported like any
 * other. No heredoc exists in this repository carrying a bounded-read command,
 * and the one that carries a `gh issue edit` is a write, so nothing is affected
 * today. It is left reported rather than parsed away because prompt text telling
 * someone to run an unbounded command is worth reporting on its own terms. If a
 * legitimate case ever appears, that is the moment to add heredoc tracking --
 * not before, when there would be no way to tell whether it worked.
 *
 * KNOWN LIMIT, and narrower than it first read: a cap nested inside ANOTHER
 * CONNECTION is out of reach. `fieldValues(first: 100)` sits inside
 * `items(first: 100)`, and advancing it would need one cursor per outer item,
 * which `--paginate` has no way to carry. Requiring a token like `totalCount`
 * there would demand a spelling without demanding the behavior -- this defect
 * one level up. Those need a reader and measured headroom instead.
 *
 * A cap nested inside SINGULAR selections is a different thing and is NOT out
 * of reach, so `classify` is right to require pagination of it. Measured
 * 2026-09-06 against the live API: `--paginate` with `$endCursor` advanced
 * `repository(...) { issues(first: 2, after: $endCursor) }` -- a connection two
 * levels down -- and returned twelve issues from a page size of two. So a
 * `node(id: $id) { ... fieldValues(first: 100) }` query is reported, and the
 * fix is the ordinary one: add `pageInfo`, `after: $endCursor`, `--paginate`.
 * This was raised as a false positive with no available fix; the fix exists,
 * and the measurement is recorded here because the claim was plausible.
 *
 * Every out-of-reach cap in this repository is accompanied by an outer cap on
 * the connection enclosing it, and that outer cap is what the rule fires on, so
 * the two cases have never yet had to be told apart in practice. Headroom
 * measured 2026-09-05, and the reason the first of these was raised in the same
 * commit:
 *
 *   fieldValues        14 of 20  -- 70%, `Blocked by` the 14th and last; raised
 *                                  to 100 in both skills
 *   board fields       14 of 50  -- raised to 100 in setup-project for one cap,
 *                                  not two, over the same field list
 *   projectsV2          1 of 100
 *   timelineItems       1 of 20  -- and `last:` takes the newest, so the end it
 *                                  drops is the one nobody reads
 *   closedByPRs         2 of 10
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
    "(?<![\\w.$-])gh\\s+(?:api|issue|pr|run|release|workflow|cache|search|project|repo|label|secret|variable|ruleset|gist)\\b";

  /**
   * A read that returns a page: `gh <thing> list`, a `gh search` subcommand, or
   * one of `gh project`'s list-shaped commands, which are not spelled `list`.
   *
   * `gh project item-list` is the one that matters most here. CLAUDE.md records
   * that the board is past 200 items, and someone who wants it without writing
   * GraphQL by hand reaches for `item-list` -- which caps at 30 like the rest.
   */
  static readonly LIST_COMMAND =
    /^gh\s+(?:issue|pr|run|release|workflow|cache|repo|label|secret|variable|ruleset|gist)\s+list\b|^gh\s+search\s+(?:issues|prs|repos|code|commits)\b|^gh\s+project\s+(?:list|item-list|field-list)\b/;

  /**
   * `--limit N` or `-L N`. `-L` must not be the tail of a longer flag.
   *
   * A shell variable counts as a bound. What this gate exists to catch is a
   * limit that is ABSENT, because absence truncates in silence; `--limit
   * "$LIMIT"` is a finite bound, and an unset variable makes `gh` fail loudly
   * rather than return page one. Requiring a literal would force the bound to
   * be written twice wherever a caller also asserts against it -- the constant
   * in the command and the same constant in the assertion -- which is the
   * duplicate-path anti-pattern bought with no added safety.
   */
  static readonly LIMIT = /(?:--limit|(?<![\w-])-L)[= ]\s*(?:\d+|"?\$\{?\w+)/;

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
   *
   * Every entry must be a segment GitHub actually serves. `checks` was in this
   * set and is not one -- the endpoints are `commits/{ref}/check-runs` and
   * `/check-suites` -- so it could never match while both real collections read
   * as single resources. An invented segment is worse than a missing one: it
   * looks like coverage. `check-runs` earns its place twice over, because
   * CLAUDE.md instructs the reader to "query the check-run rollup by head SHA",
   * so the repository's own merge-safety workflow produced a shape this gate
   * could not see. (`review-comments` was proposed alongside these and is not
   * here for the same reason `checks` left: the path is `pulls/{n}/comments`.)
   */
  static readonly COLLECTION_SEGMENTS: ReadonlySet<string> = new Set([
    "annotations",
    "artifacts",
    "assets",
    "assignees",
    "branches",
    "check-runs",
    "check-suites",
    "collaborators",
    "comments",
    "commits",
    "contributors",
    "deployments",
    "environments",
    "events",
    "files",
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
    "timeline",
    "variables",
    "workflows",
  ]);

  /**
   * Flags whose value is a SEPARATE token, and must be skipped with them.
   *
   * This does NOT fix the reported `-H "Accept: application/vnd.github+json"`
   * miss, though an earlier version of this comment claimed it did. `tokenize`
   * fixes that one on its own: the header value stays in a single token and
   * fails the path shape at its colon. Mutation-checking is what said so --
   * removing `-H` from this set left the whole suite green, which is a fixture
   * that cannot fail, and crediting a fix to the wrong mechanism is the exact
   * error this gate was built to stop recurring.
   *
   * What this set earns is the flag value that IS path-shaped, where the
   * tokenizer cannot help. Both measured:
   *
   *   --input notes/body.json repos/o/r/issues   -> `notes/body.json`, and
   *     `body.json` is not a collection segment, so the real collection read
   *     silently classified as sound
   *   --template repos/o/r/pulls repos/o/r/issues -> the wrong path entirely
   */
  static readonly VALUE_FLAGS: ReadonlySet<string> = new Set([
    "--cache",
    "--field",
    "--header",
    "--hostname",
    "--input",
    "--jq",
    "--method",
    "--raw-field",
    "--template",
    "-F",
    "-H",
    "-X",
    "-f",
    "-q",
    "-t",
  ]);

  /**
   * Split a command the way a shell would: whitespace separates tokens, except
   * inside quotes.
   *
   * `split(/\s+/)` tore `-H "Accept: application/vnd.github+json"` into three
   * tokens, so skipping the flag left `application/vnd.github+json` standing
   * where a path belongs and the real endpoint was never reached. Keeping the
   * value whole is what settles that -- it then fails the path shape at its
   * colon -- so this method, not `VALUE_FLAGS`, is the fix for the reported
   * case. Quoting is handled here rather than stripped afterwards, which also
   * retires the older `^["\']|["\']$` trim and the class of bug where a `--jq`
   * body contributed tokens of its own.
   */
  static tokenize(command: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let quote: string | null = null;
    let open = false;

    for (const char of command) {
      if (quote !== null) {
        if (char === quote) quote = null;
        else current += char;
      } else if (char === '"' || char === "'") {
        quote = char;
        open = true;
      } else if (/\s/.test(char)) {
        if (open) tokens.push(current);
        current = "";
        open = false;
      } else {
        current += char;
        open = true;
      }
    }

    if (open) tokens.push(current);
    return tokens;
  }

  /**
   * Whether a line is prose rather than something anyone runs.
   *
   * Every rule here is narrow on purpose, because a false negative in a gate
   * costs more than a false positive. Two earlier versions were broader and
   * each opened a hole that the corpus could not have revealed:
   *
   * - A `#` ANYWHERE before the invocation treated
   *   `echo "#$n"; gh issue list …` as a comment. Only a FULL-LINE `#` is a
   *   comment; a `#` inside a string is not. Every trap-describing comment in
   *   this repository is full-line, so narrowing costs nothing here.
   * - Backtick parity applied everywhere treated `` X=`gh issue list` `` as
   *   prose. Backticks mean inline code in markdown and command substitution in
   *   shell, and only the first is prose -- so parity is scoped to markdown.
   *   This repository writes substitution as `$( )` in all 77 shell uses, so
   *   the markdown rule loses nothing either.
   *
   * The markdown rule is not optional: documenting this very gate in CLAUDE.md
   * ("`gh issue list` and `gh pr list` default to 30") made it fail on the
   * sentence describing it. An assertion proves a check fires; only a control
   * proves it fires ONLY where it should.
   */
  static isProse(file: string, line: string, column: number): boolean {
    if (/^\s*(?:#|\*|\/\/)/.test(line)) return true;
    if (!file.endsWith(".md")) return false;
    const backticks = line.slice(0, column).match(/`/g);
    return backticks !== null && backticks.length % 2 === 1;
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
  static commandsIn(file: string, text: string): IGhCommand[] {
    const commands: IGhCommand[] = [];
    const lines = text.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
      const finder = new RegExp(GhPagination.INVOCATION_SOURCE, "g");
      let match = finder.exec(lines[index]);
      while (match !== null) {
        if (!GhPagination.isProse(file, lines[index], match.index)) {
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
      // A line that starts a NEW invocation ends this one, whatever the quote
      // count says. Without this, one stray apostrophe -- `# don't do this` on
      // a trailing comment -- ran the joiner into the next command and absorbed
      // its `--paginate`, so an unpaginated collection read classified as sound
      // and the file reported clean. A bound must come from the command it
      // bounds; borrowing one from the next command is this gate's own defect.
      if (new RegExp(GhPagination.INVOCATION_SOURCE).test(next)) break;
      text = `${text.trimEnd().replace(/\\$/, "")}\n${next}`;
      index += 1;
    }

    return text;
  }

  /**
   * The API path a `gh api` call reads: the first path-shaped non-flag token.
   *
   * Quotes come off BEFORE the shape test, not after -- a path is quoted exactly
   * when it carries a query string, `'…/comments?per_page=100'`, so testing the
   * quoted form returned null for every paginated call and reported it sound
   * because the path was unreadable, not because a bound was found. That is a
   * guard passing for a reason unrelated to what it asserts, and two more
   * instances of it were found afterwards by probing rather than reading:
   *
   *   gh api -H "Accept: …+json" repos/o/r/issues  -> the header VALUE
   *   gh api /repos/o/r/issues                     -> null
   *
   * The first is fixed by consuming `VALUE_FLAGS` values with their flag, the
   * second by accepting the leading slash `gh api` accepts and its own docs use.
   * Neither shape exists in this repository today, which is precisely why
   * neither would have been noticed until it did.
   *
   * Returning null no longer means "sound" -- see `classify`.
   */
  static apiPath(command: string): string | null {
    const tokens = GhPagination.tokenize(
      command.replace(GhPagination.REST, ""),
    );

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (GhPagination.VALUE_FLAGS.has(token)) {
        index += 1;
        continue;
      }
      if (token.startsWith("-")) continue;
      if (/^\/?[A-Za-z][\w.-]*(?:\/[^\s'"|)]+)+/.test(token)) {
        return token.replace(/^\//, "");
      }
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
      const paginated = /--paginate\b/.test(command);
      const path = GhPagination.apiPath(command);
      // An unreadable path is NOT a single resource, and reading it as one is
      // how the two misses above stayed quiet. `--paginate` still settles it --
      // it is harmless on a single resource and required on a collection -- so
      // reporting here always has a fix, and the token walk becomes
      // self-verifying: if it regresses, the gate goes red instead of silent.
      if (path === null) return paginated ? null : "unreadable-path";
      if (!GhPagination.isCollection(path)) return null;
      return paginated ? null : "unpaginated-collection";
    }

    return null;
  }

  /** Every violation in one file's text. */
  static scanFile(file: string, text: string): IGhPaginationViolation[] {
    const violations: IGhPaginationViolation[] = [];

    for (const command of GhPagination.commandsIn(file, text)) {
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
      const found = execFileSync(
        "git",
        [
          "grep",
          "-lIF",
          // A new file that is not committed yet is exactly when this gate is
          // most useful: the local run before the push. Without --untracked it
          // reported clean on a brand-new skill carrying an unbounded command.
          // --exclude-standard keeps .gitignore honoured, so node_modules and
          // build output stay out.
          "--untracked",
          "--exclude-standard",
          "gh ",
          "--",
          ".",
        ],
        {
          cwd: rootDir,
          encoding: "utf-8",
          maxBuffer: 64 * 1024 * 1024,
        },
      );
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
