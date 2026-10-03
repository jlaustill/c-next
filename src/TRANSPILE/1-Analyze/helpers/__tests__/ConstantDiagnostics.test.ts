import { describe, expect, it } from "vitest";
import ConstantDiagnostics from "../ConstantDiagnostics";

const AT = { line: 1, column: 0 };

describe("ConstantDiagnostics (#1175, #1669)", () => {
  it.each<[string, Parameters<typeof ConstantDiagnostics.why>[0], string]>([
    [
      "a variable",
      { kind: "notConstant", reason: "variable", spelling: "limit", at: AT },
      "'limit' is a variable",
    ],
    [
      "a later member",
      { kind: "notConstant", reason: "laterMember", spelling: "E.B", at: AT },
      "'E.B' is declared below it",
    ],
    [
      "a reason with nothing to spell",
      { kind: "notConstant", reason: "negativeShift", spelling: "", at: null },
      "it shifts by a negative amount, or shifts a negative value right",
    ],
    [
      "a header's name",
      { kind: "foreign", spelling: "MODE_FAST", why: "header" },
      "'MODE_FAST' is defined by a C or C++ header",
    ],
    [
      "a name nothing binds, beside a header",
      { kind: "foreign", spelling: "MODE_FAST", why: "maybeHeader" },
      "'MODE_FAST' is not declared in C-Next, so only an included C or C++ header can define it",
    ],
    [
      "a size the target decides",
      { kind: "foreign", spelling: "sizeof(Point)", why: "targetSize" },
      "'sizeof(Point)' is decided by the target",
    ],
  ])("says why %s has no value", (_label, result, expected) => {
    expect(ConstantDiagnostics.why(result)).toBe(expected);
  });

  it.each([
    ["a division by zero, which is E0800's", "divisionByZero" as const],
    ["an undeclared name, which is E0427's", "unknown" as const],
  ])("leaves %s to its own code", (_label, reason) => {
    expect(
      ConstantDiagnostics.why({
        kind: "notConstant",
        reason,
        spelling: "x",
        at: AT,
      }),
    ).toBeNull();
  });
});
