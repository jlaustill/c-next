import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import Layout from "../layout/Layout";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readme = readFileSync(
  join(repoRoot, "docs", "architecture", "README.md"),
  "utf-8",
);
const tree = Layout.tree(readme);
const present = Layout.present(join(repoRoot, "src"), tree);
const places = Layout.places(
  (
    createRequire(import.meta.url)(
      join(repoRoot, ".dependency-cruiser.cjs"),
    ) as { forbidden: Parameters<typeof Layout.places>[0] }
  ).forbidden,
);

const drawing = (body: string): string =>
  `### The layout is the pass table\n\n\`\`\`\n${body}\`\`\`\n`;

describe("Layout.tree — README §1's drawing, as entries", () => {
  it("reads directories and files, each under its parent", () => {
    expect(
      Layout.tree(
        drawing(
          "src/\n  PARSE/\n    1-Discover/\n  TRANSPILE/\n    CodeGenWalker.ts\n  lib/\n",
        ),
      ),
    ).toEqual([
      "PARSE/",
      "PARSE/1-Discover/",
      "TRANSPILE/",
      "TRANSPILE/CodeGenWalker.ts",
      "lib/",
    ]);
  });

  it("refuses a drawing that does not start at src/", () => {
    expect(() => Layout.tree(drawing("lib/\n  PARSE/\n"))).toThrow(/src\//);
  });

  it("refuses a line indented by an odd number of spaces", () => {
    expect(() => Layout.tree(drawing("src/\n   PARSE/\n"))).toThrow(/levels/);
  });

  it("refuses a README with no tree heading", () => {
    expect(() => Layout.tree("# nothing here\n")).toThrow(/heading/);
  });
});

describe("Layout.shapeFailures — src/ is exactly the drawing", () => {
  // The control every mutation below departs from: the real src/ passes. A
  // check that also failed here would make every red result below meaningless.
  it("passes the real src/", () => {
    expect(Layout.shapeFailures(tree, present)).toEqual([]);
  });

  it("lists the layer interiors, so a stray file beside the passes is seen", () => {
    expect(present).toContain("PARSE/1-Discover/");
    expect(present).toContain("TRANSPILE/CodeGenWalker.ts");
  });

  it.each([
    ["the old orchestrator root", "transpiler/"],
    ["a bare file at src/", "index.ts"],
    ["a test directory at src/", "__tests__/"],
    ["a fifth PARSE pass", "PARSE/5-Extra/"],
    [
      "a module beside TRANSPILE's passes that the tree does not draw",
      "TRANSPILE/Planner.ts",
    ],
    ["a state directory", "TRANSPILE/state/"],
  ])("fails on %s", (_label, entry) => {
    expect(present).not.toContain(entry);
    expect(Layout.shapeFailures(tree, [...present, entry])).toEqual([
      { kind: "unexpected", detail: entry },
    ]);
  });

  it("fails when a pass the tree draws is gone", () => {
    const without = present.filter((entry) => entry !== "WRITE/1-Write/");
    expect(without).toHaveLength(present.length - 1);
    expect(Layout.shapeFailures(tree, without)).toEqual([
      { kind: "missing", detail: "WRITE/1-Write/" },
    ]);
  });

  // Negative control for the one allowance: tests sit beside what they test,
  // inside a layer -- but not at src/, which the case above already fails.
  it("allows a layer's own __tests__/", () => {
    expect(present).toContain("TRANSPILE/__tests__/");
    expect(
      Layout.shapeFailures(tree, [...present, "PARSE/__tests__/"]),
    ).toEqual([]);
  });
});

describe("Layout.placeFailures — the tree and PASS_ORDER are one order", () => {
  // The control: the real drawing against the real PASS_ORDER.
  it("passes README §1 against .dependency-cruiser.cjs", () => {
    expect(Layout.placeFailures(tree, places)).toEqual([]);
  });

  // #1922 review: drawn here, a fifth pass was bound by no order rule, and
  // both other halves of the gate passed a module there that read 2.3 and 3.1.
  it("fails on a pass the tree draws and PASS_ORDER lacks", () => {
    expect(Layout.placeFailures([...tree, "PARSE/5-Link/"], places)).toEqual([
      {
        kind: "place",
        detail: "PARSE/5-Link/ is covered by 0 PASS_ORDER places, not 1",
      },
    ]);
  });

  it("fails when a place loses one arm of what it covers", () => {
    const state = places.findIndex((place) => place.includes("TranspileState"));
    expect(state).not.toBe(-1);
    const narrowed = places.map((place, index) =>
      index === state ? "^src/TRANSPILE/TranspileState\\.ts$" : place,
    );
    expect(Layout.placeFailures(tree, narrowed)).toEqual([
      {
        kind: "place",
        detail: "TRANSPILE/types/ is covered by 0 PASS_ORDER places, not 1",
      },
    ]);
  });

  it("fails on a place that covers nothing drawn", () => {
    expect(
      Layout.placeFailures(tree, [...places, "^src/WRITE/2-Flush/"]),
    ).toEqual([
      {
        kind: "place",
        detail: "^src/WRITE/2-Flush/ covers nothing README §1 draws",
      },
    ]);
  });

  it("fails when PASS_ORDER lists two passes the other way round", () => {
    const swapped = [places[1], places[0], ...places.slice(2)];
    expect(Layout.placeFailures(tree, swapped)).toEqual([
      {
        kind: "place",
        detail: "PASS_ORDER lists the passes out of README §1's order",
      },
    ]);
  });
});

describe("Layout.orderFailures — no module reaches a later pass", () => {
  const rules = ["2-2-plan-reads-no-later-pass", "no-circular"];

  it("reports a violation of an order rule", () => {
    expect(
      Layout.orderFailures(rules, [
        {
          from: "src/TRANSPILE/2-Plan/X.ts",
          to: "src/TRANSPILE/3-Render/Y.ts",
          rule: { name: "2-2-plan-reads-no-later-pass" },
        },
      ]),
    ).toEqual([
      {
        kind: "order",
        detail:
          "src/TRANSPILE/2-Plan/X.ts -> src/TRANSPILE/3-Render/Y.ts (2-2-plan-reads-no-later-pass)",
      },
    ]);
  });

  // `npm run depcruise` owns every other rule; this gate reports only its own.
  it("ignores a violation of any other rule", () => {
    expect(
      Layout.orderFailures(rules, [
        { from: "src/a.ts", to: "src/b.ts", rule: { name: "no-circular" } },
      ]),
    ).toEqual([]);
  });

  it("refuses a config with no order rule, rather than reporting it clean", () => {
    expect(() => Layout.orderFailures(["no-circular"], [])).toThrow(
      /reads-no-later-pass/,
    );
  });
});
