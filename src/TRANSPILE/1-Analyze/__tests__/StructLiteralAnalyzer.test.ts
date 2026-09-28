import { describe, expect, it } from "vitest";

import HeaderParser from "../../../PARSE/2-Parse/HeaderParser";
import CResolver from "../../../PARSE/3-Declare/c/index";
import SymbolTable from "../../../PARSE/3-Declare/SymbolTable";
import StructLiteralAnalyzer from "../StructLiteralAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-014's struct-initializer rule: E0357, no position declaring a
 * type for the literal.
 *
 * Its sibling E0356 (a type written where the position already declares one)
 * is retired with the grammar alternative it rejected -- `Point { x: 1 }` no
 * longer parses -- so the cases below are the parse-error fixture's business
 * now, not this analyzer's.
 *
 * E0357 is decided from the parse tree alone: whether a position supplies a
 * type is a question about the initializer's own ancestors. E0358 (#1802)
 * asks WHICH type, so the cases run on a real program.
 */
const errors = (source: string, symbolTable?: SymbolTable) => {
  const built = testAnalysisContextFor(
    source,
    symbolTable ? { symbolTable } : {},
  );
  return new StructLiteralAnalyzer(built.context).analyze(built.tree);
};

/** A C header's symbols, as Stage 2 declares them */
function header(source: string): SymbolTable {
  const table = new SymbolTable();
  const tree = HeaderParser.parseC(source).tree;
  table.addCSymbols(CResolver.resolve(tree!, "api.h", table).symbols);
  return table;
}

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

// #1802, owner ruling 2026-09-28: "a bitmap should be defined the exact same
// way it is anywhere else, being inside a struct changes nothing". A bitmap is
// its backing integer, set field by field after, so `{ A: 1 }` is no bitmap's
// value, and no scalar's either: each was emitted as a designated
// initializer that C rejects.
describe("StructLiteralAnalyzer (E0358)", () => {
  const types =
    "bitmap8 Flags { A, B, C[6] }\nstruct Cfg { u32 word; Flags f; }\nenum Mode { OFF, ON }\n";
  const codes = (source: string, symbolTable?: SymbolTable) =>
    errors(source, symbolTable).map((error) => `${error.code} ${error.line}`);

  it.each([
    ["a primitive", "u32 x <- { a: 1 };"],
    ["a string", "string<8> s <- { a: 1 };"],
    ["a bitmap", "Flags v <- { A: 1 };"],
    ["an enum", "Mode m <- { a: 1 };"],
    ["a bitmap field", "Cfg c <- { word: 1, f: { A: 1 } };"],
    ["an array's element", "u8[2] a <- [{ a: 1 }, 2];"],
  ])("rejects a struct initializer as %s", (_label, line) => {
    expect(codes(`${types}void f() {\n    ${line}\n}`)).toEqual(["E0358 5"]);
  });

  it("rejects it in a return, an assignment and an argument", () => {
    const source = [
      types.trim(),
      "void h(Flags p) { }",
      "Flags g() {",
      "    return { A: 1 };",
      "}",
      "void f() {",
      "    Flags v <- 0;",
      "    v <- { A: 1 };",
      "    h({ A: 1 });",
      "}",
    ].join("\n");
    expect(codes(source)).toEqual(["E0358 6", "E0358 10", "E0358 11"]);
  });

  it("stays silent for a struct, and for a bitmap given its integer", () => {
    const source = [
      types.trim(),
      "void f() {",
      "    Cfg c <- { word: 1, f: 3 };",
      "    Cfg[2] cs <- [{ word: 1, f: 0 }, { word: 2, f: 1 }];",
      "    Flags v <- 5;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("leaves an array's whole initializer to E0866", () => {
    expect(codes(`${types}void f() {\n    u8[2] a <- { a: 1 };\n}`)).toEqual(
      [],
    );
  });

  it("names a bitmap's own remedy: its integer, then its fields", () => {
    const [found] = errors(`${types}void f() {\n    Flags v <- { A: 1 };\n}`);
    expect(found.helpText).toContain("'Flags v <- 0; v.<field> <- true;'");
  });

  it("rejects a header's scalar and accepts a header's struct", () => {
    const table = header(
      "typedef int CInt;\ntypedef struct { int x; } CPoint;\n",
    );
    expect(
      codes(
        "void f() {\n    CInt i <- { a: 1 };\n    CPoint p <- { x: 1 };\n}",
        table,
      ),
    ).toEqual(["E0358 2"]);
  });
});
