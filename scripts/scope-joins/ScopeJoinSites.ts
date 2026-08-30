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

/** One distinct call shape in one file, and how many times it occurs there. */
interface ISite {
  readonly file: string;
  readonly element: string;
  readonly count: number;
}

/**
 * What kind of join a site performs. An ORDERED partition, not a set of labels:
 * the descriptions overlap (a site can be built from source text AND read a
 * leaf-keyed map), so a site takes the FIRST kind that applies, in the order
 * declared here.
 *
 * Nothing APPLIES this -- no code picks a kind; the ordering is an instruction
 * to the human writing the row. But it is no longer stated twice: `TKind` is
 * derived from `KIND_SECTIONS`, and `render` emits the preamble bullets from
 * the same array, so the union and the document cannot disagree about
 * precedence. They did disagree once, in opposite directions, and the
 * preamble's order would have sent an adjudicator the other way on
 * `cnext/index.ts`'s `scopeName`: source text from a parse-tree identifier, so
 * `path` by description, but `leaf-keyed` is the answer that matters because it
 * is paired with a collection. Reordering the array now moves both, and a
 * reorder that touches only one is unrepresentable.
 */
const KIND_SECTIONS = [
  {
    kind: "via-scope-utils",
    lines: [
      "- **via-scope-utils** -- already routed correctly, and matched only because",
      "  the enclosing block mentions a scope.",
    ],
  },
  {
    kind: "leaf-keyed",
    lines: [
      "- **leaf-keyed** -- paired with a collection filed under a leaf-built key.",
      "  Converting one side alone breaks the pairing, so the row names the",
      "  collection and the card that must move both.",
    ],
  },
  {
    kind: "path",
    lines: [
      "- **path** -- the first element is source text from a parse-tree identifier",
      "  chain. `ids[0]` in `Scope.REG.MEMBER` is what the author wrote, so joining",
      "  it rebuilds a lookup KEY rather than qualifying a member by its declaring",
      "  scope. Under nesting the author writes more components and the INDEXING",
      "  changes, not the join. `fromParts` documents this as its remaining use.",
    ],
  },
] as const;

type TKind = (typeof KIND_SECTIONS)[number]["kind"];

/** A reviewed judgement about one call shape. */
interface IAdjudication {
  readonly file: string;
  readonly element: string;
  readonly kind: TKind;
  /** The collection whose keying this join must match, for `leaf-keyed`. */
  readonly pairedWith: string | null;
  /** The card that must move this site, or null when nothing needs to. */
  readonly movesWith: string | null;
  readonly why: string;
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
   * The reviewed judgement for every site the scan finds.
   *
   * Keyed on (file, first element) rather than `file:line`, for the reason the
   * module docblock gives: line citations rot silently when code moves. An
   * element text moves WITH its call, and when it does change -- a rename, a
   * different expression -- the site becomes undeclared and the gate says so.
   * That is the intended behavior: the adjudication was made about a specific
   * expression, so a different expression has not been adjudicated.
   *
   * `check` fails on a site with no entry here and on an entry matching no site,
   * so this list can neither miss a site nor keep a stale judgement. Before this
   * existed, the committed document classified the POPULATION in prose and left
   * the reader to work out which row was which -- and both sites it described as
   * "moving with #1295" turned out not to: one reads a map that is never written
   * (#1394), the other reads `constValues`, which #1295 does not own.
   */
  private static readonly ADJUDICATIONS: readonly IAdjudication[] = [
    {
      file: "src/transpiler/logic/analysis/helpers/CalleeNameResolver.ts",
      element: "resolvedName",
      kind: "path",
      pairedWith: null,
      movesWith: null,
      why: "callee chain `Scope.method()`; `resolvedName` is source text, and the `isScope` guard only confirms the author named a scope",
    },
    {
      file: "src/transpiler/logic/symbols/cnext/adapters/TSymbolInfoAdapter.ts",
      element: "scopeName",
      kind: "leaf-keyed",
      pairedWith: "scopeVariableUsage",
      movesWith: "#1394",
      why: "reads a map that is never written, in a method with no caller -- the in-source claim that both sides move together describes a pairing with no producer",
    },
    {
      file: "src/transpiler/logic/symbols/cnext/index.ts",
      element: "scopeName",
      kind: "leaf-keyed",
      pairedWith: "constValues",
      movesWith: "#1295",
      why: "files each scoped const under a leaf-joined key; live, and the same latent shape as #1295's three collections, but not one of them -- scope question raised on that card",
    },
    {
      file: "src/transpiler/output/codegen/assignment/AssignmentClassifier.ts",
      element: "scopeName",
      kind: "path",
      pairedWith: null,
      movesWith: null,
      why: "`ids[0]` of a parse-tree chain, admitted by `isKnownScope(scopeName)` (`:229`, `:554`); under nesting the author writes more components and the INDEXING changes, not the join",
    },
    {
      file: "src/transpiler/output/codegen/assignment/AssignmentClassifier.ts",
      element: "firstId",
      kind: "path",
      pairedWith: null,
      movesWith: null,
      why: "`ids[0]` of `Scope.REG.MEMBER[bit]`, guarded by `isKnownScope`",
    },
    {
      file: "src/transpiler/output/codegen/assignment/handlers/AssignmentHandlerUtils.ts",
      element: "leadingId",
      kind: "path",
      pairedWith: null,
      movesWith: null,
      why: "`identifiers[0]` of `Scope.Register.Member`, guarded by the injected `isKnownScope`",
    },
    {
      file: "src/transpiler/output/codegen/assignment/handlers/BitmapHandlers.ts",
      element: "scopeName",
      kind: "path",
      pairedWith: null,
      movesWith: null,
      why: "`ctx.identifiers[0]` of `Scope.REG.MEMBER.field`; the sibling `this.` branch already routes through `ScopeUtils.qualifyInScope`",
    },
    {
      file: "src/transpiler/output/codegen/helpers/MemberSeparatorResolver.ts",
      element: "identifierChain[0]",
      kind: "path",
      pairedWith: null,
      movesWith: null,
      why: "source chain `Board.GPIO`, admitted by `deps.isKnownScope(identifierChain[0])`; the JOINED name is then tested against `isKnownRegister` before any cross-scope check",
    },
    {
      file: "src/transpiler/output/codegen/resolution/EnumTypeResolver.ts",
      element: "scopeName",
      kind: "path",
      pairedWith: null,
      movesWith: null,
      why: "`parts[0]` of `Motor.State.IDLE`; builds a candidate key from source text, not a qualification of a member by its declaring scope",
    },
    {
      file: "src/transpiler/output/codegen/resolution/EnumTypeResolver.ts",
      element: "parts[0]",
      kind: "path",
      pairedWith: null,
      movesWith: null,
      why: "`Scope.method()` callee text, guarded by `isKnownScope`",
    },
    {
      file: "src/transpiler/output/codegen/resolution/EnumTypeResolver.ts",
      element: "parts[1]",
      kind: "path",
      pairedWith: null,
      movesWith: null,
      why: "`global.Scope.method()` callee text, admitted by `isKnownScope(parts[1])` (`:221`); `parts[0]` is the `global` qualifier the author wrote",
    },
  ];

  /**
   * The adjudication for a site, or undefined when it has not been reviewed.
   *
   * `verdicts` defaults to the committed table and is injectable so the unit
   * tests exercise the MECHANISM rather than today's twelve sites -- otherwise
   * every test would have to name a real file, and closing a site would redden
   * tests that are not about it.
   */
  private static adjudicationFor(
    file: string,
    element: string,
    verdicts: readonly IAdjudication[],
  ): IAdjudication | undefined {
    return verdicts.find((row) => row.file === file && row.element === element);
  }

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

  /** Every counted call in `source`, as first-element texts. */
  private static countedElements(source: string): readonly string[] {
    const stripped = ScopeJoinSites.withoutComments(source);
    return ScopeJoinSites.calls(source)
      .filter(
        (call) =>
          ScopeJoinSites.isScopeDenoting(call.element) ||
          ScopeJoinSites.guardedByScopePredicate(
            stripped,
            call.element,
            call.at,
          ),
      )
      .map((call) => call.element);
  }

  /**
   * Distinct (file, first element) sites with their occurrence counts.
   *
   * Two calls in one file can share an element text -- `AssignmentClassifier`
   * has `scopeName` twice, in different methods. They collapse to one row on
   * purpose: an adjudication is about what the expression IS, and identical text
   * in one file is the same judgement. A row's count still fails the gate if it
   * grows, so the collapse cannot hide a new site.
   */
  static sites(sources: ReadonlyMap<string, string>): readonly ISite[] {
    const rows: ISite[] = [];
    for (const [file, source] of sources) {
      const tally = new Map<string, number>();
      for (const element of ScopeJoinSites.countedElements(source)) {
        tally.set(element, (tally.get(element) ?? 0) + 1);
      }
      for (const [element, count] of tally) {
        rows.push({ file, element, count });
      }
    }
    return rows.sort(
      (a, b) =>
        a.file.localeCompare(b.file) || a.element.localeCompare(b.element),
    );
  }

  /**
   * The totals both `render` and `check` report.
   *
   * Shared rather than computed twice: the two must agree, and jscpd caught the
   * copy the moment it existed.
   */
  private static summarize(
    sites: readonly ISite[],
    verdicts: readonly IAdjudication[],
  ): { total: number; files: number; moving: readonly ISite[] } {
    return {
      total: sites.reduce((sum, row) => sum + row.count, 0),
      files: new Set(sites.map((row) => row.file)).size,
      moving: sites.filter(
        (row) =>
          ScopeJoinSites.adjudicationFor(row.file, row.element, verdicts)
            ?.movesWith,
      ),
    };
  }

  /** The committed document body. No timestamp: it would churn every run. */
  static render(
    sites: readonly ISite[],
    verdicts: readonly IAdjudication[] = ScopeJoinSites.ADJUDICATIONS,
  ): string {
    const { total, files, moving } = ScopeJoinSites.summarize(sites, verdicts);
    const lines = [
      "# Scope-denoting `fromParts` sites",
      "",
      "<!-- Generated by `npm run scope-joins`. Do not edit by hand. -->",
      "",
      "Issue #1357. Each row is one call shape in one file: the first element",
      "reads as a scope, or a nearby `isScope` guard proves it is one.",
      "",
      "**A row is not by itself a defect.** The population that WAS one -- a",
      "scope's leaf name standing in for a complete path, correct only while",
      "`scopeMember` admits no `scopeDeclaration` (`grammar/CNext.g4`) -- has been",
      "converted to the scope REFERENCE via `ScopeUtils.qualifyInScope`, which",
      "walks the parent chain. Every row below carries the judgement that was made",
      "about it, so no reader has to re-derive which is which:",
      "",
      ...KIND_SECTIONS.flatMap((section) => section.lines),
      "",
      "They overlap as descriptions -- a site can be built from source text AND",
      "read a leaf-keyed map -- so a site takes the FIRST kind above that applies,",
      "which makes them a partition rather than labels. **Nothing computes this.**",
      "The order is an instruction to whoever writes the row: `cnext/index.ts`'s",
      "`scopeName` is source text from a parse-tree identifier, and is still",
      "`leaf-keyed`, because being paired with a collection is the fact that",
      "decides what must move.",
      "",
      "This list may shrink freely. It may not grow: `npm run scope-joins:check`",
      "fails on a file that gains a site, on a call shape nobody has adjudicated,",
      "and on a judgement that no longer matches any site. So the population cannot",
      "drift upward unnoticed the way it did when #1348 moved it 61 to 65, and a",
      "judgement cannot outlive the code it was made about. A new row is a prompt",
      "to adjudicate, not proof of a bug -- but it must be adjudicated before it",
      "lands.",
      "",
      "| File | First element | Sites | Kind | Moves with |",
      "| --- | --- | --- | --- | --- |",
      ...sites.map((row) => {
        const verdict = ScopeJoinSites.adjudicationFor(
          row.file,
          row.element,
          verdicts,
        );
        const kind = verdict?.kind ?? "**UNADJUDICATED**";
        const moves = verdict?.movesWith ?? "--";
        return `| \`${row.file}\` | \`${row.element}\` | ${row.count} | ${kind} | ${moves} |`;
      }),
      `| **total** | | **${total}** | | |`,
      "",
      `${total} site(s) across ${files} file(s).`,
      "",
      "## What must move, and with what",
      "",
    ];
    if (moving.length === 0) {
      lines.push(
        "Nothing. Every remaining site is adjudicated as needing no change.",
        "",
      );
    } else {
      lines.push(
        "The checklist for whoever re-keys these collections. Each row is a call",
        "shape that must change in the SAME commit as its collection's keying --",
        "a key built one way against a map filed another returns empty, which",
        'reads as "no such symbol" rather than "wrong question" (#1139).',
        "",
        "| Site | Paired with | Moves with | Why |",
        "| --- | --- | --- | --- |",
      );
      for (const row of moving) {
        const verdict = ScopeJoinSites.adjudicationFor(
          row.file,
          row.element,
          verdicts,
        )!;
        lines.push(
          `| \`${row.file}\` (\`${row.element}\`) | \`${verdict.pairedWith}\` | ${verdict.movesWith} | ${verdict.why} |`,
        );
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  /** Compare freshly-scanned sites against the committed document. */
  static check(
    committed: string,
    sites: readonly ISite[],
    verdicts: readonly IAdjudication[] = ScopeJoinSites.ADJUDICATIONS,
  ): ICheckOutcome {
    const errors: string[] = [];

    // Tolerant of padding: the committed document is Prettier-formatted, which
    // pads table cells to a common width. A parser requiring single spaces
    // fails against the very file the generator just wrote.
    const expected = new Map<string, number>();
    for (const match of committed.matchAll(
      /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|/gm,
    )) {
      expected.set(`${match[1]}\u0000${match[2]}`, Number(match[3]));
    }
    const actual = new Map(
      sites.map((row) => [`${row.file}\u0000${row.element}`, row.count]),
    );

    for (const [key, n] of actual) {
      const [file, element] = key.split("\u0000");
      const was = expected.get(key);
      if (was === undefined) {
        errors.push(
          `${file}: new scope-denoting call shape \`${element}\` (${n} site(s))`,
        );
      } else if (n > was) {
        errors.push(`${file}: \`${element}\` grew from ${was} to ${n} site(s)`);
      }
    }
    for (const [key, was] of expected) {
      const [file, element] = key.split("\u0000");
      const now = actual.get(key) ?? 0;
      if (now < was) {
        errors.push(
          `${file}: \`${element}\` down from ${was} to ${now} -- run ` +
            "`npm run scope-joins` AND update its `ADJUDICATIONS` entry: drop " +
            "it if the site is gone, re-key it if the expression was renamed. " +
            "Regenerating alone cannot green this -- the entry is source code",
        );
      }
    }

    // A site nobody has judged, and a judgement about code that is gone. The
    // first is the point of the table; the second keeps it from rotting into
    // the prose promise it replaced.
    for (const row of sites) {
      if (!ScopeJoinSites.adjudicationFor(row.file, row.element, verdicts)) {
        errors.push(
          `${row.file}: \`${row.element}\` has no adjudication -- add one to ` +
            "`ScopeJoinSites.ADJUDICATIONS` saying which kind it is and why",
        );
      }
    }
    for (const verdict of verdicts) {
      const stillThere = sites.some(
        (row) => row.file === verdict.file && row.element === verdict.element,
      );
      if (!stillThere) {
        errors.push(
          `${verdict.file}: adjudication for \`${verdict.element}\` matches no ` +
            "site -- remove it, the judgement outlived its code",
        );
      }
    }

    const { total, files, moving } = ScopeJoinSites.summarize(sites, verdicts);
    return {
      ok: errors.length === 0,
      errors,
      info: [
        `${total} scope-denoting site(s) across ${files} file(s); ` +
          `${moving.length} awaiting another card.`,
      ],
    };
  }
}

export default ScopeJoinSites;
