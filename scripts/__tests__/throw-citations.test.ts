import { describe, expect, it } from "vitest";

import ThrowCitations from "../diagnostics/ThrowCitations";

const FILE = "src/transpiler/output/codegen/Sample.ts";

/** Two throws, at lines 2 and 5. */
const SAMPLE = [
  "function a() {",
  '  throw new Error("first");',
  "}",
  "function b() {",
  '  throw new TypeError("second");',
  "}",
].join("\n");

const sources = (source = SAMPLE): Map<string, string> =>
  new Map([[FILE, source]]);

describe("ThrowCitations.parse", () => {
  it("reads a citation from the first cell of a table row", () => {
    expect(ThrowCitations.parse("| `Sample.ts:12` | why |")).toEqual([
      { path: "Sample.ts", line: 12 },
    ]);
  });

  it("accepts the abbreviated `…/` path form the document uses", () => {
    expect(ThrowCitations.parse("| `…/Deeply/Nested.ts:7` | why |")).toEqual([
      { path: "…/Deeply/Nested.ts", line: 7 },
    ]);
  });

  it("ignores a file:line mentioned in prose", () => {
    // Only a row's first cell is a claim this gate defends. Prose citing
    // `Sample.ts:99` is commentary, and failing on it would make the document
    // impossible to write.
    expect(ThrowCitations.parse("See `Sample.ts:99` for context.")).toEqual([]);
  });
});

describe("ThrowCitations.throwLines", () => {
  it("returns 1-based lines of every throw, whatever the constructor", () => {
    expect(ThrowCitations.throwLines(SAMPLE)).toEqual([2, 5]);
  });

  it("returns nothing for a file with no throws", () => {
    expect(ThrowCitations.throwLines("const x = 1;")).toEqual([]);
  });
});

describe("ThrowCitations.resolve", () => {
  const files = [FILE, "src/transpiler/output/headers/Other.ts"];

  it("matches on a path suffix", () => {
    expect(ThrowCitations.resolve("codegen/Sample.ts", files)).toBe(FILE);
  });

  it("falls back to a unique basename", () => {
    expect(ThrowCitations.resolve("…/Sample.ts", files)).toBe(FILE);
  });

  it("falls back to a unique basename when no suffix matches", () => {
    // The suffix branch cannot match `codegen/Sample.ts` against a file under
    // `handlers/`, so this is the only test that reaches the fallback and
    // returns from it -- the branch that decides which file a citation is
    // checked against.
    expect(
      ThrowCitations.resolve("codegen/Sample.ts", [
        "src/transpiler/output/handlers/Sample.ts",
      ]),
    ).toBe("src/transpiler/output/handlers/Sample.ts");
  });

  it("refuses an ambiguous basename rather than guessing", () => {
    // Picking one would let the gate pass while checking the wrong file.
    const ambiguous = [FILE, "src/transpiler/output/headers/Sample.ts"];
    expect(ThrowCitations.resolve("Sample.ts", ambiguous)).toBeNull();
  });
});

describe("ThrowCitations.check", () => {
  /** A minimal document citing both of SAMPLE's throws, with matching totals. */
  const docFor = (...rows: string[]): string =>
    [
      "|  | **total** | **" + rows.length + "** |",
      "| `codegen/` | " + rows.length + " |",
      "",
      "## Bucket 1 — user-facing (" + rows.length + ")",
      ...rows,
    ].join("\n");
  const ROW2 = "| `Sample.ts:2` | why |";
  const ROW5 = "| `Sample.ts:5` | why |";

  it("passes when every throw is cited exactly once", () => {
    const outcome = ThrowCitations.check(docFor(ROW2, ROW5), sources());
    expect(outcome.ok).toBe(true);
    expect(outcome.errors).toEqual([]);
    expect(outcome.info[0]).toContain("2 citation(s)");
  });

  it("fails a citation that has drifted, and names the nearest throw", () => {
    const outcome = ThrowCitations.check(
      docFor("| `Sample.ts:3` | why |", ROW5),
      sources(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors[0]).toContain("Sample.ts:3");
    expect(outcome.errors[0]).toContain("nearest is :2");
  });

  it("fails a throw that nobody classified", () => {
    // The invariant that catches growth, not just drift.
    const outcome = ThrowCitations.check(docFor(ROW2), sources());
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.some((e) => e.includes(":5"))).toBe(true);
    expect(outcome.errors.some((e) => e.includes("not classified"))).toBe(true);
  });

  it("fails a line cited more than once", () => {
    const outcome = ThrowCitations.check(docFor(ROW2, ROW5, ROW2), sources());
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.some((e) => e.includes("more than once"))).toBe(true);
  });

  it("fails every throw in a file the document does not mention at all", () => {
    // A brand-new file under output/ with no row anywhere in the document --
    // the shape this gate catches beyond drift.
    const outcome = ThrowCitations.check(docFor(), sources());
    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toHaveLength(2);
    expect(outcome.errors.every((e) => e.includes("not classified"))).toBe(
      true,
    );
  });

  it("fails a citation whose path matches no file", () => {
    const outcome = ThrowCitations.check(
      docFor("| `Missing.ts:1` | why |", ROW2, ROW5),
      sources(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors[0]).toContain("no single file matches");
  });

  it("reports a drifted citation with no throws at all in the file", () => {
    const outcome = ThrowCitations.check(
      docFor("| `Sample.ts:1` | why |"),
      sources("const x = 1;"),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors[0]).toContain("no `throw new` on that line");
    expect(outcome.errors[0]).not.toContain("nearest");
  });
});

describe("ThrowCitations.checkDeclaredCounts", () => {
  // #1365 one layer up: the document's own totals are the same kind of claim a
  // citation is, so adding a throw and its row must not leave one reading the
  // old figure.
  const doc = [
    "| bucket | count |",
    "| **1** | **1** |",
    "|  | **total** | **2** |",
    "| `codegen/` | 2 | 1 | 1 | 0 |",
    "",
    "## Bucket 1 — user-facing (1)",
    "| `Sample.ts:2` | why |",
    "",
    "## Bucket 2 — internal invariants (1)",
    "| `Sample.ts:5` | why |",
  ].join("\n");

  it("passes when every declared number matches the rows", () => {
    expect(ThrowCitations.checkDeclaredCounts(doc, 2)).toEqual([]);
  });

  it("fails a bucket heading whose count no longer matches its rows", () => {
    const stale = doc.replace(
      "internal invariants (1)",
      "internal invariants (5)",
    );
    const errors = ThrowCitations.checkDeclaredCounts(stale, 2);
    expect(errors.some((e) => e.includes("declares 5, has 1 row"))).toBe(true);
  });

  it("fails a stale total row", () => {
    const errors = ThrowCitations.checkDeclaredCounts(doc, 3);
    expect(
      errors.some((e) => e.includes("total says 2, document cites 3")),
    ).toBe(true);
  });

  it("fails a by-area table that no longer sums", () => {
    const stale = doc.replace("| `codegen/` | 2 |", "| `codegen/` | 9 |");
    const errors = ThrowCitations.checkDeclaredCounts(stale, 2);
    expect(errors.some((e) => e.includes("by-area table sums to 9"))).toBe(
      true,
    );
  });

  it("reports a missing total row rather than passing silently", () => {
    const errors = ThrowCitations.checkDeclaredCounts("## Bucket 1 — x (0)", 0);
    expect(errors.some((e) => e.includes("no **total** row"))).toBe(true);
  });
});

describe("ThrowCitations.bucketCounts", () => {
  it("counts a nested subsection's rows toward both it and its parent", () => {
    // `## Bucket 1 (2)` contains `### area — 2`; the rows belong to both, so a
    // section accumulates until the next heading of the same or higher level.
    const md = [
      "## Bucket 1 — user-facing (2)",
      "### `codegen/` root — 2",
      "| `Sample.ts:2` | why |",
      "| `Sample.ts:5` | why |",
      "## Next",
    ].join("\n");
    const sections = ThrowCitations.bucketCounts(md);
    expect(sections.map((s) => s.rows).sort()).toEqual([2, 2]);
    expect(sections.every((s) => s.declared === s.rows)).toBe(true);
  });
});
