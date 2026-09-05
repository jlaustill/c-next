import { describe, expect, it } from "vitest";

import ThrowCitations from "../diagnostics/ThrowCitations";

const FILE = "src/transpiler/output/codegen/Sample.ts";

/**
 * Two throws, at lines 2 and 5. The second spans three lines -- the shape 155
 * of the 181 real sites take (#1374) -- so every `check` test below exercises
 * a statement whose text is not on its cited line.
 */
const SAMPLE = [
  "function a() {",
  '  throw new Error("first failure");',
  "}",
  "function b() {",
  "  throw new TypeError(",
  "    `second failure at ${where}`,",
  "  );",
  "}",
].join("\n");

/**
 * Two DIFFERENT throws that share a prefix, at lines 2 and 5 -- the shape the
 * #1374 review found three times in the shipped document: an anchor that
 * stops before the discriminator matches both, and the rows can trade.
 */
const COUSINS = [
  "function a() {",
  '  throw new Error("shared prefix alpha");',
  "}",
  "function b() {",
  '  throw new Error("shared prefix beta");',
  "}",
].join("\n");

const sources = (source = SAMPLE): Map<string, string> =>
  new Map([[FILE, source]]);

describe("ThrowCitations.parse", () => {
  it("reads a citation and its anchor from the first two cells of a row", () => {
    expect(
      ThrowCitations.parse("| `Sample.ts:12` | `first failure` | why |"),
    ).toEqual([{ path: "Sample.ts", line: 12, anchor: "first failure" }]);
  });

  it("accepts the abbreviated `…/` path form the document uses", () => {
    expect(
      ThrowCitations.parse(
        "| `…/Deeply/Nested.ts:7` | `first failure` | why |",
      ),
    ).toEqual([
      { path: "…/Deeply/Nested.ts", line: 7, anchor: "first failure" },
    ]);
  });

  // The pre-#1374 row shape put prose second, and prose may open with a code
  // span -- `this.Type` outside a scope -- which must not be mistaken for an
  // anchor. Only a cell that IS a code span is a claim this gate defends.
  it.each([
    [
      "prose opening with a code span",
      "| `Sample.ts:12` | `this.Type` outside a scope |",
    ],
    ["plain prose", "| `Sample.ts:12` | why |"],
  ])("reads a null anchor when the second cell is %s", (_, row) => {
    expect(ThrowCitations.parse(row)).toEqual([
      { path: "Sample.ts", line: 12, anchor: null },
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

describe("ThrowCitations.throwArgument", () => {
  it("returns what a single-line throw says, without its `throw new Ctor(` opener", () => {
    // The opener is scaffolding every site shares; an anchor drawn from it
    // (`Error(`) would corroborate every row.
    expect(ThrowCitations.throwArgument(SAMPLE, 2)).toBe('"first failure");');
  });

  it("joins a multi-line statement to its terminating `;` with whitespace collapsed", () => {
    expect(ThrowCitations.throwArgument(SAMPLE, 5)).toBe(
      "`second failure at ${where}`, );",
    );
  });

  it("skips a `//` comment line inside the statement: not anchor material, not a terminator", () => {
    // PostfixExpressionGenerator.ts:629 carries a three-line comment between
    // the opener and the message. A comment is not what the throw says, and
    // one ending in `;` must not end the scan before the message.
    const commented = [
      "throw new Error(",
      "  // see the guard at foo;",
      '  "real message",',
      ");",
    ].join("\n");
    expect(ThrowCitations.throwArgument(commented, 1)).toBe(
      '"real message", );',
    );
  });

  it("strips a generic constructor's opener", () => {
    // `throwLines` counts any `throw new` line; the strip must not accept a
    // narrower shape, or the opener survives into the text it returns.
    expect(
      ThrowCitations.throwArgument('throw new SomeError<T>("boom");', 1),
    ).toBe('"boom");');
  });

  it("returns null when the statement opens no argument", () => {
    expect(ThrowCitations.throwArgument("throw new Error;", 1)).toBeNull();
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
  const ROW2 = "| `Sample.ts:2` | `first failure` | why |";
  const ROW5 = "| `Sample.ts:5` | `second failure` | why |";

  it("passes when every throw is cited exactly once, each with its anchor", () => {
    // Negative control for the anchor check: an untouched document stays
    // green, including the anchor that sits on line 6 of a throw cited at :5.
    const outcome = ThrowCitations.check(docFor(ROW2, ROW5), sources());
    expect(outcome.ok).toBe(true);
    expect(outcome.errors).toEqual([]);
    expect(outcome.info[0]).toContain("2 citation(s)");
  });

  it("fails two rows that trade line numbers between sites with different messages", () => {
    // #1374. Both swapped lines ARE throw lines, so membership in each
    // direction still holds and the pre-anchor gate stayed green with both
    // rows describing each other's site. Only the anchor can tell.
    const outcome = ThrowCitations.check(
      docFor(
        "| `Sample.ts:5` | `first failure` | why |",
        "| `Sample.ts:2` | `second failure` | why |",
      ),
      sources(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toHaveLength(2);
    expect(outcome.errors[0]).toContain("Sample.ts:5");
    expect(outcome.errors[0]).toContain("`first failure`");
    expect(outcome.errors[1]).toContain("Sample.ts:2");
    expect(outcome.errors[1]).toContain("`second failure`");
  });

  it("stays green when two identically-messaged sites trade line numbers", () => {
    // Negative control. Nine real sites throw the same text; their rows are
    // interchangeable, and the anchor corroborates a row rather than keying
    // it (#1374). A gate that failed here would be demanding a distinction
    // the source does not make.
    const twins = [
      "function a() {",
      "  throw new Error(\"Error: 'this' can only be used inside a scope\");",
      "}",
      "function b() {",
      "  throw new Error(\"Error: 'this' can only be used inside a scope\");",
      "}",
    ].join("\n");
    const outcome = ThrowCitations.check(
      docFor(
        "| `Sample.ts:5` | `can only be used inside a scope` | first site |",
        "| `Sample.ts:2` | `can only be used inside a scope` | second site |",
      ),
      sources(twins),
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.errors).toEqual([]);
  });

  it("fails a row that carries no anchor", () => {
    // Optional would be the #1143 shape: a row #1322 adds without one is a
    // row the swap check cannot defend.
    const outcome = ThrowCitations.check(
      docFor("| `Sample.ts:2` | why |", ROW5),
      sources(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]).toContain("Sample.ts:2");
    expect(outcome.errors[0]).toContain("no anchor");
  });

  it("fails an anchor too short to tell sites apart", () => {
    // `failure` is in both of SAMPLE's throws. The floor is what stops an
    // anchor of `Error` or `'` from corroborating every row in the document.
    const outcome = ThrowCitations.check(
      docFor("| `Sample.ts:2` | `failure` | why |", ROW5),
      sources(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]).toContain("`failure`");
    expect(outcome.errors[0]).toContain("shorter than");
  });

  it("fails an anchor drawn from the opener every site shares", () => {
    // `new Error(` is long enough to clear the floor and appears in every
    // statement. The opener is removed before matching so that scaffolding
    // cannot corroborate a row.
    const outcome = ThrowCitations.check(
      docFor("| `Sample.ts:2` | `new Error(` | why |", ROW5),
      sources(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]).toContain("`new Error(`");
    expect(outcome.errors[0]).toContain("not found");
  });

  it("reports a throw whose opener it cannot strip rather than matching against it", () => {
    // `throw new Error;` is counted by throwLines but opens no argument. Left
    // silent, `new Error;` would be a legal anchor corroborating every such
    // site -- the universally-true anchor the strip exists to prevent.
    const outcome = ThrowCitations.check(
      docFor("| `Sample.ts:1` | `new Error;` | why |"),
      sources("throw new Error;"),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]).toContain("Sample.ts:1");
    expect(outcome.errors[0]).toContain("opener");
  });

  it("fails two rows in one file whose anchors would survive a trade", () => {
    // Invariant 4. Each anchor matches its own line AND the other's, so the
    // rows could swap line numbers undetected. Different throws, so this is
    // not the identical-message exemption.
    const outcome = ThrowCitations.check(
      docFor(
        "| `Sample.ts:2` | `shared prefix` | why |",
        "| `Sample.ts:5` | `shared prefix` | why |",
      ),
      sources(COUSINS),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]).toContain("Sample.ts:2");
    expect(outcome.errors[0]).toContain(":5");
    expect(outcome.errors[0]).toContain("trade");
  });

  // A trade is caught by whichever anchor fails on the other's line, so one
  // distinguishing anchor per pair is enough -- the remedy the error names.
  // Both placements, because a check that tests only one direction passes
  // whichever placement it happens to look at (found by mutation).
  it.each([
    [
      "first",
      "| `Sample.ts:2` | `shared prefix alpha` | why |",
      "| `Sample.ts:5` | `shared prefix` | why |",
    ],
    [
      "second",
      "| `Sample.ts:2` | `shared prefix` | why |",
      "| `Sample.ts:5` | `shared prefix beta` | why |",
    ],
  ])(
    "passes when the %s of two overlapping rows carries a distinguishing anchor",
    (_, rowA, rowB) => {
      const outcome = ThrowCitations.check(
        docFor(rowA, rowB),
        sources(COUSINS),
      );
      expect(outcome.ok).toBe(true);
      expect(outcome.errors).toEqual([]);
    },
  );

  it("fails a citation that has drifted, and names the nearest throw", () => {
    const outcome = ThrowCitations.check(
      docFor("| `Sample.ts:3` | `first failure` | why |", ROW5),
      sources(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors[0]).toContain("Sample.ts:3");
    expect(outcome.errors[0]).toContain("nearest is :2");
    // Two errors, not three: the drift, and the throw at :2 the drifted row
    // left unclaimed. A line holding no throw has nothing to anchor against,
    // so the anchor check stays silent rather than piling on (#1374).
    expect(outcome.errors).toHaveLength(2);
    expect(outcome.errors.some((e) => e.includes("anchor"))).toBe(false);
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
      docFor("| `Missing.ts:1` | `first failure` | why |", ROW2, ROW5),
      sources(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors[0]).toContain("no single file matches");
  });

  it("reports a drifted citation with no throws at all in the file", () => {
    const outcome = ThrowCitations.check(
      docFor("| `Sample.ts:1` | `first failure` | why |"),
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
    "| `Sample.ts:2` | `first failure` | why |",
    "",
    "## Bucket 2 — internal invariants (1)",
    "| `Sample.ts:5` | `second failure` | why |",
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
      "| `Sample.ts:2` | `first failure` | why |",
      "| `Sample.ts:5` | `second failure` | why |",
      "## Next",
    ].join("\n");
    const sections = ThrowCitations.bucketCounts(md);
    expect(sections.map((s) => s.rows).sort()).toEqual([2, 2]);
    expect(sections.every((s) => s.declared === s.rows)).toBe(true);
  });
});
