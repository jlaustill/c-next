import { describe, expect, it } from "vitest";

import ParseTreeSites from "../parse-tree/ParseTreeSites";

/**
 * Issue #1317. Every branch of `check` gets a mutation: a fixture that breaks
 * exactly one property and an assertion that the check fires. Feeding a gate
 * only correct input proves it can PASS, which is the failure mode the gate
 * exists to catch -- the argument `gate-roster.test.ts` makes and #1222 records
 * as regression fixtures that cannot fail when the fix is reverted.
 */

const violation = (from: string, to: string, rule = ParseTreeSites.RULE) => ({
  from,
  to,
  rule: { name: rule },
});

const GRAMMAR = "src/transpiler/logic/parser/grammar/CNextParser.ts";
const RUNTIME = "node_modules/antlr4ng/dist/index.cjs";

describe("ParseTreeSites.sites", () => {
  it("keeps only this rule's violations", () => {
    const sites = ParseTreeSites.sites([
      violation("src/utils/A.ts", GRAMMAR),
      violation("src/utils/B.ts", GRAMMAR, "no-circular"),
    ]);

    expect(sites.map((site) => site.module)).toEqual(["src/utils/A.ts"]);
  });

  it("collapses a module's several edges into one row", () => {
    // The document counts MODULES. Splitting one import into two statements is
    // not the coupling changing, so it must not move the number.
    const sites = ParseTreeSites.sites([
      violation("src/utils/A.ts", GRAMMAR),
      violation("src/utils/A.ts", RUNTIME),
    ]);

    expect(sites).toHaveLength(1);
    expect(sites[0].holds).toEqual(["antlr4ng", "grammar"]);
  });

  it("sorts by module so the committed diff is stable", () => {
    const sites = ParseTreeSites.sites([
      violation("src/utils/B.ts", GRAMMAR),
      violation("src/utils/A.ts", GRAMMAR),
    ]);

    expect(sites.map((site) => site.module)).toEqual([
      "src/utils/A.ts",
      "src/utils/B.ts",
    ]);
  });
});

describe("ParseTreeSites.layerOf", () => {
  it("prefers the longest prefix", () => {
    // The ordering IS the assertion: with `src/transpiler/` tested first, every
    // transpiler module collapses into one row and the render layer's share --
    // the number #1317 singles out -- disappears from the document.
    expect(ParseTreeSites.layerOf("src/transpiler/output/codegen/X.ts")).toBe(
      "src/transpiler/output/",
    );
    expect(ParseTreeSites.layerOf("src/transpiler/Transpiler.ts")).toBe(
      "src/transpiler/",
    );
  });

  it("falls back to a named root rather than undefined", () => {
    expect(ParseTreeSites.layerOf("src/index.ts")).toBe("src/ (root)");
  });
});

describe("ParseTreeSites.render", () => {
  const sites = ParseTreeSites.sites([
    violation("src/transpiler/output/A.ts", GRAMMAR),
    violation("src/utils/B.ts", RUNTIME),
  ]);

  it("states the total and the per-layer split", () => {
    const document = ParseTreeSites.render(sites);

    expect(document).toContain("| **total** | **2** |");
    expect(document).toContain("| `src/transpiler/output/` | 1 |");
  });

  it("emits no timestamp", () => {
    // #1150: a timestamp churns every run and makes a diff gate useless.
    expect(ParseTreeSites.render(sites)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("ParseTreeSites.check", () => {
  const sites = ParseTreeSites.sites([
    violation("src/transpiler/output/A.ts", GRAMMAR),
    violation("src/utils/B.ts", RUNTIME),
  ]);
  const committed = ParseTreeSites.render(sites);

  it("passes against the document the generator just produced", () => {
    expect(ParseTreeSites.check(committed, sites).ok).toBe(true);
  });

  it("tolerates Prettier's cell padding", () => {
    // The committed file is Prettier-formatted, which pads table cells to a
    // common width. A parser requiring single spaces fails against the very
    // file the generator wrote.
    const padded = committed.replace(
      "| `src/utils/B.ts` | antlr4ng |",
      "| `src/utils/B.ts`   |   antlr4ng   |",
    );

    expect(ParseTreeSites.check(padded, sites).ok).toBe(true);
  });

  it("fires when a module joins the population", () => {
    const grown = ParseTreeSites.sites([
      violation("src/transpiler/output/A.ts", GRAMMAR),
      violation("src/utils/B.ts", RUNTIME),
      violation("src/TRANSPILE/2-Plan/New.ts", GRAMMAR),
    ]);
    const outcome = ParseTreeSites.check(committed, grown);

    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).toContain("src/TRANSPILE/2-Plan/New.ts");
  });

  it("fires when the baseline is stale because a module left", () => {
    // Shrinkage must fail too. A stale baseline re-admits the departed module
    // for free, so the next rise is measured against a number nobody
    // re-derived.
    const shrunk = ParseTreeSites.sites([
      violation("src/transpiler/output/A.ts", GRAMMAR),
    ]);
    const outcome = ParseTreeSites.check(committed, shrunk);

    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).toContain("src/utils/B.ts");
  });

  it("reports the render-layer count, not just the total", () => {
    expect(ParseTreeSites.check(committed, sites).info.join()).toContain(
      "1 in the render layer",
    );
  });
});
