import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import StructLiteralAnalyzer from "../StructLiteralAnalyzer";

/**
 * #1322. ADR-014's two struct-initializer rules: E0356 (a type written where
 * the position already declares one) and E0357 (no type written and no
 * position declaring one).
 *
 * Both are decided from the parse tree alone -- whether a type is written is
 * syntax, and whether a position supplies one is a question about the
 * initializer's own ancestors -- so unlike most of this card's analyzers these
 * are fully testable without a `Program`.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new StructLiteralAnalyzer().analyze(tree);
};

const struct = "struct Point { u32 x; u32 y; }\n";

describe("StructLiteralAnalyzer (E0356)", () => {
  it("rejects a written type in each position that already declares one", () => {
    const found = errors(
      struct +
        "struct Box { Point c; }\n" +
        "void takes(Point p) { }\n" +
        "void f() {\n" +
        "    Point a <- Point { x: 1, y: 1 };\n" +
        "    a <- Point { x: 2, y: 2 };\n" +
        "    Box b <- { c: Point { x: 3, y: 3 } };\n" +
        "    takes(Point { x: 4, y: 4 });\n" +
        "}",
    );
    expect(found.map((e) => [e.code, e.line])).toEqual([
      ["E0356", 5],
      ["E0356", 6],
      ["E0356", 7],
      ["E0356", 8],
    ]);
    expect(found[0].message).toBe(
      "Redundant type 'Point' in struct initializer",
    );
    expect(found[0].column).toBeGreaterThan(0);
  });

  it("accepts a written type where nothing else declares one", () => {
    // The bare statement is the one position that supplies nothing, so writing
    // the type there is required rather than redundant. This is the control
    // that stops E0356 from becoming "never write a type".
    expect(errors(struct + "void f() {\n    Point { x: 1, y: 1 };\n}")).toEqual(
      [],
    );
  });
});

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
