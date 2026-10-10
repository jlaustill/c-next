import { describe, expect, it } from "vitest";

import LengthPropertyAnalyzer from "../LengthPropertyAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-058's length properties, E0867, replacing eighteen throws in
 * `PostfixExpressionGenerator` -- fourteen diagnostics and four internal
 * conditions the audit had read as diagnostics.
 *
 * The rule asks a question of the chain WITHOUT the property step, so a walk
 * that included it would ask about `.element_count`'s own type. The tests that
 * exercise structs, enums and bitmaps declare them in their source, so the
 * symbol view is the one 1.3 and 1.4 build in production.
 */
const errors = (source: string) => {
  const { tree, context } = testAnalysisContextFor(source, { cppMode: false });
  return new LengthPropertyAnalyzer(context).analyze(tree);
};

const inMain = (decls: string, expr: string): string =>
  `${decls}\nu32 main() {\n    u32 n <- ${expr};\n    return n;\n}`;

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

  it("accepts a struct's three lengths (#1535, ADR-058 q7)", () => {
    const decls = "struct S { u32 a; u8 b; }\nS s;";
    for (const p of ["bit_length", "byte_length", "element_count"]) {
      expect(errors(inMain(decls, `s.${p}`))).toEqual([]);
    }
    expect(errors(inMain(decls, "s.char_count"))).toHaveLength(1);
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
    expect(
      errors(
        inMain("enum Color { RED }\nColor c <- Color.RED;", "c.bit_length"),
      ),
    ).toEqual([]);
    expect(
      errors(inMain("bitmap8 Flags { A, Rest[7] }\nFlags f;", "f.byte_length")),
    ).toEqual([]);
  });

  it("sees an array FIELD as an array -- the dimensions the walk used to drop", () => {
    // `structFields` stores the element type; the shape lives in a second map.
    // Reading only the first made `Sample[10] samples` look scalar, and this
    // rejected `.element_count` on it.
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

  // #1760 review: ADR-058 -- a field named like a property is a field
  it("reads a struct's field named like a property as the field", () => {
    const decls =
      "struct Buf {\n    u32 length;\n    u32 size;\n    u32 capacity;\n    u32 bit_length;\n}\nBuf b;";
    for (const field of ["length", "size", "capacity", "bit_length"]) {
      expect(errors(inMain(decls, `b.${field}`))).toEqual([]);
    }
  });

  it("still reads a property a struct declares no field of", () => {
    // The control: the same struct without the field is asked the property
    const decls = "struct Buf {\n    u32 count;\n}\nBuf b;";
    expect(errors(inMain(decls, "b.size")).map((e) => e.code)).toEqual([
      "E0887",
    ]);
    expect(errors(inMain(decls, "b.length")).map((e) => e.code)).toEqual([
      "E0886",
    ]);
  });
});
