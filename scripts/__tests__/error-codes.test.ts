import { describe, expect, it } from "vitest";

import ErrorCodeRegistry from "../diagnostics/ErrorCodeRegistry";

/**
 * #1322. `docs/error-codes.md` says of itself that it "is hand-maintained and
 * has no gate, while `npm run diagnostics:manifest:check` only sees codes that
 * already have a fixture" -- so a code reserved in one place and recorded
 * nowhere gets assigned twice, silently.
 *
 * This card allocates roughly 45-60 new codes across eight ranges, into a file
 * that currently holds 55. Every invariant below is TRUE on `main` today, which
 * is the point: the gate is added while it is green, before the allocation that
 * would otherwise break it unnoticed.
 */
const doc = (...lines: string[]): string =>
  ["| Range | Category | Count |", "| --- | --- | --- |", ...lines].join("\n");

describe("ErrorCodeRegistry.check", () => {
  const good = doc(
    "| E04xx | Symbol Resolution | 2 |",
    "| E0424 | Unqualified enum member | Qualify it | `output/codegen/CodeGenerator.ts` |",
    "| E0429 | Register in a type position | Name the type | `output/codegen/TypeValidator.ts` |",
  );

  it("passes when every emitted code has a row and every row is emitted", () => {
    expect(ErrorCodeRegistry.check(good, new Set(["E0424", "E0429"]))).toEqual(
      [],
    );
  });

  it("fails a code emitted in src/ with no row -- the silent double-assignment", () => {
    const errors = ErrorCodeRegistry.check(
      good,
      new Set(["E0424", "E0429", "E0431"]),
    );
    expect(errors.join("\n")).toContain("E0431");
    expect(errors.join("\n")).toContain("not registered");
  });

  it("fails a row whose code nothing emits", () => {
    // A row for a code no source raises is either a removal nobody finished or
    // a typo, and both make "next available" wrong for the next author.
    const errors = ErrorCodeRegistry.check(good, new Set(["E0424"]));
    expect(errors.join("\n")).toContain("E0429");
    expect(errors.join("\n")).toContain("no source emits");
  });

  it("accepts a row marked _(reserved)_ that no source emits", () => {
    const reserved = doc(
      "| E04xx | Symbol Resolution | 2 |",
      "| E0424 | Unqualified enum member | Qualify it | `output/codegen/CodeGenerator.ts` |",
      "| E0428 | _(reserved)_ — cannot assign integer to enum | Not yet | `output/codegen/X.ts` |",
    );
    expect(ErrorCodeRegistry.check(reserved, new Set(["E0424"]))).toEqual([]);
  });

  it("accepts a row whose source cell says Planned and which no source emits", () => {
    const planned = doc(
      "| E08xx | Arithmetic | 1 |",
      "| E0854 | Constant index out of bounds | Fix the index | Planned |",
    );
    expect(ErrorCodeRegistry.check(planned, new Set())).toEqual([]);
  });

  it("fails a code that has two rows", () => {
    const twice = doc(
      "| E04xx | Symbol Resolution | 2 |",
      "| E0424 | One meaning | fix | `output/codegen/A.ts` |",
      "| E0424 | Another meaning | fix | `output/codegen/B.ts` |",
    );
    expect(
      ErrorCodeRegistry.check(twice, new Set(["E0424"])).join("\n"),
    ).toContain("listed twice");
  });

  it("fails rows that are out of ascending order", () => {
    // "Next available is read from this table", so an unsorted table is one a
    // contributor appends to instead of reading -- the exact way `.cspell.json`
    // grew a second sorted island (#1309).
    const unsorted = doc(
      "| E04xx | Symbol Resolution | 2 |",
      "| E0429 | Register in a type position | Name it | `output/codegen/TypeValidator.ts` |",
      "| E0424 | Unqualified enum member | Qualify it | `output/codegen/CodeGenerator.ts` |",
    );
    expect(
      ErrorCodeRegistry.check(unsorted, new Set(["E0424", "E0429"])).join("\n"),
    ).toContain("out of order");
  });

  it("fails a range whose declared count no longer matches its rows", () => {
    const miscounted = doc(
      "| E04xx | Symbol Resolution | 5 |",
      "| E0424 | Unqualified enum member | Qualify it | `output/codegen/CodeGenerator.ts` |",
    );
    expect(
      ErrorCodeRegistry.check(miscounted, new Set(["E0424"])).join("\n"),
    ).toContain("declares 5");
  });

  it("reads the source cell of a row whose text contains its own pipes", () => {
    // E0807's description contains `|` characters, so it splits into six cells
    // rather than four. Keying on the FIRST and LAST cell is what stops a row
    // like that from being skipped -- and a row this gate silently skips is a
    // row it does not defend.
    const piped = doc(
      "| E08xx | Arithmetic | 1 |",
      "| E0807 | bitwise `a | b` on a bool | Use `||` | `logic/analysis/BooleanOperandAnalyzer.ts` |",
    );
    expect(ErrorCodeRegistry.check(piped, new Set(["E0807"]))).toEqual([]);
  });
});
