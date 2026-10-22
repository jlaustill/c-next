import { describe, expect, it } from "vitest";
import CnxSourceParser from "../../PARSE/2-Parse/CnxSourceParser";
import OverflowBehaviorUtils from "../OverflowBehaviorUtils";
import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import type TOverflowBehavior from "../../types/TOverflowBehavior";

/**
 * Issue #1303: the one decoder for ADR-044's `clamp`/`wrap` modifier.
 *
 * Parses real source and lowers it through 1.2 rather than writing the modifier
 * by hand, because 1.2 reads the CLAMP/WRAP tokens (#1991: 1.3 reads only what
 * 1.2 returned) -- a hand-written value would let the test agree with a
 * lowering that reads the wrong node.
 */
const modifierFor = (declaration: string): TOverflowBehavior | null => {
  const { tree, parseErrors: errors } = CnxSourceParser.parse(declaration);
  if (errors.length > 0) {
    throw new Error(`unparsable fixture: ${errors[0].message}`);
  }
  const varCtx = tree.declaration(0)!.variableDeclaration()!;
  return SyntaxLowering.overflow(varCtx.overflowModifier());
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
