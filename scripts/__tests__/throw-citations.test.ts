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
    // Only a row's first cell is a CITATION -- prose carries no anchor and no
    // bucket, so it is not a row. That is a statement about `parse`, not about
    // whether prose is checked: since #1322 it is, by `checkProse`, which holds
    // it to landing on a throw. The rationale here used to read "failing on it
    // would make the document impossible to write", and the measurement
    // disagreed -- 14 of 59 prose citations had rotted while the gated rows sat
    // at 0% drift.
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

  it("counts a throw whose Error comes from a factory, not from `new` (#1322)", () => {
    // The corpus was believed to be uniformly `throw new`, and this method
    // required that spelling. It is not: `CodeGenErrors` builds its Errors with
    // `return new Error(...)` and callers write `throw CodeGenErrors.x(...)`, so
    // three production sites in `output/` were invisible to every invariant this
    // gate enforces -- including `SubscriptDepthValidator.ts:95`, which carries
    // E0856 and is asserted by two fixtures. A diagnostic the classifier cannot
    // see is one #1322 cannot relocate.
    const source = [
      "const x = 1;",
      "throw CodeGenErrors.tooManySubscripts(line, varName);",
      "throw new Error('ordinary');",
    ].join("\n");
    expect(ThrowCitations.throwLines(source)).toEqual([2, 3]);
  });

  it("does not count a bare rethrow, which opens no argument to anchor", () => {
    expect(ThrowCitations.throwLines("throw err;")).toEqual([]);
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

  it("strips a factory call's opener, so its anchor is the message (#1322)", () => {
    // Without `new`, the opener is `throw CodeGenErrors.tooManySubscripts(`.
    // If it survived, it would be a valid anchor for every site that shares the
    // factory -- the universally-true anchor the strip exists to prevent.
    expect(
      ThrowCitations.throwArgument(
        'throw CodeGenErrors.tooManySubscripts("too many subscripts");',
        1,
      ),
    ).toBe('"too many subscripts");');
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

describe("ThrowCitations.checkProse", () => {
  // #1322: the gate defended table rows and left prose alone, on the reasoning
  // that prose is not a claim. It is: 14 of 59 prose citations had drifted --
  // every one of them short by the same 4-6 lines an intervening edit added --
  // while the 181 gated rows were at 0% drift. The tier tables and the split
  // that sizes this card's phases are built on that prose, so a stale prose
  // number is not decoration; it mis-sizes the work.
  const SOURCES = new Map([
    [
      "src/transpiler/output/codegen/Thing.ts",
      'const a = 1;\nthrow new Error("boom");\n',
    ],
  ]);

  it("fails a prose citation that does not land on a throw", () => {
    const markdown = "Only `Thing.ts:1` still does this.\n";
    const outcome = ThrowCitations.checkProse(markdown, SOURCES);
    expect(outcome.some((e) => e.includes("prose"))).toBe(true);
  });

  it("accepts a prose citation that lands on a throw", () => {
    expect(ThrowCitations.checkProse("See `Thing.ts:2`.\n", SOURCES)).toEqual(
      [],
    );
  });

  it("ignores a citation row, which the row invariants already defend", () => {
    // A row's line is checked by invariant 1 with its anchor; re-checking it
    // here would report one drift twice and say nothing new.
    expect(
      ThrowCitations.checkProse("| `Thing.ts:1` | `boom` | dead |\n", SOURCES),
    ).toEqual([]);
  });

  it("reports every line in a slash-joined list, not only the first", () => {
    // `Thing.ts:1/2` is the shape the drifted prose used, and a parser that
    // reads only the first number would have called this document clean.
    const outcome = ThrowCitations.checkProse("`Thing.ts:1/2`\n", SOURCES);
    expect(outcome).toHaveLength(1);
    expect(outcome[0]).toContain("Thing.ts:1");
  });

  it("fails a descending range, which cannot be a span", () => {
    // The document carried `CodeGenerator.ts:4985-4767`.
    const outcome = ThrowCitations.checkProse("`Thing.ts:9-2`\n", SOURCES);
    expect(outcome.some((e) => e.includes("descending"))).toBe(true);
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

describe("ThrowCitations.remap (#1518)", () => {
  const doc = (line: number): string =>
    `| \`Gen.ts:${line}\` | \`boom\` | why |\n`;

  const previous = ["a", "b", 'throw new Error("boom");', "c"].join("\n");

  it("moves a citation by however far its throw moved", () => {
    const current = [
      "a",
      "INSERTED",
      "b",
      'throw new Error("boom");',
      "c",
    ].join("\n");

    const outcome = ThrowCitations.remap(
      doc(3),
      new Map([["Gen.ts", { previous, current }]]),
    );

    expect(outcome.markdown).toBe(doc(4));
    expect(outcome.rewritten).toBe(1);
    expect(outcome.refusals).toEqual([]);
  });

  it("leaves a citation alone when nothing moved", () => {
    const outcome = ThrowCitations.remap(
      doc(3),
      new Map([["Gen.ts", { previous, current: previous }]]),
    );

    expect(outcome.markdown).toBe(doc(3));
  });

  // The case the original "no write mode" objection is right about: which row
  // means which is a judgement about content, so the tool declines it.
  it("falls back to the anchor when the throw count changed (#1322)", () => {
    // #1518 refused here, and was right that ORDINALS cannot decide a count
    // change. #1374 had already changed the inputs though: every row carries an
    // anchor, and `boom` names exactly one of the two throws below. Nothing is
    // guessed, so nothing needs refusing.
    //
    // It matters because a count change is #1322's normal case, not an edge
    // one: that card deletes 23 sites and relocates 145, so refusing on count
    // change refuses on every commit it makes.
    const current = [
      "a",
      'throw new Error("added");',
      "b",
      'throw new Error("boom");',
      "c",
    ].join("\n");

    const outcome = ThrowCitations.remap(
      doc(3),
      new Map([["Gen.ts", { previous, current }]]),
    );

    expect(outcome.markdown).toBe(doc(4));
    expect(outcome.rewritten).toBe(1);
    expect(outcome.refusals).toEqual([]);
  });

  it("still refuses a count change the anchor cannot decide", () => {
    // Two throws now share the row's anchor, and only one row claims it. The
    // group does not pair, so which one the row meant is a judgement about
    // content -- exactly #1518's objection, and it survives intact for the case
    // it was actually about.
    const current = [
      "a",
      'throw new Error("boom");',
      "b",
      'throw new Error("boom");',
      "c",
    ].join("\n");

    const outcome = ThrowCitations.remap(
      doc(3),
      new Map([["Gen.ts", { previous, current }]]),
    );

    expect(outcome.refusals).toHaveLength(1);
    expect(outcome.refusals[0]).toContain("count changed 1 -> 2");
    expect(outcome.refusals[0]).toContain("does not pair");
    expect(outcome.markdown).toBe(doc(3));
    expect(outcome.rewritten).toBe(0);
  });

  it("refuses a row that carries no anchor to re-find it by", () => {
    const current = [
      "a",
      'throw new Error("added");',
      "b",
      'throw new Error("boom");',
      "c",
    ].join("\n");

    const outcome = ThrowCitations.remap(
      "| `Gen.ts:3` | prose, not an anchor | why |\n",
      new Map([["Gen.ts", { previous, current }]]),
    );

    expect(outcome.refusals).toHaveLength(1);
    expect(outcome.refusals[0]).toContain("no anchor");
    expect(outcome.rewritten).toBe(0);
  });

  it("refuses one file without abandoning another", () => {
    const other = ["x", 'throw new Error("other");'].join("\n");
    const otherMoved = ["x", "y", 'throw new Error("other");'].join("\n");
    const broken = [previous, 'throw new Error("added");'].join("\n");

    const outcome = ThrowCitations.remap(
      `${doc(3)}| \`Other.ts:2\` | \`other\` | why |\n`,
      new Map([
        ["Gen.ts", { previous, current: broken }],
        ["Other.ts", { previous: other, current: otherMoved }],
      ]),
    );

    // `Gen.ts` changed count, but its row's anchor `boom` still names one
    // throw, so it is placed rather than refused; `Other.ts` moves by the line
    // map as before. Neither file's outcome depends on the other's.
    expect(outcome.refusals).toEqual([]);
    expect(outcome.markdown).toContain("Gen.ts:3");
    expect(outcome.markdown).toContain("Other.ts:3");
  });

  it("rewrites a citation written with a directory prefix", () => {
    const current = [
      "a",
      "INSERTED",
      "b",
      'throw new Error("boom");',
      "c",
    ].join("\n");

    const outcome = ThrowCitations.remap(
      "| `codegen/Gen.ts:3` | `boom` | why |\n",
      new Map([["Gen.ts", { previous, current }]]),
    );

    expect(outcome.markdown).toBe("| `codegen/Gen.ts:4` | `boom` | why |\n");
  });

  it("leaves a line it cannot place, rather than guessing one", () => {
    const outcome = ThrowCitations.remap(
      doc(9999),
      new Map([["Gen.ts", { previous, current: previous }]]),
    );

    expect(outcome.markdown).toBe(doc(9999));
    expect(outcome.rewritten).toBe(0);
  });

  it("ignores a file it was given no revision for", () => {
    const outcome = ThrowCitations.remap(
      "| `Absent.ts:7` | `x` | y |\n",
      new Map(),
    );

    expect(outcome.markdown).toBe("| `Absent.ts:7` | `x` | y |\n");
  });
});
