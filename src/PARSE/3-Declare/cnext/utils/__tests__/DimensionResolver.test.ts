/**
 * Unit tests for DimensionResolver
 * Issue #1127: one array-dimension resolver shared by both C-Next collectors
 * Issue #1175: what it cannot size it keeps as WRITTEN, never as source text
 */

import { describe, it, expect } from "vitest";
import CNextSourceParser from "../../../../2-Parse/CNextSourceParser";
import * as Parser from "../../../../2-Parse/grammar/CNextParser";
import DimensionResolver from "../DimensionResolver";
import UNRESOLVED_DIMENSION from "../../../../../types/UNRESOLVED_DIMENSION";
import type IDeclaredDimension from "../../types/IDeclaredDimension";

describe("DimensionResolver", () => {
  /** Extract the initializer expression from `u8 x <- <expr>;`. */
  function getExpression(source: string): Parser.ExpressionContext | null {
    const result = CNextSourceParser.parse(source);
    return (
      result.tree.declaration(0)?.variableDeclaration()?.expression() ?? null
    );
  }

  function resolve(expressionSource: string): IDeclaredDimension {
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
      // #1175: as text this was `1--1`, which C reads as a decrement
      ["a subtraction of a negation", "1 - -1", 2],
      ["three operands", "1 + 2 + 3", 6],
    ])("folds %s", (_label, source, expected) => {
      expect(resolve(source)).toEqual({ size: expected, expr: null });
    });

    // #1664 box 7: a const is folded by 1.4, where the declaration is
    // written, so a local `const SIZE` can shadow a global one; 1.3 keeps it
    // as written for 1.4 to settle
    it.each([
      ["a const reference", "SIZE", "name"],
      ["a const combined with a literal", "SIZE + 2", "binary"],
      ["a parenthesized const", "(SIZE)", "name"],
    ])("keeps %s as written, for 1.4", (_label, source, kind) => {
      const resolved = resolve(source);
      expect(resolved.size).toBe(UNRESOLVED_DIMENSION);
      expect(resolved.expr?.kind).toBe(kind);
    });

    it("folds sizeof through the shared TYPE_WIDTH table", () => {
      // The reason TYPE_WIDTH moved to a shared root (transpiler/constants,
      // and `src/types/` since #1853): without it here,
      // collection folded fewer forms than codegen and `u8[sizeof(u32)] sz`
      // reached the header as `sz[sizeof(u32)]`, which is not valid C.
      expect(resolve("sizeof(u32)")).toEqual({ size: 4, expr: null });
    });

    it("keeps an enum-qualified count as written, not dropped", () => {
      // 1.4 settles it to the member's value; it used to stay as the text
      // `EColor.COUNT`, which a separate pass rewrote to EColor__COUNT
      expect(resolve("EColor.COUNT").expr).toMatchObject({
        kind: "name",
        path: ["EColor", "COUNT"],
      });
    });

    it("keeps an unknown identifier as written", () => {
      expect(resolve("BUF_SIZE").expr).toMatchObject({
        kind: "name",
        path: ["BUF_SIZE"],
      });
    });

    it("never drops a dimension, and never keeps source text", () => {
      // Dropping a dimension loses the field's array-ness and shifts every
      // dimension after it -- the failure behind #1157 and #1158. Keeping
      // its text is how C-Next names reached the header (#1175).
      const cases = ["10", "SIZE", "EColor.COUNT", "sizeof(u32)", "a + b"];
      for (const source of cases) {
        const resolved = resolve(source);
        expect(typeof resolved.size).toBe("number");
        const sized = typeof resolved.size === "number" && resolved.size > 0;
        expect(resolved.expr !== null || sized).toBe(true);
      }
    });
  });
});
