/**
 * Issue #1219: context axis.
 *
 * This classifier decides which row of the matrix a fixture occupies. If it
 * cannot tell the four contexts apart, every occupancy number downstream is
 * decoration -- so the first four cases place an IDENTICAL construct in each of
 * the four contexts and require four different answers.
 */

import CNextSourceParser from "../../src/transpiler/logic/parser/CNextSourceParser";
import FixtureContext from "../matrix/FixtureContext";

const contextOf = (source: string, line: number) =>
  FixtureContext.at(CNextSourceParser.parse(source).tree, line);

describe("FixtureContext.at", () => {
  // The same division by zero, moved between contexts. Nothing else varies.
  it.each([
    ["global-variable", "const u32 ZERO <- 0;\nu32 bad <- 10 / ZERO;\n", 2],
    [
      "top-level-function",
      "const u32 ZERO <- 0;\nvoid topLevel() {\n    u32 bad <- 10 / ZERO;\n}\n",
      3,
    ],
    [
      "scope-member",
      "const u32 ZERO <- 0;\nscope S {\n    u32 bad <- 10 / ZERO;\n}\n",
      3,
    ],
    [
      "scope-method",
      "const u32 ZERO <- 0;\nscope S {\n    void go() {\n        u32 bad <- 10 / ZERO;\n    }\n}\n",
      4,
    ],
  ])("classifies an identical construct in %s", (expected, source, line) => {
    expect(contextOf(source, line)).toBe(expected);
  });

  it("distinguishes a scope method from a top-level function in the same file", () => {
    // A file-structure check would credit BOTH contexts here regardless of
    // where the construct is. Line 2 is the top-level function; line 5 is the
    // scope method.
    const source =
      "void topLevel() {\n    u32 a <- 1;\n}\nscope S {\n    void go() {\n        u32 b <- 2;\n    }\n}\n";
    expect(contextOf(source, 2)).toBe("top-level-function");
    expect(contextOf(source, 6)).toBe("scope-method");
  });

  it("distinguishes a scope member from a global variable in the same file", () => {
    const source = "u32 outer <- 1;\nscope S {\n    u32 inner <- 2;\n}\n";
    expect(contextOf(source, 1)).toBe("global-variable");
    expect(contextOf(source, 3)).toBe("scope-member");
  });

  it.each([
    ["a blank line between declarations", "u32 a <- 1;\n\nu32 b <- 2;\n", 2],
    ["a bare comment line", "// just a comment\nu32 a <- 1;\n", 1],
    ["a preprocessor directive", "#include <stdint.h>\nu32 a <- 1;\n", 1],
  ])(
    "returns null for %s, rather than defaulting to a context",
    (_label, source, line) => {
      // Null is a distinct answer: the line encloses no declaration. Defaulting
      // to global-variable here is how a synthetic 1:0 diagnostic (#1235) would
      // manufacture occupancy for a cell nothing exercises.
      expect(contextOf(source, line)).toBeNull();
    },
  );

  it("returns null for a line past the end of the file", () => {
    expect(contextOf("u32 a <- 1;\n", 99)).toBeNull();
  });

  it("classifies a nested scope method as scope-method", () => {
    const source =
      "scope Outer {\n    void go() {\n        if (1 = 1) {\n            u32 deep <- 1;\n        }\n    }\n}\n";
    expect(contextOf(source, 4)).toBe("scope-method");
  });
});
