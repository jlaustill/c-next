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
