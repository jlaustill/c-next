import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import BitAccessAnalyzer from "../BitAccessAnalyzer";

/**
 * #1322. ADR-007's bit access: E0856 (deeper than the base's shape allows) and
 * E0888 (a float bit range read at file scope).
 *
 * Both read the lexical frames only, so they are testable without a `Program`.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new BitAccessAnalyzer().analyze(tree);
};

describe("BitAccessAnalyzer (E0856)", () => {
  it("rejects a second subscript on a scalar, as a read AND as a write", () => {
    // A target is an `assignmentTarget`, not a postfix expression -- a
    // different node type. Reading only expressions caught neither fixture.
    const found = errors(
      [
        "u8 flags <- 0;",
        "void f() {",
        "    flags[4][3] <- 5;",
        "    u8 v <- flags[4][3];",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.line])).toEqual([
      ["E0856", 3],
      ["E0856", 4],
    ]);
    expect(found[0].message).toContain("a scalar 'u8'");
  });

  it("allows one subscript per dimension plus one bit index", () => {
    expect(
      errors(
        [
          "void f() {",
          "    u8 flags <- 0;",
          "    u8[4] arr;",
          "    u8[2][3] grid;",
          "    bool a <- flags[4];",
          "    bool b <- arr[1][4];",
          "    bool c <- grid[1][2][4];",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("says nothing about a base whose type is not bit-indexable", () => {
    // A string is a char array with its own rules and a bitmap is E0883's.
    expect(
      errors('void f() {\n    string<8> s <- "hi";\n    u8 c <- s[0][1];\n}'),
    ).toEqual([]);
  });
});

describe("BitAccessAnalyzer (E0888)", () => {
  it("rejects a float bit RANGE at file scope", () => {
    const [found] = errors("f32 value <- 1.5;\nu32 bits <- value[0, 8];");
    expect(found.code).toBe("E0888");
    expect(found.message).toContain("value[0, 8]");
  });

  it("accepts the same range inside a function, and a single bit anywhere", () => {
    // A single bit index needs no union, so it is not restricted by scope.
    expect(
      errors(
        [
          "f32 value <- 1.5;",
          "bool topBit <- value[31];",
          "void f() {",
          "    f32 local <- 1.5;",
          "    u32 bits <- local[0, 8];",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});
