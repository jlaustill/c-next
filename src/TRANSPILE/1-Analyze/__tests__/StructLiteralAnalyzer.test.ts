import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import StructLiteralAnalyzer from "../StructLiteralAnalyzer";

/**
 * #1322. ADR-014's struct-initializer rule: E0357, no position declaring a
 * type for the literal.
 *
 * Its sibling E0356 (a type written where the position already declares one)
 * is retired with the grammar alternative it rejected -- `Point { x: 1 }` no
 * longer parses -- so the cases below are the parse-error fixture's business
 * now, not this analyzer's.
 *
 * The rule is decided from the parse tree alone -- whether a position supplies
 * a type is a question about the initializer's own ancestors -- so unlike most
 * of this card's analyzers it is fully testable without a `Program`.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new StructLiteralAnalyzer().analyze(tree);
};

const struct = "struct Point { u32 x; u32 y; }\n";

describe("StructLiteralAnalyzer (E0357)", () => {
  it("rejects an inferred initializer that no position types", () => {
    const [found] = errors(struct + "void f() {\n    { x: 1, y: 1 };\n}");
    expect(found.code).toBe("E0357");
    expect(found.line).toBe(3);
  });

  it("accepts every position that supplies a type, including a return", () => {
    // The last three were rejected by the codegen throw this replaces (#1277):
    // a return, a return inside a scope method, and a `for` header.
    const source = [
      struct.trim(),
      "struct Box { Point c; }",
      "void takes(Point p) { }",
      "Point atFileScope <- { x: 1, y: 1 };",
      "Point returned() { return { x: 2, y: 2 }; }",
      "scope S { public Point make() { return { x: 3, y: 3 }; } }",
      "void f() {",
      "    Point a <- { x: 4, y: 4 };",
      "    a <- { x: 5, y: 5 };",
      "    Box b <- { c: { x: 6, y: 6 } };",
      "    takes({ x: 7, y: 7 });",
      "    for (Point p <- { x: 8, y: 8 }; p.x < 9; p.x +<- 1) { }",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("stays silent when a position supplies a type this pass cannot name", () => {
    // A field of a struct declared in an included C header: the position
    // supplies a type, and asking for its NAME would answer null and fire a
    // false E0357. Nine `tests/interop/anonymous-structs` fixtures are this
    // shape, and they are what caught it.
    expect(
      errors("void f() {\n    Foreign c <- { flags: { a: 1 } };\n}"),
    ).toEqual([]);
  });
});
