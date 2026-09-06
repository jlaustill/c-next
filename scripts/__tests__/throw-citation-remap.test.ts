import { describe, expect, it } from "vitest";

import ThrowCitationRemap from "../diagnostics/ThrowCitationRemap";

const FILE = "src/transpiler/output/codegen/Sample.ts";

/** Two throws with distinct messages, at lines 2 and 6. */
const SAMPLE = [
  "function a() {", //                       1
  '  throw new Error("alpha failure");', //  2
  "}", //                                    3
  "", //                                     4
  "function b() {", //                       5
  '  throw new Error("beta failure");', //   6
  "}", //                                    7
].join("\n");

const sources = (source = SAMPLE): Map<string, string> =>
  new Map([[FILE, source]]);

const row = (line: number, anchor: string): string =>
  `| \`codegen/Sample.ts:${line}\` | \`${anchor}\` | why |`;

describe("ThrowCitationRemap.remap", () => {
  it("moves a row to the line its anchor now identifies", () => {
    // The whole point: an edit above a throw shifts it, and the anchor is what
    // says which throw the row meant. `:4` is stale; `beta failure` is not.
    const result = ThrowCitationRemap.remap(row(4, "beta failure"), sources());
    expect(result.markdown).toContain("`codegen/Sample.ts:6`");
    expect(result.changes).toEqual([
      { path: "codegen/Sample.ts", from: 4, to: 6, anchor: "beta failure" },
    ]);
    expect(result.refusals).toEqual([]);
  });

  it("leaves a row that is already correct, and reports no change", () => {
    const result = ThrowCitationRemap.remap(row(2, "alpha failure"), sources());
    expect(result.markdown).toContain("`codegen/Sample.ts:2`");
    expect(result.changes).toEqual([]);
  });

  it("leaves a shared-anchor row alone when its own line is one of the matches", () => {
    // Nine real sites share `Error: 'this' can only be used inside a scope`.
    // Their rows are valid -- invariants 1 and 3 hold -- and the gate treats
    // identically-messaged sites as interchangeable because the source draws no
    // distinction between them either. Refusing them would put every one in the
    // warning list on a run with nothing to fix.
    const twins = [
      "function a() {",
      '  throw new Error("shared message");',
      "}",
      "function b() {",
      '  throw new Error("shared message");',
      "}",
    ].join("\n");
    const result = ThrowCitationRemap.remap(
      row(5, "shared message"),
      sources(twins),
    );
    expect(result.refusals).toEqual([]);
    expect(result.changes).toEqual([]);
    expect(result.markdown).toBe(row(5, "shared message"));
  });

  it("refuses when the anchor matches two throws, rather than picking one", () => {
    // This is the reason the GATE has no fixer: nine real sites share the
    // message `Error: 'this' can only be used inside a scope`, so a fixer that
    // guessed would silently reattribute a row to the wrong site and the gate
    // would then certify the guess. Refusing keeps the guess out.
    const twins = [
      "function a() {",
      '  throw new Error("shared message");',
      "}",
      "function b() {",
      '  throw new Error("shared message");',
      "}",
    ].join("\n");
    const result = ThrowCitationRemap.remap(
      row(9, "shared message"),
      sources(twins),
    );
    expect(result.markdown).toContain("`codegen/Sample.ts:9`");
    expect(result.changes).toEqual([]);
    expect(result.refusals).toHaveLength(1);
    expect(result.refusals[0]).toContain("2 throws");
  });

  it("maps a shared-anchor group in order when the counts match", () => {
    // Three rows sharing an anchor, three candidates, all rows stale. A
    // deletion above them shifts every survivor by the same amount and cannot
    // reorder them, so the ascending pairing is a derivation rather than a
    // guess -- and its precondition is the equal counts.
    const triplets = [
      "// a line",
      "// another",
      'throw new Error("same text");',
      "//",
      'throw new Error("same text");',
      "//",
      'throw new Error("same text");',
    ].join("\n");
    const markdown = [
      row(6, "same text"),
      row(8, "same text"),
      row(10, "same text"),
    ].join("\n");
    const result = ThrowCitationRemap.remap(markdown, sources(triplets));
    expect(result.refusals).toEqual([]);
    expect(result.markdown).toBe(
      [row(3, "same text"), row(5, "same text"), row(7, "same text")].join(
        "\n",
      ),
    );
  });

  it("still refuses when one of the group was deleted, so the counts differ", () => {
    // Three rows, two candidates: one of the three throws is gone and nothing
    // says which. Pairing in order would silently reattribute two rows.
    const pair = [
      'throw new Error("same text");',
      "//",
      'throw new Error("same text");',
    ].join("\n");
    const markdown = [
      row(6, "same text"),
      row(8, "same text"),
      row(10, "same text"),
    ].join("\n");
    const result = ThrowCitationRemap.remap(markdown, sources(pair));
    expect(result.changes).toEqual([]);
    expect(result.refusals).toHaveLength(3);
  });

  it("refuses when the anchor matches no throw at all", () => {
    // The anchor itself is wrong, or the throw is gone. Either way the row
    // needs a human: there is nothing to move it to.
    const result = ThrowCitationRemap.remap(row(2, "gamma failure"), sources());
    expect(result.changes).toEqual([]);
    expect(result.refusals[0]).toContain("no throw");
  });

  it("refuses a row that carries no anchor", () => {
    // Pre-#1374 rows have no anchor, so nothing identifies their site.
    const result = ThrowCitationRemap.remap(
      "| `codegen/Sample.ts:4` | prose, not an anchor | why |",
      sources(),
    );
    expect(result.changes).toEqual([]);
    expect(result.refusals[0]).toContain("no anchor");
  });

  it("refuses a row whose file does not resolve", () => {
    const result = ThrowCitationRemap.remap(
      "| `codegen/Missing.ts:4` | `alpha failure` | why |",
      sources(),
    );
    expect(result.changes).toEqual([]);
    expect(result.refusals[0]).toContain("no single file");
  });

  it("rewrites only the cited line, leaving the rest of the row intact", () => {
    const result = ThrowCitationRemap.remap(row(4, "beta failure"), sources());
    expect(result.markdown).toBe(row(6, "beta failure"));
  });

  it("remaps several rows in one pass, including two in the same file", () => {
    const shifted = ["// a new import line", ...SAMPLE.split("\n")].join("\n");
    const markdown = [row(2, "alpha failure"), row(6, "beta failure")].join(
      "\n",
    );
    const result = ThrowCitationRemap.remap(markdown, sources(shifted));
    expect(result.markdown).toBe(
      [row(3, "alpha failure"), row(7, "beta failure")].join("\n"),
    );
    expect(result.changes).toHaveLength(2);
  });

  it("reports a prose citation that no longer lands on a throw, and does not move it", () => {
    // Prose carries no anchor, so nothing says which throw it meant. Invariant
    // 5 fails on it; the remapper names it so the author knows what to edit,
    // rather than silently leaving the document un-fixable by the gate.
    const result = ThrowCitationRemap.remap(
      "Only `Sample.ts:3` still does this.",
      sources(),
    );
    expect(result.markdown).toContain("`Sample.ts:3`");
    expect(result.refusals.some((r) => r.includes("prose"))).toBe(true);
  });

  it("names the DOCUMENT line a bad prose citation sits on", () => {
    // Checking prose one line at a time makes every report say line 1, which
    // is worse than no line: it points confidently at the wrong place. The
    // first version of this remapper did exactly that, and the test above
    // could not tell -- it only asserted the word "prose" appeared.
    const result = ThrowCitationRemap.remap(
      ["intro", "filler", "Only `Sample.ts:3` still does this."].join("\n"),
      sources(),
    );
    expect(result.refusals[0]).toContain(
      "output-throw-classification.md:3: Sample.ts:3",
    );
  });

  it("does not report prose that the row remap has already made correct", () => {
    // Prose is checked against the rewritten document, so a citation that only
    // looked wrong before the rows moved is not reported as needing a hand fix.
    const result = ThrowCitationRemap.remap(row(4, "beta failure"), sources());
    expect(result.refusals).toEqual([]);
  });
});
