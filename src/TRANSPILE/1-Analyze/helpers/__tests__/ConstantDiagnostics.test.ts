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

  it("leaves an undeclared bare name to E0427", () => {
    expect(
      ConstantDiagnostics.why({
        kind: "notConstant",
        reason: "unknown",
        spelling: "x",
        at: AT,
      }),
    ).toBeNull();
  });

  // #1863 review: neither E0427 nor E0800 reports these, so E0909 does
  it.each([
    [
      "a divisor that is zero only once computed",
      { reason: "divisionByZero" as const, spelling: "" },
      "it divides by zero",
    ],
    [
      "a member a scope or an enum does not have",
      { reason: "undeclaredMember" as const, spelling: "S.NOPE" },
      "'S.NOPE' is not declared",
    ],
  ])("says %s", (_label, part, expected) => {
    expect(
      ConstantDiagnostics.why({ kind: "notConstant", at: AT, ...part }),
    ).toBe(expected);
  });

  it("says a const's own cause at a use of it", () => {
    expect(
      ConstantDiagnostics.why({
        kind: "notConstant",
        reason: "unfolded",
        spelling: "B",
        at: AT,
        because: { kind: "overflow", typeName: "u8" },
      }),
    ).toBe(
      "'B' has no value known at compile time: its initializer overflows u8 (ADR-044)",
    );
  });
});
