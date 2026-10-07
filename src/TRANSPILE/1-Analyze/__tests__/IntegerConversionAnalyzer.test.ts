import { describe, expect, it } from "vitest";

import IntegerConversionAnalyzer from "../IntegerConversionAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-024's integer conversions -- E0868 (a literal out of range) and
 * E0869 (narrowing or sign change) -- replacing six rules and two rethrow
 * wrappers spread across `TypeResolver`, `TypeValidator`, `CodeGenerator` and
 * two helpers. One rule, three spellings, one analyzer.
 */
/**
 * A struct field's type comes from the per-file symbol view, which 1.3 and 1.4
 * build from the struct the source declares. Without it the analyzer cannot
 * type `p.col` and stays silent, which looks exactly like the rule not firing.
 */
const errors = (source: string) => {
  const { tree, context } = testAnalysisContextFor(source, { cppMode: false });
  return new IntegerConversionAnalyzer(context).analyze(tree);
};

const inMain = (body: string): string =>
  `u32 wide <- 1000;\ni32 neg <- -5;\nu8 byte <- 7;\nu32 main() {\n${body}\n    return 0;\n}`;

describe("IntegerConversionAnalyzer", () => {
  describe("E0868 -- a literal must fit", () => {
    it("rejects a value past the unsigned bound, with a real position", () => {
      const found = errors(inMain("    u8 x <- 256;"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0868");
      expect(found[0].line).toBe(5);
      expect(found[0].column).toBeGreaterThan(0);
    });

    it("accepts the bound itself, in every base", () => {
      expect(
        errors(
          inMain(
            "    u8 a <- 255;\n    u8 b <- 0xFF;\n    u8 c <- 0b11111111;",
          ),
        ),
      ).toEqual([]);
    });

    it("rejects a negative into an unsigned type and accepts it into a signed one", () => {
      expect(errors(inMain("    u8 x <- -1;"))[0].message).toContain(
        "Negative value",
      );
      expect(errors(inMain("    i8 x <- -128;"))).toEqual([]);
      expect(errors(inMain("    i8 x <- -129;"))).toHaveLength(1);
    });

    it("checks a 64-bit bound exactly, where a double would not", () => {
      // 2^64 - 1 is past 2^53; parseInt would round it INTO range.
      expect(errors(inMain("    u64 x <- 0xFFFFFFFFFFFFFFFF;"))).toEqual([]);
      expect(errors(inMain("    u64 x <- 0x10000000000000000;"))).toHaveLength(
        1,
      );
    });

    it("checks a literal assigned through an assignment statement too", () => {
      expect(errors(inMain("    u8 x <- 0;\n    x <- 300;"))).toHaveLength(1);
    });
  });

  describe("E0869 -- no implicit narrowing or sign change", () => {
    it("rejects narrowing in a declaration, an assignment and a cast", () => {
      expect(errors(inMain("    u8 x <- wide;"))[0].message).toContain(
        "narrowing",
      );
      expect(
        errors(inMain("    u8 x <- 0;\n    x <- wide;"))[0].message,
      ).toContain("assign u32 to u8");
      expect(errors(inMain("    u8 x <- (u8)wide;"))[0].message).toContain(
        "cast u32 to u8",
      );
    });

    it("rejects a sign change and accepts a widening", () => {
      expect(errors(inMain("    u32 x <- neg;"))[0].message).toContain(
        "sign change",
      );
      expect(errors(inMain("    u32 x <- byte;"))).toEqual([]);
      expect(errors(inMain("    u32 x <- (u32)byte;"))).toEqual([]);
    });

    it("accepts a bit extraction -- the explicit reinterpret the message asks for", () => {
      // Typing `wide[0, 8]` would make the sanctioned form fail the very check
      // it exists to satisfy.
      expect(errors(inMain("    u8 x <- wide[0, 8];"))).toEqual([]);
      expect(errors(inMain("    u8 x <- (u8)wide[0, 8];"))).toEqual([]);
    });

    it("skips a compound operator, which ADR-044 governs", () => {
      expect(errors(inMain("    u8 x <- 0;\n    x +<- wide;"))).toEqual([]);
    });

    it("skips a slice target, which ADR-007 governs", () => {
      expect(errors(inMain("    u8[16] buf;\n    buf[0, 4] <- wide;"))).toEqual(
        [],
      );
    });
  });

  describe("what is typed, and what codegen never typed", () => {
    it("types a composite in a declaration: first operand's category, widest width", () => {
      expect(errors(inMain("    u8 x <- wide + 1;"))).toHaveLength(1);
      expect(errors(inMain("    u32 x <- byte + 1;"))).toEqual([]);
    });

    it("types a composite through an assignment too -- the divergence closed", () => {
      // Codegen never typed a composite on this path, and #1322 reproduced
      // that rather than closing it. Ruled a bug: the same operands convert the
      // same way whichever side of a declaration they land on.
      expect(
        errors(inMain("    u8[4] cells;\n    cells[0] <- wide + 1;")),
      ).toHaveLength(1);
    });

    it("does not type a composite with a float literal as an integer (#1668)", () => {
      // 2.2 types a float literal operand as floating, so this composite is not
      // an integer composite and is no integer narrowing. 2.1 reads the literal
      // the same way; skipping it read `wide * 2.5` as a u32 and reported a u32
      // narrowing. E0810 rejects the mix itself -- this is the passes agreeing.
      // The composite is floating, so storing it in a u8 is E0891 (#1800):
      // a float reaches an integer only through a cast.
      expect(
        errors(inMain("    u8 x <- wide * 2.5;")).map((error) => error.code),
      ).toEqual(["E0891"]);
      // CONTROL: an integer literal is contextually typed and still narrows.
      expect(errors(inMain("    u8 x <- wide * 2;"))).toHaveLength(1);
    });

    it("leaves a ternary untyped: literal branches have no declared type", () => {
      expect(errors(inMain("    i32 s <- (wide > 0) ? 1 : -1;"))).toEqual([]);
    });

    it("checks an assignment against the type the value lands in, not the root's", () => {
      // Codegen looked up `arr` / `p` and skipped anything whose declared base
      // type was not an integer, so a struct root was never checked at all and
      // `p.col <- wide` emitted a silent truncation. Ruled a bug and closed.
      expect(
        errors(inMain("    u8[4] arr;\n    arr[0] <- wide;")),
      ).toHaveLength(1);
      expect(
        errors(
          "struct P { u8 col; u32 data; }\nu32 wide <- 9;\nu32 main() {\n    P p;\n    p.col <- wide;\n    return 0;\n}",
        ),
      ).toHaveLength(1);
      // CONTROL: the same chain into a field wide enough for the value.
      expect(
        errors(
          "struct P { u8 col; u32 data; }\nu32 wide <- 9;\nu32 main() {\n    P p;\n    p.data <- wide + 1;\n    return 0;\n}",
        ),
      ).toEqual([]);
    });

    it("resolves `this.` inside a scope -- the hole this closes", () => {
      const found = errors(
        "scope S {\n    u32 wide <- 1000;\n    u8 narrow <- this.wide;\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].line).toBe(3);
    });
  });

  // #1800, owner ruling 2026-09-28: "this should be a compiler error with an
  // explicit cast". The implicit form was emitted as C's conversion, which is
  // undefined for NaN and past the target's range; the cast saturates.
  describe("E0891 -- a float reaches an integer only through a cast", () => {
    const withFloat = (line: string): string =>
      `f32 read() {\n    return 1.5;\n}\n${inMain(`    f32 k <- 2.5;\n    bool c <- true;\n${line}`)}`;
    const codes = (line: string): string[] =>
      errors(withFloat(line)).map((error) => error.code);

    it.each([
      ["a float variable", "    u32 b <- k;"],
      ["a floating composite", "    u32 b <- k + 1.0;"],
      ["a floating ternary", "    u32 b <- (c = true) ? k : 1.0;"],
      ["a call returning a float", "    u32 b <- read();"],
      ["a float literal", "    u32 b <- 3.5;"],
      ["an assignment", "    u32 b <- 0;\n    b <- k;"],
    ])("rejects %s", (_label, line) => {
      expect(codes(line)).toEqual(["E0891"]);
    });

    it("names the floating type and the cast to write", () => {
      const [found] = errors(withFloat("    i16 b <- k;"));
      expect(found.message).toBe(
        "Implicit conversion from floating f32 to integer i16",
      );
      expect(found.helpText).toContain("(i16)value");
    });

    it.each([
      ["the explicit cast", "    u32 b <- (u32)k;"],
      ["a float's bit range (ADR-007)", "    u32 b <- k[0, 32];"],
      ["an integer", "    u32 b <- byte;"],
      ["an integer into a float", "    f32 f <- byte;"],
    ])("accepts %s", (_label, line) => {
      expect(codes(line)).toEqual([]);
    });

    // #1760 second review, owner ruling "all positions now": every position
    // a value lands in, not only a declaration or an assignment
    const positioned = (body: string): string[] =>
      errors(
        [
          "struct Pair {\n    u32 a;\n    f32 b;\n}",
          "void take(u32 n) {\n}",
          "void takeFloat(f32 x) {\n}",
          "u32 give(f32 x) {\n" + body + "\n}",
        ].join("\n"),
      ).map((error) => error.code);

    it.each([
      ["an argument", "    take(x);\n    return 0;"],
      ["a return value", "    return x;"],
      ["a struct field", "    Pair p <- { a: x, b: x };\n    return 0;"],
      ["an array element", "    u32[2] l <- [x, 1];\n    return 0;"],
      ["an array fill", "    u32[2] l <- [x*];\n    return 0;"],
      ["a nested element", "    u32[1][2] l <- [[x, 1]];\n    return 0;"],
    ])("rejects a float as %s", (_label, body) => {
      expect(positioned(body)).toEqual(["E0891"]);
    });

    it.each([
      ["a cast argument", "    take((u32)x);\n    return 0;"],
      ["a float parameter", "    takeFloat(x);\n    return 0;"],
      ["a cast return", "    return (u32)x;"],
      ["a cast field", "    Pair p <- { a: (u32)x, b: x };\n    return 0;"],
      ["an integer element", "    u32[2] l <- [(u32)x, 1];\n    return 0;"],
    ])("accepts %s", (_label, body) => {
      expect(positioned(body)).toEqual([]);
    });

    // A `for` header's declaration is a declaration (#1760 second review)
    it.each([
      ["E0891", "    for (u32 i <- k; i < 10; i +<- 1) {\n    }"],
      ["E0868", "    for (u8 j <- 300; j < 10; j +<- 1) {\n    }"],
      ["E0869", "    for (u8 q <- wide; q < 10; q +<- 1) {\n    }"],
    ])("reports %s in a for header", (code, line) => {
      expect(codes(line)).toEqual([code]);
    });
  });
});
