/**
 * Unit tests for TypeValidator.validateLoopConditionNotAlwaysTrue
 * ADR-113 / Issue #1075: reject always-true literal loop conditions (E0707).
 *
 * Only the v0.2.18 literal slice — integer/bool literal comparisons decided
 * without symbol resolution. Named constants, non-literal operands, and
 * always-false conditions are out of scope (#1076).
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../../logic/parser/grammar/CNextLexer";
import { CNextParser } from "../../../logic/parser/grammar/CNextParser";
import TypeValidator from "../TypeValidator";

function parseCondition(text: string) {
  const charStream = CharStream.fromString(text);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  return parser.expression();
}

function isFlaggedAlwaysTrue(text: string): boolean {
  try {
    TypeValidator.validateLoopConditionNotAlwaysTrue(parseCondition(text));
    return false;
  } catch (error) {
    return /E0707/.test((error as Error).message);
  }
}

describe("TypeValidator.validateLoopConditionNotAlwaysTrue (E0707)", () => {
  describe("flags always-true literal comparisons", () => {
    it.each([
      "1 = 1",
      "true = true",
      "false = false",
      "1 != 2",
      "5 > 3",
      "3 < 5",
      "3 >= 3",
      "5 <= 5",
      "0x10 = 16",
      "0XFF = 255", // uppercase hex prefix
      "0b10 = 2",
      "5u8 = 5", // type-suffixed literal
    ])("flags %s", (condition) => {
      expect(isFlaggedAlwaysTrue(condition)).toBe(true);
    });

    it("includes the condition text and steers to forever", () => {
      let message = "";
      try {
        TypeValidator.validateLoopConditionNotAlwaysTrue(
          parseCondition("1 = 1"),
        );
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain(
        "Error E0707: loop condition '1=1' is always true",
      );
      expect(message).toContain("forever { ... }");
    });
  });

  describe("does NOT flag always-false comparisons (out of scope, #1076)", () => {
    it.each(["1 = 2", "true = false", "1 != 1", "5 < 3", "3 > 5", "5 <= 3"])(
      "allows %s",
      (condition) => {
        expect(isFlaggedAlwaysTrue(condition)).toBe(false);
      },
    );
  });

  describe("does NOT flag non-literal or compound conditions (needs folding, #1076)", () => {
    it.each([
      "x = 1", // identifier operand
      "MAX > 0", // named constant
      "a = b", // two identifiers
      "5.0 > 3.0", // float operands
      "1 + 0 = 1", // compound left operand
      "1 = 1 || 0 > 5", // logical-or combination
      "1 = 1 && 2 = 2", // logical-and combination
      "0777 = 777", // leading-zero literal: C reads it as octal (511), so a
      // decimal parse (777) would diverge — skipped, not wrongly flagged
    ])("allows %s", (condition) => {
      expect(isFlaggedAlwaysTrue(condition)).toBe(false);
    });
  });
});
