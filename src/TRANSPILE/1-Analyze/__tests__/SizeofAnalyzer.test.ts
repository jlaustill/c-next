import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import SizeofAnalyzer from "../SizeofAnalyzer";

/**
 * #1322. ADR-023's operand rules: E0601 (an array parameter measures a
 * pointer) and E0602 (MISRA C:2012 Rule 13.6, no side effects).
 *
 * Both are decided from the parse tree alone -- which parameter list encloses
 * the `sizeof`, and whether the operand contains a call -- so unlike most of
 * this card's analyzers these are fully testable without a `Program`.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new SizeofAnalyzer().analyze(tree);
};

describe("SizeofAnalyzer (E0601)", () => {
  it("rejects an array parameter", () => {
    // Only the prefix form is tested, because only it can reach this rule:
    // E0874 rejects `u8 other[8]` for every parameter and runs first. A case
    // for the trailing spelling would pass here -- a unit test bypasses the
    // ordering -- while being unreachable in any program.
    const found = errors(
      "void prefix(u8[8] data) {\n    u32 n <- sizeof(data);\n}",
    );
    expect(found.map((e) => [e.code, e.line])).toEqual([["E0601", 2]]);
    expect(found[0].message).toContain("measures a pointer");
  });

  it("accepts a LOCAL array of the same shape -- the rule is about where it is declared", () => {
    expect(
      errors("void f() {\n    u8[8] data;\n    u32 n <- sizeof(data);\n}"),
    ).toEqual([]);
  });

  it("accepts a scalar parameter and a type", () => {
    expect(
      errors(
        "void f(u8 count) {\n    u32 a <- sizeof(count);\n    u32 b <- sizeof(u32);\n}",
      ),
    ).toEqual([]);
  });
});

describe("SizeofAnalyzer (E0602)", () => {
  it("rejects a call, alone and nested in arithmetic", () => {
    const found = errors(
      [
        "u32 next() { return 1; }",
        "void f() {",
        "    u32 a <- sizeof(next());",
        "    u32 b <- sizeof(1 + next());",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.line])).toEqual([
      ["E0602", 3],
      ["E0602", 4],
    ]);
  });

  it("accepts operands that evaluate to nothing", () => {
    // Arithmetic and a subscript are what the rule must NOT reject. Codegen
    // also tested the operand's text for eleven assignment operators; none can
    // appear in an expression, because assignment is a statement.
    expect(
      errors(
        "void f() {\n    u32 v <- 1;\n    u8[4] arr;\n    u32 a <- sizeof(v + 1);\n    u32 b <- sizeof(arr[0]);\n}",
      ),
    ).toEqual([]);
  });
});
