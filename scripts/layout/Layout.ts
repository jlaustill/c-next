import { readdirSync } from "node:fs";
import { join } from "node:path";

import type IDepcruiseViolation from "../types/IDepcruiseViolation";
import type ILayoutFailure from "../types/ILayoutFailure";

/** The heading whose first fenced block is the tree `src/` must match. */
const TREE_HEADING = "### The layout is the pass table";

/** The per-place rules `.dependency-cruiser.cjs` generates from `PASS_ORDER`. */
const ORDER_RULE = /-reads-no-later-pass$/;

/**
 * Tests sit beside what they test (`lint:test-location`), so a layer may
 * hold a `__tests__/` beside its passes. `src/` itself may not: a test at the
 * root would be a test of a bare file, and there are none.
 */
const TESTS = "__tests__/";

/** A numbered pass inside a layer: `PARSE/1-Discover/`. */
const PASS = /^[^/]+\/\d+-[^/]+\/$/;

/**
 * Issue #1443: `src/` IS the pass table, and this is the gate that says so.
 *
 * Two halves, one per question README §1 says the path answers:
 *
 * - "Which pass owns this module?" -- `shapeFailures`: the first two levels of
 *   `src/` are exactly the tree README §1 draws. The tree is read from the
 *   README rather than copied here, so the document and the gate cannot
 *   disagree; editing the drawing is how the layout changes.
 * - "May it read that?" -- `orderFailures`: no module reaches a later pass.
 *   The rules live in `.dependency-cruiser.cjs`; this reports theirs, so a
 *   module moved into the wrong pass fails here whether or not the tree shape
 *   still matches.
 *
 * The rules are generated from `PASS_ORDER`, a second list of the same places,
 * so `placeFailures` holds the two together: a pass drawn in the tree but
 * absent from `PASS_ORDER` would be bound by no rule, and both halves above
 * would still pass (#1922 review).
 */
class Layout {
  /**
   * README §1's tree, as `src/`-relative entries: `PARSE/`,
   * `PARSE/1-Discover/`, `TRANSPILE/CodeGenWalker.ts`. A directory ends in
   * `/`; indentation is two spaces a level.
   */
  static tree(readme: string): string[] {
    const heading = readme.indexOf(TREE_HEADING);
    if (heading === -1) {
      throw new Error(`README has no "${TREE_HEADING}" heading`);
    }
    const open = readme.indexOf("```", heading);
    const close = readme.indexOf("```", open + 3);
    if (open === -1 || close === -1) {
      throw new Error(`"${TREE_HEADING}" is not followed by a fenced tree`);
    }
    const lines = readme
      .slice(readme.indexOf("\n", open) + 1, close)
      .split("\n")
      .filter((line) => line.trim().length > 0);
    if (lines[0]?.trim() !== "src/") {
      throw new Error(
        `the tree under "${TREE_HEADING}" does not start at src/`,
      );
    }

    const parents: string[] = [];
    const entries: string[] = [];
    for (const line of lines.slice(1)) {
      const indent = line.length - line.trimStart().length;
      const depth = indent / 2;
      if (!Number.isInteger(depth) || depth < 1 || depth > parents.length + 1) {
        throw new Error(`the tree's line "${line}" is not indented by levels`);
      }
      const name = line.trim();
      parents.length = depth - 1;
      entries.push(parents.join("") + name);
      parents.push(name);
    }
    return entries;
  }

  /**
   * What `src/` holds at the depths the tree draws: every child of `src/`, and
   * every child of a directory the tree lists children for.
   */
  static present(srcDir: string, tree: readonly string[]): string[] {
    const listed = (dir: string, prefix: string): string[] =>
      readdirSync(join(srcDir, dir), { withFileTypes: true }).map(
        (entry) => prefix + entry.name + (entry.isDirectory() ? "/" : ""),
      );
    const present = listed(".", "");
    for (const parent of Layout.parents(tree)) {
      if (present.includes(parent)) present.push(...listed(parent, parent));
    }
    return present;
  }

  static shapeFailures(
    tree: readonly string[],
    present: readonly string[],
  ): ILayoutFailure[] {
    const parents = Layout.parents(tree);
    const failures: ILayoutFailure[] = [];
    for (const entry of tree) {
      if (!present.includes(entry))
        failures.push({ kind: "missing", detail: entry });
    }
    for (const entry of present) {
      if (tree.includes(entry)) continue;
      const inALayer = parents.some((parent) => entry === parent + TESTS);
      if (!inALayer) failures.push({ kind: "unexpected", detail: entry });
    }
    return failures;
  }

  /**
   * The order half. `ruleNames` is every rule the config defines: a config
   * with no order rule would report no order violation, which is a broken
   * selector reporting a clean tree, so it is a failure of its own.
   */
  static orderFailures(
    ruleNames: readonly string[],
    violations: readonly IDepcruiseViolation[],
  ): ILayoutFailure[] {
    if (!ruleNames.some((name) => ORDER_RULE.test(name))) {
      throw new Error(
        "`.dependency-cruiser.cjs` defines no `*-reads-no-later-pass` rule, so " +
          "no module could be reported in the wrong pass",
      );
    }
    return violations
      .filter((violation) => ORDER_RULE.test(violation.rule?.name ?? ""))
      .map((violation) => ({
        kind: "order",
        detail: `${violation.from} -> ${violation.to} (${violation.rule?.name})`,
      }));
  }

  /**
   * `PASS_ORDER`, as the generated rules carry it: the first rule's place,
   * then every place it may not reach.
   */
  static places(
    forbidden: ReadonlyArray<{
      name: string;
      from?: { path?: string };
      to?: { path?: string | readonly string[] };
    }>,
  ): string[] {
    const first = forbidden.find((rule) => ORDER_RULE.test(rule.name));
    const later = first?.to?.path;
    if (first?.from?.path === undefined || !Array.isArray(later)) {
      throw new Error(
        "`.dependency-cruiser.cjs`'s first `*-reads-no-later-pass` rule does " +
          "not carry PASS_ORDER (a `from.path` and a `to.path` list)",
      );
    }
    return [first.from.path, ...later];
  }

  /**
   * The tree and `PASS_ORDER` describe one order. Every entry the tree draws
   * inside a layer -- its passes and the files beside them -- is covered by
   * exactly one place; every place covers something drawn; and the numbered
   * passes appear in `PASS_ORDER` in the order the tree draws them.
   */
  static placeFailures(
    tree: readonly string[],
    places: readonly string[],
  ): ILayoutFailure[] {
    const layers = Layout.parents(tree);
    const inLayers = tree.filter((entry) =>
      layers.some((layer) => entry !== layer && entry.startsWith(layer)),
    );
    const covers = (place: string, entry: string): boolean =>
      new RegExp(place).test(`src/${entry}`);
    const failures: ILayoutFailure[] = [];
    for (const entry of inLayers) {
      const covering = places.filter((place) => covers(place, entry)).length;
      if (covering !== 1) {
        failures.push({
          kind: "place",
          detail: `${entry} is covered by ${covering} PASS_ORDER places, not 1`,
        });
      }
    }
    for (const place of places) {
      if (!inLayers.some((entry) => covers(place, entry))) {
        failures.push({
          kind: "place",
          detail: `${place} covers nothing README §1 draws`,
        });
      }
    }
    const positions = inLayers
      .filter((entry) => PASS.test(entry))
      .map((entry) => places.findIndex((place) => covers(place, entry)))
      .filter((position) => position !== -1);
    if (positions.some((position, i) => i > 0 && position < positions[i - 1])) {
      failures.push({
        kind: "place",
        detail: "PASS_ORDER lists the passes out of README §1's order",
      });
    }
    return failures;
  }

  /** Directories the tree lists children for: the layers. */
  private static parents(tree: readonly string[]): string[] {
    return tree.filter(
      (entry) =>
        entry.endsWith("/") &&
        tree.some((other) => other !== entry && other.startsWith(entry)),
    );
  }
}

export default Layout;
