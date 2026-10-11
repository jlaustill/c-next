import { describe, expect, it } from "vitest";
import CExpression from "../CExpression";

describe("CExpression.operand", () => {
  it.each([
    ["x", "x"],
    ["f(a, b)", "f(a, b)"],
    ["arr[i + 1]", "arr[i + 1]"],
    ['"a b"', '"a b"'],
    ["' '", "' '"],
    ["(uint8_t)x", "(uint8_t)x"],
    ["-x", "-x"],
  ])("keeps %s, already one operand", (expr, expected) => {
    expect(CExpression.operand(expr)).toBe(expected);
  });

  it.each([
    ["a | b", "(a | b)"],
    ["x << 1", "(x << 1)"],
    ["c ? a : b", "(c ? a : b)"],
    ['s == "a b"', '(s == "a b")'],
    ["f(a) + 1", "(f(a) + 1)"],
  ])("parenthesizes %s", (expr, expected) => {
    expect(CExpression.operand(expr)).toBe(expected);
  });
});
