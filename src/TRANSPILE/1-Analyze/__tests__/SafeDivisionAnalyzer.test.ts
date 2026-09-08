import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import SafeDivisionAnalyzer from "../SafeDivisionAnalyzer";

/**
 * #1322. ADR-051's call shape: E0884 (four arguments) and E0885 (the first is
 * a variable that can receive the result).
 *
 * The arity rule and the "not a variable at all" arm are pure parse-tree work
 * and are asserted here. The arm that separates a declared FUNCTION from a
 * declared VARIABLE reads the program's symbols, which a unit test does not
 * build, so `tests/adr-051/` asserts it end to end.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new SafeDivisionAnalyzer().analyze(tree);
};

const wrap = (body: string) =>
  `void main() {\n    u32 q <- 0;\n    bool err <- false;\n${body}\n}`;

describe("SafeDivisionAnalyzer (E0884)", () => {
  it.each([
    ["too few", "    err <- safe_div(q, 10, 2);", 3],
    ["too many", "    err <- safe_mod(q, 10, 2, 0, 1);", 5],
    ["none at all", "    err <- safe_div();", 0],
  ])("rejects %s arguments", (_label, body, count) => {
    const [found] = errors(wrap(body));
    expect(found.code).toBe("E0884");
    expect(found.message).toContain(`not ${count}`);
    expect(found.line).toBe(4);
  });

  it("accepts exactly four, for both builtins", () => {
    expect(
      errors(
        wrap(
          "    err <- safe_div(q, 10, 2, 0);\n    err <- safe_mod(q, 10, 3, 0);",
        ),
      ),
    ).toEqual([]);
  });
});

describe("SafeDivisionAnalyzer (E0885)", () => {
  it("rejects an expression as the output, which has no address", () => {
    const [found] = errors(wrap("    err <- safe_div(1 + 1, 10, 2, 0);"));
    expect(found.code).toBe("E0885");
    expect(found.message).toContain("must be a variable");
  });

  it("says nothing about a name it cannot resolve", () => {
    // An undeclared name is E0427's to report. Saying it twice for one mistake
    // is what the analyzer order exists to prevent, and guessing here would
    // fire on valid code wherever this resolver has a gap.
    expect(errors(wrap("    err <- safe_div(nope, 10, 2, 0);"))).toEqual([]);
  });

  it("is not confused by a member access ending in the same name", () => {
    // `lib.safe_div(...)` is a different function; only a bare primary
    // identifier followed by one call op is ADR-051's builtin.
    expect(errors(wrap("    err <- lib.safe_div(1 + 1, 10, 2);"))).toEqual([]);
  });
});
