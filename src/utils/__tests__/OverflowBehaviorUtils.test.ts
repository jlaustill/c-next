import { describe, expect, it } from "vitest";
import CNextSourceParser from "../../transpiler/logic/parser/CNextSourceParser";
import OverflowBehaviorUtils from "../OverflowBehaviorUtils";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";

/**
 * Issue #1303: the one decoder for ADR-044's `clamp`/`wrap` modifier.
 *
 * Parses real source rather than mocking a context, because the whole point of
 * this module is that it reads the CLAMP/WRAP tokens the grammar actually
 * produces -- a mock would let the test agree with a decoder that reads the
 * wrong node.
 */
const modifierFor = (
  declaration: string,
): Parser.OverflowModifierContext | null => {
  const { tree, errors } = CNextSourceParser.parse(declaration);
  if (errors.length > 0) {
    throw new Error(`unparsable fixture: ${errors[0].message}`);
  }
  const varCtx = tree.declaration(0)!.variableDeclaration()!;
  return varCtx.overflowModifier();
};

describe("OverflowBehaviorUtils", () => {
  describe("fromModifier", () => {
    it("reads an explicit wrap modifier", () => {
      expect(
        OverflowBehaviorUtils.fromModifier(modifierFor("wrap u8 a;")),
      ).toBe("wrap");
    });

    it("reads an explicit clamp modifier", () => {
      expect(
        OverflowBehaviorUtils.fromModifier(modifierFor("clamp u8 a;")),
      ).toBe("clamp");
    });

    it("defaults an undeclared modifier to clamp, per ADR-044", () => {
      // The absent case is the one that matters: ADR-044 makes clamp the safe
      // default precisely so an embedded author opts IN to wrapping. A decoder
      // that returned "wrap" here would silently turn every plain `u8` into
      // two's-complement arithmetic.
      expect(modifierFor("u8 a;")).toBeNull();
      expect(OverflowBehaviorUtils.fromModifier(null)).toBe("clamp");
    });

    it("distinguishes the two modifiers on otherwise identical declarations", () => {
      // Guards the decoder against collapsing to a constant: an implementation
      // that always answered "clamp" would pass all three tests above except
      // the wrap one, and one that always answered "wrap" would pass only it.
      expect(
        OverflowBehaviorUtils.fromModifier(modifierFor("wrap u16 a;")),
      ).not.toBe(
        OverflowBehaviorUtils.fromModifier(modifierFor("clamp u16 a;")),
      );
    });
  });
});
