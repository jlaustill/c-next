import { describe, expect, it } from "vitest";
import ConstantDimensionAnalyzer from "../ConstantDimensionAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

function errors(
  source: string,
  helpers?: Record<string, string>,
): { code: string; line: number; column: number; message: string }[] {
  const { tree, context } = testAnalysisContextFor(source, { helpers });
  return new ConstantDimensionAnalyzer(context).analyze(tree);
}

describe("ConstantDimensionAnalyzer (#1175: E0909, E0910)", () => {
  // Every position the grammar has a dimension at, so a rule checked at one
  // and silent at another is caught -- the hole this card closes
  it.each([
    ["a global", "u8 n <- 3;\nu8[n] g;", "'n' is a variable"],
    [
      "a local",
      "void f(u32 n) {\n    u8[n] a;\n    a[0] <- 1;\n}",
      "'n' is a parameter",
    ],
    ["a parameter", "void f(u32 n, u8[n] p) {\n}", "'n' is a parameter"],
    [
      "a struct field",
      "u8 n <- 3;\nstruct S {\n    u8[n] data;\n}",
      "'n' is a variable",
    ],
    [
      "a scope member",
      "u8 n <- 3;\nscope M {\n    u8[n] slots;\n}",
      "'n' is a variable",
    ],
    // #1863 review: reported by nothing else, these reached render's invariant
    [
      "a divisor that is zero only once computed",
      "u8[4 / (2 - 2)] g;",
      "it divides by zero",
    ],
    [
      "a member the scope does not have",
      "scope S {\n    public const u8 MAX <- 4;\n}\nu8[S.NOPE] g;",
      "'S.NOPE' is not declared",
    ],
  ])("rejects a dimension with no value: %s", (_label, source, why) => {
    const [found] = errors(source);
    expect(found?.code).toBe("E0909");
    expect(found?.message).toContain(why);
  });

  it("rejects one whose arithmetic overflows its operands' type (ADR-044)", () => {
    const [found] = errors("const u8 A <- 200;\nu8[A + A] buf;");
    expect(found).toMatchObject({ code: "E0910", line: 2, column: 3 });
    expect(found.message).toContain("overflows u8");
  });

  it.each([
    ["a literal", "u8[4] a;"],
    ["a const, and arithmetic over it", "const u8 N <- 4;\nu8[N * 2 + 1] a;"],
    ["a wider cast", "const u8 A <- 200;\nu8[(u16)A + (u16)A] a;"],
    ["sizeof of a primitive", "u8[sizeof(u32)] a;"],
    ["an enum member", "enum E { A, B, COUNT }\nu8[E.COUNT] a;"],
    ["a property", "u8[3] src;\nu8[src.element_count] a;"],
    // not this analyzer's: E0427 reports an undeclared bare name
    ["an undeclared name", "u8[NOT_DECLARED] a;"],
  ])("accepts %s", (_label, source) => {
    expect(errors(source)).toEqual([]);
  });

  it("folds a const declared in an included file", () => {
    expect(
      errors(`#include "lib.cnx"\nu8[(LIB_N + 1)] a;`, {
        "lib.cnx": "const u32 LIB_N <- 4;\n",
      }),
    ).toEqual([]);
  });
});
