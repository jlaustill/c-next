/**
 * Issue #1219: context axis.
 *
 * This classifier decides which row of the matrix a fixture occupies. If it
 * cannot tell the contexts apart, every occupancy number downstream is
 * decoration -- so the first four cases place an IDENTICAL construct in each of
 * the four declaration contexts and require four different answers. The fifth,
 * a `for` header, is decided by position, not line (see its own cases).
 */

import CnxSourceParser from "../../src/cnx/PARSE/2-Parse/CnxSourceParser";
import FixtureContext from "../matrix/FixtureContext";

const contextOf = (source: string, line: number, column?: number) =>
  FixtureContext.at(CnxSourceParser.parse(source).tree, line, column);

describe("FixtureContext.at", () => {
  // The same division by zero, moved between contexts. Nothing else varies.
  it.each([
    ["global-variable", "u32 ZERO <- 0;\nu32 bad <- 10 / ZERO;\n", 2],
    [
      "top-level-function",
      "u32 ZERO <- 0;\nvoid topLevel() {\n    u32 bad <- 10 / ZERO;\n}\n",
      3,
    ],
    [
      "scope-member",
      "u32 ZERO <- 0;\nscope S {\n    u32 bad <- 10 / ZERO;\n}\n",
      3,
    ],
    [
      "scope-method",
      "u32 ZERO <- 0;\nscope S {\n    void go() {\n        u32 bad <- 10 / ZERO;\n    }\n}\n",
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

  // A column into `source`'s 1-based `line`, as a diagnostic reports it.
  const columnOf = (source: string, line: number, text: string): number =>
    source.split("\n")[line - 1].indexOf(text);

  it("puts a for header's declaration in its own row, in a function or a scope method", () => {
    const source =
      "void topLevel() {\n    for (u32 i <- 0; i < 1; i <- i + 1) {\n        u32 a <- 1;\n    }\n}\nscope S {\n    void go() {\n        for (u32 j <- 0; j < 1; j <- j + 1) {\n            u32 b <- 2;\n        }\n    }\n}\n";
    expect(contextOf(source, 2, columnOf(source, 2, "u32 i"))).toBe(
      "for-header",
    );
    expect(contextOf(source, 3, columnOf(source, 3, "u32 a"))).toBe(
      "top-level-function",
    );
    expect(contextOf(source, 8, columnOf(source, 8, "u32 j"))).toBe(
      "for-header",
    );
    expect(contextOf(source, 9, columnOf(source, 9, "u32 b"))).toBe(
      "scope-method",
    );
  });

  it("leaves a for header's condition, update and one-line body in the enclosing function's row", () => {
    const source =
      "void topLevel() {\n    mut u32 n <- 0;\n" +
      "    for (u32 i <- 0; n; n <- n + 1) {}\n" +
      "    for (u32 j <- 0; j < 1; j <- j + 1) { u32 bad <- 10 / 0; }\n}\n";
    expect(contextOf(source, 3, columnOf(source, 3, "n;"))).toBe(
      "top-level-function",
    );
    expect(contextOf(source, 3, columnOf(source, 3, "n <- n + 1"))).toBe(
      "top-level-function",
    );
    expect(contextOf(source, 4, columnOf(source, 4, "u32 bad"))).toBe(
      "top-level-function",
    );
    // The declaration's last token is still inside it.
    expect(contextOf(source, 4, columnOf(source, 4, "0; j < 1"))).toBe(
      "for-header",
    );
  });

  it("leaves a position with no column, a provenance site, in the enclosing function's row", () => {
    const source =
      "void topLevel() {\n    for (u32 i <- 0; i < 1; i <- i + 1) {}\n}\n";
    expect(contextOf(source, 2)).toBe("top-level-function");
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
