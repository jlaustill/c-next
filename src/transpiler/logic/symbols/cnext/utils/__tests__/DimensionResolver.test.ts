/**
 * Unit tests for DimensionResolver
 * Issue #1127: one array-dimension resolver shared by both C-Next collectors
 */

import { describe, it, expect } from "vitest";
import CNextSourceParser from "../../../../parser/CNextSourceParser";
import * as Parser from "../../../../parser/grammar/CNextParser";
import DimensionResolver from "../DimensionResolver";

describe("DimensionResolver", () => {
  /** Extract the initializer expression from `u8 x <- <expr>;`. */
  function getExpression(source: string): Parser.ExpressionContext | null {
    const result = CNextSourceParser.parse(source);
    return (
      result.tree.declaration(0)?.variableDeclaration()?.expression() ?? null
    );
  }

  function resolve(
    expressionSource: string,
    constValues?: Map<string, number>,
  ): number | string {
    const expr = getExpression(`u8 x <- ${expressionSource};`);
    expect(expr).not.toBeNull();
    return DimensionResolver.resolve(expr!, constValues);
  }

  describe("resolve", () => {
    // VariableCollector and StructCollector previously each had their own
    // version of this and disagreed: one dropped what it could not fold, the
    // other folded literals only. Every row below must hold for both.
    it.each([
      ["a decimal literal", "10", undefined, 10],
      ["a hex literal", "0x10", undefined, 16],
      ["a binary literal", "0b1010", undefined, 10],
      ["addition of two literals", "8 + 1", undefined, 9],
    ])("folds %s", (_label, source, constValues, expected) => {
      expect(resolve(source, constValues)).toBe(expected);
    });

    it("folds a const reference from the supplied map", () => {
      expect(resolve("SIZE", new Map([["SIZE", 6]]))).toBe(6);
    });

    it("folds a const combined with a literal", () => {
      expect(resolve("SIZE + 2", new Map([["SIZE", 6]]))).toBe(8);
    });

    it("folds sizeof through the shared TYPE_WIDTH table", () => {
      // The reason TYPE_WIDTH moved to transpiler/constants: without it here,
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
      expect(resolve("BUF_SIZE", new Map([["SIZE", 6]]))).toBe("BUF_SIZE");
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
