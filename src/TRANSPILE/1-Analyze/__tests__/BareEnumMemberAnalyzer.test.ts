import { describe, expect, it } from "vitest";

import BareEnumMemberAnalyzer from "../BareEnumMemberAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-017's bare-member rule (E0424): an enum member written bare is
 * accepted where its position names the enum -- a declaration or assignment
 * of the type, a return from a function of the type, a field or element of
 * the type -- and rejected everywhere else, with the enums that declare it.
 * Four codegen throws decided this by which generator happened to be running.
 *
 * The rule reads the per-file symbol view, so each source declares the enums
 * and structs it uses and the view comes from the program 1.4 built for it.
 */
const errors = (source: string) => {
  const { tree, context } = testAnalysisContextFor(source);
  return new BareEnumMemberAnalyzer(context).analyze(tree);
};

describe("BareEnumMemberAnalyzer (E0424)", () => {
  it("accepts a bare member where the position names its enum", () => {
    const source = [
      "enum Color { RED, GREEN }",
      "struct P {",
      "    Color c;",
      "}",
      "Color g <- RED;",
      "P p <- { c: GREEN };",
      "Color[2] pair <- [RED, GREEN];",
      "Color pick(bool f) {",
      "    Color c <- (f = true) ? RED : GREEN;",
      "    c <- GREEN;",
      "    p.c <- RED;",
      "    pair[0] <- GREEN;",
      "    return RED;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("rejects a bare member where nothing names the enum, with the suggestion", () => {
    const source = [
      "enum Color { RED, GREEN }",
      "u8 g <- RED;",
      "u8 f(Color c) {",
      "    if (c = RED) {",
      "    }",
      "    u8 v <- RED + 1;",
      "    return GREEN;",
      "}",
    ].join("\n");
    const found = errors(source);
    expect(found.map((e) => [e.code, e.line])).toEqual([
      ["E0424", 2],
      ["E0424", 4],
      ["E0424", 6],
      ["E0424", 7],
    ]);
    expect(found[0].message).toBe(
      "'RED' is not defined; did you mean 'Color.RED'?",
    );
    expect(found[0].column).toBeGreaterThan(0);
  });

  it("names every enum that declares an ambiguous member", () => {
    const [found] = errors(
      "enum Color { RED }\nenum Status { RED }\nu8 g <- RED;",
    );
    expect(found.message).toBe(
      "'RED' is not defined; did you mean 'Color.RED' or 'Status.RED'?",
    );
  });

  it("rejects a member of the OTHER enum under an enum-typed position (the closed hole)", () => {
    // `Color c <- YELLOW` resolved nothing and codegen emitted `YELLOW` into C.
    const found = errors(
      "enum Color { RED }\nenum Status { YELLOW }\nColor c <- YELLOW;",
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("'Status.YELLOW'");
  });

  it("clears the expectation inside a call's arguments, a subscript and a dimension", () => {
    const source = [
      "enum Color { RED, COUNT }",
      "void take(Color c) {",
      "}",
      "u8[COUNT] data;",
      "void main() {",
      "    take(RED);",
      "    u8 v <- data[COUNT];",
      "}",
    ].join("\n");
    expect(errors(source).map((e) => e.line)).toEqual([4, 6, 7]);
  });

  it("leaves a declared name of the same spelling alone", () => {
    // A local, a parameter or a const wins over the enum member, as codegen
    // resolved a declared name before ever asking the enums.
    const source = [
      "enum Color { RED }",
      "void f(u8 RED) {",
      "    u8 v <- RED;",
      "}",
      "void g() {",
      "    u8 RED <- 1;",
      "    u8 w <- RED;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("says nothing without a symbol view", () => {
    expect(errors("u8 g <- RED;")).toEqual([]);
  });
});
