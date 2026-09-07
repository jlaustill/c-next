import { afterEach, describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import LengthPropertyAnalyzer from "../LengthPropertyAnalyzer";

/**
 * #1322. ADR-058's length properties, E0867, replacing eighteen throws in
 * `PostfixExpressionGenerator` -- fourteen diagnostics and four internal
 * conditions the audit had read as diagnostics.
 *
 * The rule asks a question of the chain WITHOUT the property step, so a walk
 * that included it would ask about `.element_count`'s own type. The tests that
 * exercise struct fields set the symbol view directly; `reset()` runs after
 * each (CLAUDE.md, analyzer test isolation).
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new LengthPropertyAnalyzer().analyze(tree);
};

const inMain = (decls: string, expr: string): string =>
  `${decls}\nu32 main() {\n    u32 n <- ${expr};\n    return n;\n}`;

afterEach(() => {
  CodeGenState.reset();
});

describe("LengthPropertyAnalyzer", () => {
  it("rejects .element_count on a scalar, with a real position", () => {
    const found = errors(inMain("u32 v <- 5;", "v.element_count"));
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0867");
    expect(found[0].line).toBe(3);
    expect(found[0].column).toBeGreaterThan(0);
  });

  it("rejects .char_count on anything but a string", () => {
    expect(errors(inMain("u32 v <- 5;", "v.char_count"))).toHaveLength(1);
    expect(errors(inMain("u32[4] a;", "a.char_count"))).toHaveLength(1);
  });

  it("rejects .bit_length on a struct -- the ADR-058 divergence, preserved", () => {
    // ADR-058's table gives structs a .bit_length and the transpiler rejects
    // it. The relocation keeps that behavior identical rather than closing the
    // divergence, because closing it means choosing a padding model the ADR
    // does not name. See the analyzer's header.
    CodeGenState.symbols = {
      knownEnums: new Set<string>(),
      knownBitmaps: new Set<string>(),
      knownStructs: new Set(["S"]),
      structFields: new Map(),
      structFieldDimensions: new Map(),
      functionReturnTypes: new Map(),
    } as unknown as typeof CodeGenState.symbols;
    expect(
      errors(inMain("struct S { u32 a; }\nS s;", "s.bit_length")),
    ).toHaveLength(1);
  });

  it("accepts every property on a type that answers it", () => {
    expect(errors(inMain("u32[4] a;", "a.element_count"))).toEqual([]);
    expect(errors(inMain('string<8> t <- "hi";', "t.char_count"))).toEqual([]);
    expect(errors(inMain("u32 v <- 5;", "v.bit_length"))).toEqual([]);
    expect(errors(inMain("u32[4] a;", "a.byte_length"))).toEqual([]);
    expect(errors(inMain('string<8> t <- "hi";', "t.bit_length"))).toEqual([]);
  });

  it("accepts an unsized const string as a string", () => {
    // Its type text is `string`, not `string<N>`. A check keyed on the `<`
    // called it not-a-string and rejected `.char_count` on it.
    expect(errors(inMain('const string V <- "1.0";', "V.char_count"))).toEqual(
      [],
    );
  });

  it("accepts .bit_length on an enum and a bitmap, which have widths", () => {
    CodeGenState.symbols = {
      knownEnums: new Set(["Color"]),
      knownBitmaps: new Set(["Flags"]),
      knownStructs: new Set<string>(),
      structFields: new Map(),
      structFieldDimensions: new Map(),
      functionReturnTypes: new Map(),
    } as unknown as typeof CodeGenState.symbols;
    expect(
      errors(
        inMain("enum Color { RED }\nColor c <- Color.RED;", "c.bit_length"),
      ),
    ).toEqual([]);
    expect(
      errors(inMain("bitmap8 Flags { A }\nFlags f;", "f.byte_length")),
    ).toEqual([]);
  });

  it("sees an array FIELD as an array -- the dimensions the walk used to drop", () => {
    // `structFields` stores the element type; the shape lives in a second map.
    // Reading only the first made `Sample[10] samples` look scalar, and this
    // rejected `.element_count` on it.
    CodeGenState.symbols = {
      knownEnums: new Set<string>(),
      knownBitmaps: new Set<string>(),
      knownStructs: new Set(["Batch", "Sample"]),
      structFields: new Map([["Batch", new Map([["samples", "Sample"]])]]),
      structFieldDimensions: new Map([["Batch", new Map([["samples", [10]]])]]),
      functionReturnTypes: new Map(),
    } as unknown as typeof CodeGenState.symbols;
    expect(
      errors(
        inMain(
          "struct Sample { u32 t; }\nstruct Batch { Sample[10] samples; }\nBatch b;",
          "b.samples.element_count",
        ),
      ),
    ).toEqual([]);
  });

  it("rejects .element_count once the array is fully subscripted", () => {
    const found = errors(inMain("u32[4] a;", "a[0].element_count"));
    expect(found).toHaveLength(1);
  });

  it("treats `args` specially: only .element_count answers", () => {
    const src = (p: string) =>
      `u32 main(string<64>[] args) {\n    u32 n <- args.${p};\n    return n;\n}`;
    expect(errors(src("bit_length"))).toHaveLength(1);
    expect(errors(src("element_count"))).toEqual([]);
  });

  it("says nothing about a subject it cannot resolve", () => {
    // An undeclared name is E0427's, reported in this same pass before this
    // step. Guessing here would be a second diagnostic for one mistake.
    expect(errors(inMain("", "undeclared.element_count"))).toEqual([]);
  });
});
