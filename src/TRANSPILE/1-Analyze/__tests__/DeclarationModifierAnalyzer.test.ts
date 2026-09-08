import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import DeclarationModifierAnalyzer from "../DeclarationModifierAnalyzer";

/**
 * #1322. ADR-049's E0889: `atomic` already implies `volatile`, so writing both
 * says one of two different things.
 *
 * Entirely syntactic -- two modifier tokens on one declaration -- so nothing
 * here needs a type, a scope or the program's symbols.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new DeclarationModifierAnalyzer().analyze(tree);
};

describe("DeclarationModifierAnalyzer (E0889)", () => {
  it("rejects both modifiers at file scope, in a function, and in a scope", () => {
    const found = errors(
      [
        "atomic volatile u32 atFile <- 0;",
        "void f() {",
        "    atomic volatile u32 inBody <- 0;",
        "}",
        "scope S {",
        "    atomic volatile u32 member <- 0;",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.line])).toEqual([
      ["E0889", 1],
      ["E0889", 3],
      ["E0889", 6],
    ]);
  });

  it("accepts either modifier alone", () => {
    expect(
      errors("atomic u32 a <- 0;\nvolatile u32 b <- 0;\nu32 c <- 0;"),
    ).toEqual([]);
  });

  it("checks a for header's declaration too", () => {
    // The grammar lets a `for` init carry the same modifiers. Codegen's copy
    // lived in the builder that file-scope and block declarations share, so
    // this form was never asked.
    const found = errors(
      "void f() {\n    for (atomic volatile u32 i <- 0; i < 2; i +<- 1) {\n    }\n}",
    );
    expect(found.map((e) => e.code)).toEqual(["E0889"]);
  });
});
