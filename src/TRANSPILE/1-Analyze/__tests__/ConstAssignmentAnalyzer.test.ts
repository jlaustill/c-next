import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import ConstAssignmentAnalyzer from "../ConstAssignmentAnalyzer";

/**
 * #1322. ADR-013's const enforcement: E0877 (an assignment to or through a
 * const binding, any form) and E0878 (a const value passed to a non-const
 * parameter), replacing four codegen throws that reported `1:0`.
 *
 * Const-ness comes from the lexical frames; a callee's parameters and a const
 * from an include come from the program's symbols, which a unit test does not
 * build, so `tests/adr-013/const-uncovered-arms-error` and the imported
 * fixtures assert those arms end to end.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new ConstAssignmentAnalyzer().analyze(tree);
};

describe("ConstAssignmentAnalyzer (E0877)", () => {
  it("rejects every assignment operator on a const variable, at the target", () => {
    const found = errors(
      "const u32 K <- 1;\nvoid f() {\n    K <- 2;\n    K +<- 1;\n    K <<<- 1;\n}",
    );
    expect(found.map((e) => [e.code, e.line])).toEqual([
      ["E0877", 3],
      ["E0877", 4],
      ["E0877", 5],
    ]);
    expect(found[0].message).toBe("cannot assign to const variable 'K'");
    expect(found[0].column).toBeGreaterThan(0);
  });

  it("names a parameter as a parameter", () => {
    const [found] = errors("void f(const i32 value) {\n    value <- 1;\n}");
    expect(found.message).toBe("cannot assign to const parameter 'value'");
  });

  it("carries the element and member suffixes codegen used", () => {
    const found = errors(
      "struct C { u8 x; }\nvoid f(const u8[4] t, const C c) {\n    t[0] <- 1;\n    c.x <- 2;\n}",
    );
    expect(found.map((e) => e.message)).toEqual([
      "cannot assign to const parameter 't' (array element)",
      "cannot assign to const parameter 'c' (member access)",
    ]);
  });

  it("checks a for header's initializer and update (the closed holes)", () => {
    const found = errors(
      "const u8 K <- 1;\nvoid f() {\n    for (K <- 0; K < 3; K +<- 1) {\n    }\n}",
    );
    expect(found).toHaveLength(2);
    expect(found.every((e) => e.line === 3)).toBe(true);
  });

  it("resolves this. and global. against the right frame", () => {
    const source = [
      "const u8 K <- 1;",
      "scope S {",
      "    const u8 STEP <- 2;",
      "    u8 K <- 0;",
      "    public void go() {",
      "        this.STEP <- 3;",
      "        global.K <- 4;",
      "        K <- 5;",
      "    }",
      "}",
    ].join("\n");
    // `K` bare inside S is the mutable scope member; `global.K` is the const.
    expect(errors(source).map((e) => [e.line, e.message])).toEqual([
      [6, "cannot assign to const variable 'STEP'"],
      [7, "cannot assign to const variable 'K'"],
    ]);
  });

  it("accepts a mutable binding in every form, and a shadowing local", () => {
    const source = [
      "const u8 K <- 1;",
      "struct C { u8 x; }",
      "void f(u8 p, u8[4] arr, C c) {",
      "    u8 K <- 2;",
      "    K <- 3;",
      "    p <- 1;",
      "    arr[0] <- 1;",
      "    c.x <- 1;",
      "    for (p <- 0; p < 3; p +<- 1) {",
      "    }",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });
});
