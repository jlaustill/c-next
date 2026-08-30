/**
 * Issue #1357: the committed inventory of scope-denoting `fromParts` sites.
 *
 * `QualifiedCName.fromParts(parts)` builds a qualified C name from a COMPLETE
 * path. Passing a scope's NAME as the first element claims a complete path while
 * supplying a leaf, which drops every outer scope -- the divergence #1285 removed
 * from the collectors and #1357 removes from everywhere else.
 *
 * The type system already rejects the honest mistake: no API takes a scope name,
 * so a caller must either thread the `IScopeSymbol` (correct) or write the leaf
 * into a `fromParts` array (this list). What is left is a call SHAPE, which no
 * import-level rule can see -- `fromParts` is legitimately used 38 times by
 * callers that really do hold a whole path.
 *
 * Keyed on a per-file COUNT rather than `file:line`. Two reasons, both learned
 * the expensive way: an eleven-site change silently invalidated eighteen
 * `file:line` citations in `output-throw-classification.md` through pure line
 * drift, and #1374 records that a citation gate cannot detect two rows trading
 * sites. A count cannot rot when code moves and still fails the moment the
 * residue grows -- which is the requirement, since #1348 moved the population
 * 61 -> 65 with nothing going red.
 */

/** One file's scope-denoting site count. */
interface IFileCount {
  readonly file: string;
  readonly count: number;
}

/** What `check` concluded. */
interface ICheckOutcome {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly info: readonly string[];
}

class ScopeJoinSites {
  /** The builder whose first element must be an outermost path component. */
  private static readonly CALL = "QualifiedCName.fromParts([";

  /**
   * Identifiers that name a scope rather than a complete path.
   *
   * Deliberately a name heuristic: the alternative is type-directed analysis of
   * every call site, and a name is what a reviewer reads anyway. A false
   * positive costs one baseline row; a false negative is caught the next time
   * the expression is renamed to say what it holds.
   */
  private static readonly SCOPE_DENOTING =
    /\b(scope|currentScope|scopeName|scopePath|callerScope|declaringScope)\b|scope\.name/i;

  /** Routing through here is the CORRECT form, whatever the argument is called. */
  private static readonly VIA_SCOPE_UTILS = "ScopeUtils.";

  /**
   * `source` with comments removed.
   *
   * The scan is a text search, and in this codebase the text it looks for appears
   * in JSDoc constantly -- these calls are what the prose is ABOUT
   * (`ScopeUtils.ts` and `HeaderSymbolAdapter.ts` each carry one today). Counting
   * a sentence produces a baseline row for a file with no such site, and the only
   * way to green that is to record the phantom permanently. `ScopeUtils.ts` is
   * precisely the file that must never hold a row, so the phantom would read as
   * the encoder itself having regressed, with nothing saying it came from a
   * comment.
   *
   * String literals are the other theoretical vector; no call is spelled inside
   * one today, so they are deliberately not handled.
   */
  private static withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  /**
   * The first array element of each `fromParts([...])` call in `source`.
   *
   * Scans for the matching delimiter rather than matching a regex: several of
   * these calls span four lines and contain nested calls with their own commas.
   */
  static firstElements(rawSource: string): readonly string[] {
    return ScopeJoinSites.calls(rawSource).map((call) => call.element);
  }

  /**
   * Every `fromParts([...])` call: its first element and where it sits.
   *
   * The position is what lets `isScopeDenoting` look at the ENCLOSING BLOCK. A
   * file-wide search for the guard would count
   * `PostfixExpressionGenerator`'s two `ctx.result` calls, which are guarded by
   * `knownRegisters.has` while an unrelated function in the same file happens to
   * call `isKnownScope(ctx.result)` -- three false positives out of nine on a
   * naive pass, which is the argument for scoping the search rather than
   * widening it.
   */
  static calls(rawSource: string): readonly { element: string; at: number }[] {
    const source = ScopeJoinSites.withoutComments(rawSource);
    const found: { element: string; at: number }[] = [];
    let from = 0;
    for (;;) {
      const at = source.indexOf(ScopeJoinSites.CALL, from);
      if (at < 0) {
        return found;
      }
      let depth = 0;
      let element = "";
      let i = at + ScopeJoinSites.CALL.length;
      for (; i < source.length; i++) {
        const c = source[i];
        if ("([{".includes(c)) {
          depth++;
        } else if (")]}".includes(c)) {
          if (depth === 0) {
            break;
          }
          depth--;
        } else if (c === "," && depth === 0) {
          break;
        }
        element += c;
      }
      found.push({ element: element.trim().replace(/\s+/g, " "), at });
      from = i + 1;
    }
  }

  /**
   * Is `element` proven to hold a scope name by a guard in its enclosing block?
   *
   * The committed document's criterion is "passes a scope's NAME as the first
   * element". A name heuristic cannot see `parts[0]`, `ids[0]` or
   * `identifierChain[0]` -- and nobody is going to rename those, so the module's
   * stated mitigation ("caught the next time the expression is renamed") never
   * fires for them. Six sites satisfied the document's criterion and went
   * uncounted, which would have let PR 3 report a zero baseline with live sites
   * remaining, and a zero licenses removing this gate.
   *
   * The window runs from the head of the enclosing block to the call, so the
   * predicate must guard THIS call rather than merely appear in the file.
   */
  private static guardedByScopePredicate(
    source: string,
    element: string,
    at: number,
  ): boolean {
    let depth = 0;
    let open = -1;
    for (let i = at; i >= 0; i--) {
      const c = source[i];
      if (c === "}") depth++;
      else if (c === "{") {
        if (depth === 0) {
          open = i;
          break;
        }
        depth--;
      }
    }
    if (open < 0) return false;
    // Back up over the block's header (`if (...)`) to the previous statement end.
    let start = 0;
    for (let i = open - 1; i >= 0; i--) {
      if (";}{".includes(source[i])) {
        start = i + 1;
        break;
      }
    }
    const window = source.slice(start, at);
    const escaped = element.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\bis(?:Known)?Scope\\(\\s*${escaped}\\s*[),]`).test(
      window,
    );
  }

  /** Does this first element name a scope instead of an outermost component? */
  static isScopeDenoting(element: string): boolean {
    if (element.includes(ScopeJoinSites.VIA_SCOPE_UTILS)) {
      return false;
    }
    return ScopeJoinSites.SCOPE_DENOTING.test(element);
  }

  /** Per-file counts, ascending by path, omitting files with none. */
  static count(sources: ReadonlyMap<string, string>): readonly IFileCount[] {
    const counts: IFileCount[] = [];
    for (const [file, source] of sources) {
      const stripped = ScopeJoinSites.withoutComments(source);
      const n = ScopeJoinSites.calls(source).filter(
        (call) =>
          ScopeJoinSites.isScopeDenoting(call.element) ||
          ScopeJoinSites.guardedByScopePredicate(
            stripped,
            call.element,
            call.at,
          ),
      ).length;
      if (n > 0) {
        counts.push({ file, count: n });
      }
    }
    return counts.sort((a, b) => a.file.localeCompare(b.file));
  }

  /** The committed document body. No timestamp: it would churn every run. */
  static render(counts: readonly IFileCount[]): string {
    const total = counts.reduce((sum, row) => sum + row.count, 0);
    const lines = [
      "# Scope-denoting `fromParts` sites",
      "",
      "<!-- Generated by `npm run scope-joins`. Do not edit by hand. -->",
      "",
      "Issue #1357. Each row is a file where the scan's heuristic matched a",
      "`fromParts` call -- the first element reads as a scope, or a nearby",
      "`isScope` guard proves it is one.",
      "",
      "**A row is not by itself a defect.** The population that WAS one -- a",
      "scope's leaf name standing in for a complete path, correct only while",
      "`scopeMember` admits no `scopeDeclaration` (`grammar/CNext.g4`) -- has been",
      "converted to the scope REFERENCE via `ScopeUtils.qualifyInScope`, which",
      "walks the parent chain. What remains was read and adjudicated, and falls",
      "into three kinds:",
      "",
      "1. **A complete path from a parse-tree identifier chain.** `ids[0]` in",
      "   `Scope.REG.MEMBER` is source text the author wrote, not a scope symbol",
      "   standing in for one, so joining it builds a lookup KEY rather than",
      "   qualifying a member by its declaring scope. `fromParts` documents this",
      "   as its remaining legitimate use.",
      "2. **Paired with a leaf-keyed map (#1295).** `scopeMembers`,",
      "   `scopeMemberVisibility` and `knownScopes` are keyed by the scope leaf,",
      "   so a lookup against them must be built the same way. Converting one side",
      "   alone breaks the pairing; these move when #1295 does, not before.",
      "3. **Already routed through `ScopeUtils`,** and matched only because the",
      "   enclosing block mentions a scope.",
      "",
      "This list may shrink freely. It may not grow: `npm run scope-joins:check`",
      "fails on a file that gains a site or appears anew, so the population cannot",
      "drift upward unnoticed the way it did when #1348 moved it 61 to 65. A new",
      "row is therefore a prompt to adjudicate, not proof of a bug -- but it must",
      "be adjudicated before it lands.",
      "",
      "| File | Sites |",
      "| --- | --- |",
      ...counts.map((row) => `| \`${row.file}\` | ${row.count} |`),
      `| **total** | **${total}** |`,
      "",
    ];
    return lines.join("\n");
  }

  /** Compare freshly-scanned counts against the committed document. */
  static check(
    committed: string,
    counts: readonly IFileCount[],
  ): ICheckOutcome {
    const errors: string[] = [];
    const expected = new Map<string, number>();
    // Tolerant of padding: the committed document is Prettier-formatted, which
    // pads table cells to a common width. A parser requiring single spaces
    // fails against the very file the generator just wrote.
    for (const match of committed.matchAll(
      /^\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|\s*$/gm,
    )) {
      expected.set(match[1], Number(match[2]));
    }
    const actual = new Map(counts.map((row) => [row.file, row.count]));

    for (const [file, n] of actual) {
      const was = expected.get(file);
      if (was === undefined) {
        errors.push(
          `${file}: ${n} new scope-denoting site(s); this file had none`,
        );
      } else if (n > was) {
        errors.push(`${file}: grew from ${was} to ${n} scope-denoting site(s)`);
      }
    }
    for (const [file, was] of expected) {
      const now = actual.get(file) ?? 0;
      if (now < was) {
        errors.push(
          `${file}: down from ${was} to ${now} -- run \`npm run scope-joins\` to record the win`,
        );
      }
    }

    const total = counts.reduce((sum, row) => sum + row.count, 0);
    return {
      ok: errors.length === 0,
      errors,
      info: [
        `${total} scope-denoting site(s) across ${counts.length} file(s).`,
      ],
    };
  }
}

export default ScopeJoinSites;
