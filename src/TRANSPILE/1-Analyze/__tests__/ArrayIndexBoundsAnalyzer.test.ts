import { afterEach, describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import ArrayIndexBoundsAnalyzer from "../ArrayIndexBoundsAnalyzer";

/**
 * #1322. ADR-036's constant index bounds (E0854), replacing
 * `TypeValidator.checkArrayBounds` and its three call sites, which resolved
 * the array's name three different ways and never consulted a struct
 * field's dimensions.
 *
 * Dimensions come from the lexical frames; a struct field's come from the
 * per-file symbol view, set directly here and reset after each test.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new ArrayIndexBoundsAnalyzer().analyze(tree);
};

const structs = (
  fields: Record<string, Record<string, [string, number[]]>>,
) => {
  CodeGenState.symbols = {
    knownStructs: new Set(Object.keys(fields)),
    structFields: new Map(
      Object.entries(fields).map(([name, f]) => [
        name,
        new Map(Object.entries(f).map(([k, [t]]) => [k, t])),
      ]),
    ),
    structFieldDimensions: new Map(
      Object.entries(fields).map(([name, f]) => [
        name,
        new Map(Object.entries(f).map(([k, [, d]]) => [k, d])),
      ]),
    ),
    knownEnums: new Set<string>(),
    knownScopes: new Set<string>(),
    knownRegisters: new Set<string>(),
    knownBitmaps: new Set<string>(),
    functionReturnTypes: new Map(),
    scopeMembers: new Map(),
  } as unknown as typeof CodeGenState.symbols;
};

afterEach(() => {
  CodeGenState.reset();
});

describe("ArrayIndexBoundsAnalyzer (E0854)", () => {
  it("rejects an index at the dimension, on a write and on a read, at the subscript", () => {
    const found = errors(
      "void f() {\n    u8[5] arr;\n    arr[5] <- 1;\n    u8 x <- arr[5];\n}",
    );
    expect(found.map((e) => [e.code, e.line])).toEqual([
      ["E0854", 3],
      ["E0854", 4],
    ]);
    expect(found[0].message).toBe(
      "Array index out of bounds: 5 >= 5 for 'arr' dimension 1",
    );
    expect(found[0].column).toBeGreaterThan(4);
  });

  it("rejects a negative index", () => {
    const [found] = errors(
      "void f() {\n    u8[5] arr;\n    u8 x <- arr[-1];\n}",
    );
    expect(found.message).toBe(
      "Array index out of bounds: -1 is negative for 'arr' dimension 1",
    );
  });

  it("checks each dimension of a multi-dimensional array against its own bound", () => {
    const found = errors(
      "void f() {\n    u8[4][8] grid;\n    grid[3][7] <- 1;\n    grid[4][0] <- 1;\n    u8 x <- grid[0][8];\n}",
    );
    expect(found.map((e) => [e.line, e.message])).toEqual([
      [4, "Array index out of bounds: 4 >= 4 for 'grid' dimension 1"],
      [5, "Array index out of bounds: 8 >= 8 for 'grid[0]' dimension 2"],
    ]);
  });

  it("bounds a parameter and a scope member through `this.`", () => {
    const source = [
      "void f(u8[4] v) {",
      "    u8 x <- v[4];",
      "}",
      "scope M {",
      "    u8[4] table <- [1, 2, 3, 4];",
      "    public void go() {",
      "        this.table[4] <- 1;",
      "        u8 y <- table[9];",
      "    }",
      "}",
    ].join("\n");
    expect(errors(source).map((e) => e.line)).toEqual([2, 7, 8]);
  });

  it("bounds a struct field like a variable (the closed hole)", () => {
    structs({ Frame: { data: ["u8", [4]], grid: ["u8", [2, 3]] } });
    const source = [
      "void f(Frame s) {",
      "    u8 a <- s.data[3];",
      "    u8 b <- s.data[4];",
      "    s.grid[1][3] <- 1;",
      "}",
    ].join("\n");
    const found = errors(source);
    expect(found.map((e) => [e.line, e.message])).toEqual([
      [3, "Array index out of bounds: 4 >= 4 for 's.data' dimension 1"],
      [4, "Array index out of bounds: 3 >= 3 for 's.grid[1]' dimension 2"],
    ]);
  });

  it("stays silent on a runtime index, a bit index, a slice, and an unsized dimension", () => {
    const source = [
      "void f(u8 i, u8[] open) {",
      "    u8[4] arr;",
      "    u8 flags <- 0;",
      "    u8 a <- arr[i];",
      "    flags[9] <- true;",
      "    arr[0, 4] <- 0;",
      "    u8 b <- open[99];",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });
});
