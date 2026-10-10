import { describe, expect, it } from "vitest";
import ElementCount from "../ElementCount";
import testAnalysisContextFor from "../../TRANSPILE/1-Analyze/__tests__/testAnalysisContextFor";
import type TConstExpr from "../../types/TConstExpr";

const AT = { line: 1, column: 0 };
const lit = (digits: string): TConstExpr => ({
  kind: "literal",
  digits,
  typeName: null,
});
const name = (...path: string[]): TConstExpr => ({
  kind: "name",
  root: null,
  path,
  at: AT,
});
const bin = (
  op: Extract<TConstExpr, { kind: "binary" }>["op"],
  left: TConstExpr,
  right: TConstExpr,
): TConstExpr => ({ kind: "binary", op, left, right });

describe("ElementCount (#1283)", () => {
  const { context } = testAnalysisContextFor("const u8 SIX <- 6;", {
    cppMode: false,
    macros: {
      N: { kind: "integer", value: 3 },
      UNREAD: { kind: "integer", value: null },
      RATIO: { kind: "floating", typeName: "f32" },
    },
  });
  const count = (expr: TConstExpr) =>
    ElementCount.of(expr, context.program, context.sourceFile);

  it.each([
    ["a literal", lit("4"), 4],
    ["a C-Next const", name("SIX"), 6],
    ["a readable header macro", name("N"), 3],
    [
      "arithmetic over a macro and a const",
      bin("+", name("N"), name("SIX")),
      9,
    ],
  ])("counts %s", (_label, expr, expected) => {
    expect(count(expr)).toBe(expected);
  });

  it.each([
    ["an integer macro with no value", name("UNREAD")],
    ["a floating macro", name("RATIO")],
    ["arithmetic over an unread macro", bin("+", name("UNREAD"), lit("1"))],
    ["a negative count", bin("-", lit("1"), name("N"))],
    ["a qualified name", name("M", "N")],
  ])("cannot count %s", (_label, expr) => {
    expect(count(expr)).toBeNull();
  });
});
