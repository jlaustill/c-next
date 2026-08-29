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

  it("refuses an ambiguous basename rather than guessing", () => {
    // Picking one would let the gate pass while checking the wrong file.
    const ambiguous = [FILE, "src/transpiler/output/headers/Sample.ts"];
    expect(ThrowCitations.resolve("Sample.ts", ambiguous)).toBeNull();
  });
});

describe("ThrowCitations.check", () => {
  const cited = [
    { path: "Sample.ts", line: 2 },
    { path: "Sample.ts", line: 5 },
  ];

  it("passes when every throw is cited exactly once", () => {
    const outcome = ThrowCitations.check(cited, sources());
    expect(outcome.ok).toBe(true);
    expect(outcome.errors).toEqual([]);
    expect(outcome.info[0]).toContain("2 citation(s)");
  });

  it("fails a citation that has drifted, and names the nearest throw", () => {
    const outcome = ThrowCitations.check(
      [{ path: "Sample.ts", line: 3 }, cited[1]],
      sources(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors[0]).toContain("Sample.ts:3");
    expect(outcome.errors[0]).toContain("nearest is :2");
  });

  it("fails a throw that nobody classified", () => {
    // The invariant that catches growth, not just drift.
    const outcome = ThrowCitations.check([cited[0]], sources());
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.some((e) => e.includes(":5"))).toBe(true);
    expect(outcome.errors.some((e) => e.includes("not classified"))).toBe(true);
  });

  it("fails a line cited more than once", () => {
    const outcome = ThrowCitations.check([...cited, cited[0]], sources());
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.some((e) => e.includes("more than once"))).toBe(true);
  });

  it("fails every throw in a file the document does not mention at all", () => {
    // A brand-new file under output/ with no row anywhere in the document --
    // the shape this gate catches beyond drift.
    const outcome = ThrowCitations.check([], sources());
    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toHaveLength(2);
    expect(outcome.errors.every((e) => e.includes("not classified"))).toBe(
      true,
    );
  });

  it("fails a citation whose path matches no file", () => {
    const outcome = ThrowCitations.check(
      [{ path: "Missing.ts", line: 1 }, ...cited],
      sources(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors[0]).toContain("no single file matches");
  });

  it("reports a drifted citation with no throws at all in the file", () => {
    const outcome = ThrowCitations.check(
      [{ path: "Sample.ts", line: 1 }],
      sources("const x = 1;"),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors[0]).toContain("no `throw new` on that line");
    expect(outcome.errors[0]).not.toContain("nearest");
  });
});
