import { describe, expect, it } from "vitest";
import ConstExprPrinter from "../ConstExprPrinter";
import type TConstExpr from "../../types/TConstExpr";
import type IConstantEnvironment from "../types/IConstantEnvironment";

const AT = { line: 1, column: 0 };
const lit = (digits: string): TConstExpr => ({
  kind: "literal",
  digits,
  typeName: null,
});
const name = (n: string): TConstExpr => ({
  kind: "name",
  root: null,
  path: [n],
  at: AT,
});
const bin = (
  op: Extract<TConstExpr, { kind: "binary" }>["op"],
  left: TConstExpr,
  right: TConstExpr,
): TConstExpr => ({ kind: "binary", op, left, right });

/** BUF_SIZE is a header macro; LOCAL a C-Next const C cannot see */
const ENV: IConstantEnvironment = {
  valueOf: (n) =>
    n.path[0] === "LOCAL"
      ? { kind: "value", value: 8n, typeName: "u8" }
      : { kind: "foreign", spelling: n.path[0], why: "header" },
};

describe("ConstExprPrinter (#1175)", () => {
  it.each<[string, TConstExpr, string]>([
    ["a value is its number", bin("+", lit("1"), lit("2")), "3"],
    [
      "a macro stays for C",
      bin("+", name("BUF_SIZE"), lit("1")),
      "BUF_SIZE + 1",
    ],
    [
      "a C-Next const is written as its value, never its name",
      bin("*", name("BUF_SIZE"), name("LOCAL")),
      "BUF_SIZE * 8",
    ],
    [
      "a negative value is parenthesized, so no tokens can join",
      bin("-", name("BUF_SIZE"), { kind: "unary", op: "-", operand: lit("1") }),
      "BUF_SIZE - (-1)",
    ],
    [
      "a nested operation is parenthesized",
      bin("*", bin("+", name("BUF_SIZE"), lit("1")), lit("2")),
      "(BUF_SIZE + 1) * 2",
    ],
    [
      "C-Next's `=` is C's `==`",
      {
        kind: "ternary",
        condition: bin("=", name("BUF_SIZE"), lit("4")),
        whenTrue: lit("1"),
        whenFalse: lit("2"),
      },
      "(BUF_SIZE == 4) ? 1 : 2",
    ],
    [
      "a cast is to the C type",
      { kind: "cast", typeName: "u32", operand: name("BUF_SIZE") },
      "(uint32_t)BUF_SIZE",
    ],
    [
      "sizeof a scope's type is its C name",
      { kind: "sizeof", typeName: "Motor.Config" },
      "sizeof(Motor__Config)",
    ],
  ])("%s", (_label, expr, expected) => {
    expect(ConstExprPrinter.toC(expr, ENV)).toBe(expected);
  });

  it("refuses an expression C cannot evaluate either: 2.1 rejects it first", () => {
    const call: TConstExpr = {
      kind: "other",
      what: "call",
      spelling: "f()",
      at: AT,
    };
    expect(() => ConstExprPrinter.toC(call, ENV)).toThrow(
      "only an expression C can evaluate is printed",
    );
  });
});
