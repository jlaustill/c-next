import { describe, expect, it } from "vitest";

import CnxSourceParser from "../CnxSourceParser";

/**
 * ADR-071: every binding is read-only unless declared `mut`, so a written
 * `const` says nothing and is E0898, which 1.2 reports.
 */
const errors = (source: string) =>
  CnxSourceParser.parse(source)
    .formErrors.filter((e) => e.message.includes("E0898"))
    .map((e) => ({ line: e.line, column: e.column, message: e.message }));

describe("MutabilityForm (ADR-071: E0898)", () => {
  it("rejects `const` on a global, at the keyword", () => {
    expect(errors("const u32 LIMIT <- 5;")).toEqual([
      {
        line: 1,
        column: 0,
        message: "error[E0898]: `const` is the default; remove it",
      },
    ]);
  });

  it("rejects it on a parameter, a local and a scope member", () => {
    const source = [
      "void f(const u32 v) {",
      "    const u32 a <- v;",
      "}",
      "scope S {",
      "    const u8 k <- 1;",
      "}",
    ].join("\n");
    expect(errors(source).map((e) => [e.line, e.column])).toEqual([
      [1, 7],
      [2, 4],
      [5, 4],
    ]);
  });

  it("accepts the read-only default and `mut`", () => {
    expect(
      errors(
        "u32 LIMIT <- 5;\nvoid bump(mut u32 v) {\n    mut u32 count <- 0;\n    count <- v;\n    v <- count;\n}",
      ),
    ).toEqual([]);
  });
});
