import { afterEach, describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import IntegerConversionAnalyzer from "../IntegerConversionAnalyzer";

/**
 * #1322. ADR-024's integer conversions -- E0868 (a literal out of range) and
 * E0869 (narrowing or sign change) -- replacing six rules and two rethrow
 * wrappers spread across `TypeResolver`, `TypeValidator`, `CodeGenerator` and
 * two helpers. One rule, three spellings, one analyzer.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new IntegerConversionAnalyzer().analyze(tree);
};

/**
 * A struct field's type comes from the per-file symbol view, which a unit test
 * does not build. Reaching the chain-resolution arm therefore needs it set --
 * without it the analyzer cannot type `p.col` and stays silent, which looks
 * exactly like the rule not firing.
 */
const structs = (fields: Record<string, Record<string, string>>) => {
  CodeGenState.symbols = {
    knownStructs: new Set(Object.keys(fields)),
    structFields: new Map(
      Object.entries(fields).map(([name, f]) => [
        name,
        new Map(Object.entries(f)),
      ]),
    ),
    structFieldDimensions: new Map(),
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
      structs({ P: { col: "u8", data: "u32" } });
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
});
