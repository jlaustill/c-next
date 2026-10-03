/**
 * Unit tests for DimensionResolver
 * Issue #1127: one array-dimension resolver shared by both C-Next collectors
 */

import { describe, it, expect } from "vitest";
import CNextSourceParser from "../../../../2-Parse/CNextSourceParser";
import * as Parser from "../../../../2-Parse/grammar/CNextParser";
import DimensionResolver from "../DimensionResolver";

describe("DimensionResolver", () => {
  /** Extract the initializer expression from `u8 x <- <expr>;`. */
  function getExpression(source: string): Parser.ExpressionContext | null {
    const result = CNextSourceParser.parse(source);
    return (
      result.tree.declaration(0)?.variableDeclaration()?.expression() ?? null
    );
  }

  function resolve(expressionSource: string): number | string {
    const expr = getExpression(`u8 x <- ${expressionSource};`);
    expect(expr).not.toBeNull();
    return DimensionResolver.resolve(expr!);
  }

  describe("resolve", () => {
    // VariableCollector and StructCollector previously each had their own
    // version of this and disagreed: one dropped what it could not fold, the
    // other folded literals only. Every row below must hold for both.
    it.each([
      ["a decimal literal", "10", 10],
      ["a hex literal", "0x10", 16],
      ["a binary literal", "0b1010", 10],
      ["addition of two literals", "8 + 1", 9],
    ])("folds %s", (_label, source, expected) => {
      expect(resolve(source)).toBe(expected);
    });

    // #1664 box 7: a const is folded by 1.4, where the declaration is
    // written, so a local `const SIZE` can shadow a global one; 1.3 keeps it
    it.each([
      ["a const reference", "SIZE", "SIZE"],
      ["a const combined with a literal", "SIZE + 2", "SIZE+2"],
    ])("keeps %s as text", (_label, source, expected) => {
      expect(resolve(source)).toBe(expected);
    });

    it("folds sizeof through the shared TYPE_WIDTH table", () => {
      // The reason TYPE_WIDTH moved to a shared root (transpiler/constants,
      // and `src/types/` since #1853): without it here,
      // collection folded fewer forms than codegen and `u8[sizeof(u32)] sz`
      // reached the header as `sz[sizeof(u32)]`, which is not valid C.
      expect(resolve("sizeof(u32)")).toBe(4);
    });

    it("keeps an enum-qualified count as source text", () => {
      // Not foldable here, and must not be dropped: the text is what
      // qualifyStructFieldDimensions later turns into EColor__COUNT.
      expect(resolve("EColor.COUNT")).toBe("EColor.COUNT");
    });

    it("keeps an unknown identifier as source text", () => {
      expect(resolve("BUF_SIZE")).toBe("BUF_SIZE");
    });

    it("never returns undefined", () => {
      // Dropping a dimension loses the field's array-ness and shifts every
      // dimension after it -- the failure behind #1157 and #1158.
      const cases = ["10", "SIZE", "EColor.COUNT", "sizeof(u32)", "a + b"];
      for (const source of cases) {
        expect(resolve(source)).toBeDefined();
      }
    });
  });
});
