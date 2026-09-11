/**
 * Issue #1317: the committed inventory of modules holding an ANTLR parse tree.
 *
 * `docs/architecture/README.md` makes the AST Tier 1 with a short lifetime and
 * rests the whole lifetime axis on one rule -- 1.3 consumes `ParsedFile` and
 * does not re-export it, so the tree is not reachable from any artifact a
 * downstream pass holds. Nothing enforced it.
 *
 * The population is NOT scanned here. It is read from the violations of
 * `parse-tree-confined-to-parser` in `.dependency-cruiser.cjs`, so the question
 * "what counts as holding a parse tree" has exactly one answer, in the rule,
 * rather than one in the rule and a second in a grep that must agree with it.
 * That second definition is the duplicate-path anti-pattern this project
 * forbids, and it would fail in the quiet direction: a rule and a scanner that
 * disagree leave a module gated by neither while both report green.
 *
 * Keyed on the MODULE, not on `file:line`. `output-throw-classification.md`
 * records what line citations cost -- adding one import shifts every later
 * citation down one and all 20 missed by exactly one (#1399) -- and a module
 * path moves only when the module does, which is a reviewable diff rather than
 * silent drift.
 */

/** One module outside the parser that holds a parse context, and what from. */
interface ISite {
  readonly module: string;
  /** `grammar`, `antlr4ng`, or both -- sorted, so the row is stable. */
  readonly holds: readonly string[];
}

/** What `check` concluded. */
interface ICheckOutcome {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly info: readonly string[];
}

/** One violation edge as dependency-cruiser reports it. */
interface IViolation {
  readonly from: string;
  readonly to: string;
  readonly rule?: { readonly name?: string };
}

class ParseTreeSites {
  /** The rule whose violations ARE this document. Named once. */
  static readonly RULE = "parse-tree-confined-to-parser";

  /**
   * The layer a module path belongs to, longest prefix first.
   *
   * Ordered, not a map: `src/transpiler/output/` must be tested before
   * `src/transpiler/`, or every transpiler module collapses into one row and
   * the render layer's share -- the number the issue says matters -- disappears.
   */
  private static readonly LAYERS: readonly string[] = [
    "src/PARSE/",
    "src/TRANSPILE/",
    "src/transpiler/data/",
    "src/transpiler/logic/",
    "src/transpiler/output/",
    "src/transpiler/state/",
    "src/transpiler/types/",
    "src/transpiler/",
    "src/utils/",
    "src/cli/",
    "src/lib/",
  ];

  /** Which dependency a violation edge points at, in the document's vocabulary. */
  private static holdKind(to: string): string {
    return to.includes("antlr4ng") ? "antlr4ng" : "grammar";
  }

  /** The layer heading a module sits under. */
  static layerOf(module: string): string {
    return (
      ParseTreeSites.LAYERS.find((layer) => module.startsWith(layer)) ??
      "src/ (root)"
    );
  }

  /**
   * Distinct modules, from the rule's violation edges.
   *
   * A module holding two parse contexts produces two edges and one row: the
   * document counts MODULES, which is what the issue's baseline measures and
   * what "the tree is not reachable from any artifact a downstream pass holds"
   * is a claim about. Edge counts would move when an import is split across two
   * statements, which is not the coupling changing.
   */
  static sites(violations: readonly IViolation[]): readonly ISite[] {
    const holdsByModule = new Map<string, Set<string>>();
    for (const violation of violations) {
      if (violation.rule?.name !== ParseTreeSites.RULE) continue;
      const holds = holdsByModule.get(violation.from) ?? new Set<string>();
      holds.add(ParseTreeSites.holdKind(violation.to));
      holdsByModule.set(violation.from, holds);
    }
    return [...holdsByModule.entries()]
      .map(([module, holds]) => ({ module, holds: [...holds].sort() }))
      .sort((a, b) => a.module.localeCompare(b.module));
  }

  /**
   * The per-layer tally both `render` and `check` report.
   *
   * Shared rather than computed twice -- the two must agree, and jscpd flags the
   * copy the moment it exists (the lesson `ScopeJoinSites.summarize` records).
   */
  static summarize(sites: readonly ISite[]): {
    readonly total: number;
    readonly byLayer: readonly (readonly [string, number])[];
  } {
    const tally = new Map<string, number>();
    for (const site of sites) {
      const layer = ParseTreeSites.layerOf(site.module);
      tally.set(layer, (tally.get(layer) ?? 0) + 1);
    }
    return {
      total: sites.length,
      byLayer: [...tally.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      ),
    };
  }

  /** The committed document body. No timestamp: it would churn every run (#1150). */
  static render(sites: readonly ISite[]): string {
    const { total, byLayer } = ParseTreeSites.summarize(sites);
    return [
      "# Modules holding an ANTLR parse tree",
      "",
      "<!-- Generated by `npm run parse-tree`. Do not edit by hand. -->",
      "",
      "Issue #1317. Each row is one module outside `src/transpiler/logic/parser/`",
      "that imports a generated parser context or the `antlr4ng` runtime.",
      "",
      "**The population is not scanned.** It is the violation set of the",
      "`parse-tree-confined-to-parser` rule in `.dependency-cruiser.cjs`, so the",
      "rule is the single definition of what counts. A second definition here --",
      "a grep that must agree with the rule -- is the duplicate-path anti-pattern,",
      "and it fails quietly: where the two disagree a module is gated by neither",
      "while both report green.",
      "",
      "**A row is not by itself a defect.** `IParsedFile.ts` IS 1.2 Parse's",
      "artifact and `IDeclaredFile.ts` carries the tree 1.3 consumes; holding a",
      "parse context is their job. What the lifetime axis forbids is the",
      "population GROWING -- a pass reaching for the tree to answer a question its",
      "own artifact should already answer. So the rule is `warn`, not `error`, and",
      "this document is the gate: `npm run parse-tree:check` fails when a module",
      "is added to the list, and when the list is stale because one was removed.",
      "",
      "Flipping the rule to `error` is the last card of track D (#1313), not this",
      "one.",
      "",
      "## By layer",
      "",
      "| Layer | Modules |",
      "| --- | ---: |",
      ...byLayer.map(([layer, count]) => `| \`${layer}\` | ${count} |`),
      `| **total** | **${total}** |`,
      "",
      "`src/transpiler/output/` is the render layer, and its share is the number",
      "the issue singles out: the render layer holding parse nodes is how a",
      "diagnostic can originate there at all, which is what #1322 relocates.",
      "",
      "## Modules",
      "",
      "| Module | Holds |",
      "| --- | --- |",
      ...sites.map(
        (site) => `| \`${site.module}\` | ${site.holds.join(", ")} |`,
      ),
      "",
      `${total} module(s).`,
      "",
    ].join("\n");
  }

  /**
   * Compare a freshly-cruised population against the committed document.
   *
   * Fails in BOTH directions, for the reason `diagnostic-manifest.ts` gives:
   * growth is the defect this gate exists to catch, and shrinkage left
   * unrecorded means the committed number stops being the number, so the next
   * rise is measured against a baseline nobody re-derived.
   */
  static check(committed: string, sites: readonly ISite[]): ICheckOutcome {
    const errors: string[] = [];

    // Tolerant of padding: the committed document is Prettier-formatted, which
    // pads table cells to a common width. A parser requiring single spaces
    // fails against the very file the generator just wrote.
    const expected = new Set<string>();
    for (const match of committed.matchAll(
      /^\|\s*`(src\/[^`]+)`\s*\|\s*(?:grammar|antlr4ng)/gm,
    )) {
      expected.add(match[1]);
    }
    const actual = new Set(sites.map((site) => site.module));

    for (const module of actual) {
      if (!expected.has(module)) {
        errors.push(
          `${module}: now holds a parse context and is not in the baseline -- ` +
            "a pass reaching for the tree is what the lifetime axis forbids. " +
            "If it is genuinely the right place, run `npm run parse-tree` " +
            "and say on the PR which artifact could not answer the question",
        );
      }
    }
    for (const module of expected) {
      if (!actual.has(module)) {
        errors.push(
          `${module}: no longer holds a parse context -- run ` +
            "`npm run parse-tree` so the baseline records the smaller " +
            "number. Leaving it stale re-admits this module for free",
        );
      }
    }

    const { total, byLayer } = ParseTreeSites.summarize(sites);
    const render = byLayer.find(
      ([layer]) => layer === "src/transpiler/output/",
    );
    return {
      ok: errors.length === 0,
      errors,
      info: [
        `${total} module(s) hold a parse tree; ${render?.[1] ?? 0} in the ` +
          "render layer.",
      ],
    };
  }
}

export default ParseTreeSites;
