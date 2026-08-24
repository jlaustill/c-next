/**
 * Unit tests for LiteralUtils
 * Tests literal detection for zero values and floating-point types.
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../transpiler/logic/parser/grammar/CNextLexer";
import {
  CNextParser,
  LiteralContext,
} from "../../transpiler/logic/parser/grammar/CNextParser";
import LiteralUtils from "../LiteralUtils";

/**
 * Helper to parse C-Next code and extract the first literal from a variable declaration.
 * Parses: "void main() { u32 x <- <literal>; }"
 */
function extractLiteral(literalText: string): LiteralContext | null {
  const code = `void main() { u32 x <- ${literalText}; }`;
  const charStream = CharStream.fromString(code);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  const tree = parser.program();

  // Navigate: program -> declaration -> functionDeclaration -> block ->
  //           statement -> variableDeclaration -> expression -> ... -> literal
  const funcDecl = tree.declaration(0)?.functionDeclaration();
  if (!funcDecl) return null;

  const block = funcDecl.block();
  if (!block) return null;

  const stmt = block.statement(0);
  if (!stmt) return null;

  const varDecl = stmt.variableDeclaration();
  if (!varDecl) return null;

  const expr = varDecl.expression();
  if (!expr) return null;

  // Traverse expression tree to literal
  const ternary = expr.ternaryExpression();
  if (!ternary) return null;

  const orExpr = ternary.orExpression(0);
  if (!orExpr) return null;

  const andExpr = orExpr.andExpression(0);
  if (!andExpr) return null;

  const eqExpr = andExpr.equalityExpression(0);
  if (!eqExpr) return null;

  const relExpr = eqExpr.relationalExpression(0);
  if (!relExpr) return null;

  const bitorExpr = relExpr.bitwiseOrExpression(0);
  if (!bitorExpr) return null;

  const bitxorExpr = bitorExpr.bitwiseXorExpression(0);
  if (!bitxorExpr) return null;

  const bitandExpr = bitxorExpr.bitwiseAndExpression(0);
  if (!bitandExpr) return null;

  const shiftExpr = bitandExpr.shiftExpression(0);
  if (!shiftExpr) return null;

  const addExpr = shiftExpr.additiveExpression(0);
  if (!addExpr) return null;

  const multExpr = addExpr.multiplicativeExpression(0);
  if (!multExpr) return null;

  const unaryExpr = multExpr.unaryExpression(0);
  if (!unaryExpr) return null;

  const postfixExpr = unaryExpr.postfixExpression();
  if (!postfixExpr) return null;

  const primaryExpr = postfixExpr.primaryExpression();
  if (!primaryExpr) return null;

  return primaryExpr.literal();
}

/**
 * Helper to extract literal from float variable declaration
 */
function extractFloatLiteral(literalText: string): LiteralContext | null {
  const code = `void main() { f32 x <- ${literalText}; }`;
  const charStream = CharStream.fromString(code);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  const tree = parser.program();

  const funcDecl = tree.declaration(0)?.functionDeclaration();
  if (!funcDecl) return null;

  const block = funcDecl.block();
  if (!block) return null;

  const stmt = block.statement(0);
  if (!stmt) return null;

  const varDecl = stmt.variableDeclaration();
  if (!varDecl) return null;

  const expr = varDecl.expression();
  if (!expr) return null;

  const ternary = expr.ternaryExpression();
  if (!ternary) return null;

  const orExpr = ternary.orExpression(0);
  if (!orExpr) return null;

  const andExpr = orExpr.andExpression(0);
  if (!andExpr) return null;

  const eqExpr = andExpr.equalityExpression(0);
  if (!eqExpr) return null;

  const relExpr = eqExpr.relationalExpression(0);
  if (!relExpr) return null;

  const bitorExpr = relExpr.bitwiseOrExpression(0);
  if (!bitorExpr) return null;

  const bitxorExpr = bitorExpr.bitwiseXorExpression(0);
  if (!bitxorExpr) return null;

  const bitandExpr = bitxorExpr.bitwiseAndExpression(0);
  if (!bitandExpr) return null;

  const shiftExpr = bitandExpr.shiftExpression(0);
  if (!shiftExpr) return null;

  const addExpr = shiftExpr.additiveExpression(0);
  if (!addExpr) return null;

  const multExpr = addExpr.multiplicativeExpression(0);
  if (!multExpr) return null;

  const unaryExpr = multExpr.unaryExpression(0);
  if (!unaryExpr) return null;

  const postfixExpr = unaryExpr.postfixExpression();
  if (!postfixExpr) return null;

  const primaryExpr = postfixExpr.primaryExpression();
  if (!primaryExpr) return null;

  return primaryExpr.literal();
}

describe("LiteralUtils", () => {
  // ========================================================================
  // isZero: Integer Literals
  // ========================================================================

  describe("isZero - integer literals", () => {
    it.each([
      ["0", true],
      ["1", false],
      ["42", false],
    ])("isZero(%s) is %s", (source, expected) => {
      const literal = extractLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(expected);
    });
  });

  // ========================================================================
  // isZero: Hex Literals
  // ========================================================================

  describe("isZero - hex literals", () => {
    it.each([
      ["0x0", true],
      ["0X0", true],
      ["0xFF", false],
      ["0x1", false],
    ])("isZero(%s) is %s", (source, expected) => {
      const literal = extractLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(expected);
    });
  });

  // ========================================================================
  // isZero: Binary Literals
  // ========================================================================

  describe("isZero - binary literals", () => {
    it.each([
      ["0b0", true],
      ["0B0", true],
      ["0b1010", false],
      ["0b1", false],
    ])("isZero(%s) is %s", (source, expected) => {
      const literal = extractLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(expected);
    });
  });

  // ========================================================================
  // isZero: Suffixed Literals
  // ========================================================================

  describe("isZero - suffixed decimal literals", () => {
    it.each([
      ["0u8", true],
      ["0i32", true],
      ["5u32", false],
    ])("isZero(%s) is %s", (source, expected) => {
      const literal = extractLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(expected);
    });
  });

  describe("isZero - suffixed hex literals", () => {
    it.each([
      ["0x0u8", true],
      ["0X0i32", true],
      ["0xFFu8", false],
    ])("isZero(%s) is %s", (source, expected) => {
      const literal = extractLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(expected);
    });
  });

  describe("isZero - suffixed binary literals", () => {
    it.each([
      ["0b0u8", true],
      ["0B0i16", true],
      ["0b1u8", false],
    ])("isZero(%s) is %s", (source, expected) => {
      const literal = extractLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(expected);
    });
  });

  // ========================================================================
  // isZero: Float Literals (Issue #1010)
  // ========================================================================

  describe("isZero - float literals (Issue #1010)", () => {
    it.each([
      ["0.0", true],
      ["0.0f", true],
      ["0.0F", true],
      [".0", true],
      ["1.0", false],
      ["0.001", false],
    ])("isZero(%s) is %s", (source, expected) => {
      const literal = extractFloatLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(expected);
    });

    it("should return false for negative float (-0.5)", () => {
      const literal = extractFloatLiteral("-0.5");
      // Note: -0.5 may not parse as a single literal due to negation
      // This is expected - the unary minus is a separate operator
      if (literal) {
        expect(LiteralUtils.isZero(literal!)).toBe(false);
      }
    });
  });

  // ========================================================================
  // isFloatZero (Issue #1010)
  // ========================================================================

  describe("isFloatZero - static method (Issue #1010)", () => {
    it("should return true for 0.0", () => {
      expect(LiteralUtils.isFloatZero("0.0")).toBe(true);
    });

    it("should return true for .0", () => {
      expect(LiteralUtils.isFloatZero(".0")).toBe(true);
    });

    it("should return true for 0.", () => {
      expect(LiteralUtils.isFloatZero("0.")).toBe(true);
    });

    it("should return true for 0.0f", () => {
      expect(LiteralUtils.isFloatZero("0.0f")).toBe(true);
    });

    it("should return true for 0.0F", () => {
      expect(LiteralUtils.isFloatZero("0.0F")).toBe(true);
    });

    it("should return true for scientific notation zero (0.0e0)", () => {
      expect(LiteralUtils.isFloatZero("0.0e0")).toBe(true);
    });

    it("should return true for scientific notation zero (0e0)", () => {
      expect(LiteralUtils.isFloatZero("0e0")).toBe(true);
    });

    it("should return false for 1.0", () => {
      expect(LiteralUtils.isFloatZero("1.0")).toBe(false);
    });

    it("should return false for 0.5", () => {
      expect(LiteralUtils.isFloatZero("0.5")).toBe(false);
    });

    it("should return false for 3.14", () => {
      expect(LiteralUtils.isFloatZero("3.14")).toBe(false);
    });

    it("should return false for scientific notation non-zero (1e-10)", () => {
      expect(LiteralUtils.isFloatZero("1e-10")).toBe(false);
    });
  });

  // ========================================================================
  // isFloat
  // ========================================================================

  describe("isFloat", () => {
    it("should return true for simple float literal", () => {
      const literal = extractFloatLiteral("1.5");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isFloat(literal!)).toBe(true);
    });

    it("should return true for float with leading zero", () => {
      const literal = extractFloatLiteral("0.5");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isFloat(literal!)).toBe(true);
    });

    it("should return true for float zero", () => {
      const literal = extractFloatLiteral("0.0");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isFloat(literal!)).toBe(true);
    });

    it("should return false for integer literal", () => {
      const literal = extractLiteral("42");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isFloat(literal!)).toBe(false);
    });

    it("should return false for hex literal", () => {
      const literal = extractLiteral("0xFF");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isFloat(literal!)).toBe(false);
    });
  });

  // ========================================================================
  // parseIntegerLiteral (Issue #455)
  // ========================================================================

  describe("parseIntegerLiteral", () => {
    describe("decimal literals", () => {
      it("should parse simple decimal", () => {
        expect(LiteralUtils.parseIntegerLiteral("42")).toBe(42);
      });

      it("should parse zero", () => {
        expect(LiteralUtils.parseIntegerLiteral("0")).toBe(0);
      });

      it("should parse negative decimal", () => {
        expect(LiteralUtils.parseIntegerLiteral("-17")).toBe(-17);
      });

      it("should parse large decimal", () => {
        expect(LiteralUtils.parseIntegerLiteral("1000000")).toBe(1000000);
      });
    });

    describe("hex literals", () => {
      it("should parse hex with lowercase prefix", () => {
        expect(LiteralUtils.parseIntegerLiteral("0x10")).toBe(16);
      });

      it("should parse hex with uppercase prefix", () => {
        expect(LiteralUtils.parseIntegerLiteral("0X10")).toBe(16);
      });

      it("should parse hex with mixed case digits", () => {
        expect(LiteralUtils.parseIntegerLiteral("0xDeAdBeEf")).toBe(0xdeadbeef);
      });

      it("should parse hex zero", () => {
        expect(LiteralUtils.parseIntegerLiteral("0x0")).toBe(0);
      });

      it("should parse hex FF", () => {
        expect(LiteralUtils.parseIntegerLiteral("0xFF")).toBe(255);
      });
    });

    describe("binary literals", () => {
      it("should parse binary with lowercase prefix", () => {
        expect(LiteralUtils.parseIntegerLiteral("0b1010")).toBe(10);
      });

      it("should parse binary with uppercase prefix", () => {
        expect(LiteralUtils.parseIntegerLiteral("0B1010")).toBe(10);
      });

      it("should parse binary zero", () => {
        expect(LiteralUtils.parseIntegerLiteral("0b0")).toBe(0);
      });

      it("should parse binary one", () => {
        expect(LiteralUtils.parseIntegerLiteral("0b1")).toBe(1);
      });

      it("should parse 8-bit binary", () => {
        expect(LiteralUtils.parseIntegerLiteral("0b11111111")).toBe(255);
      });
    });

    describe("invalid inputs", () => {
      it("should return undefined for identifier", () => {
        expect(
          LiteralUtils.parseIntegerLiteral("DEVICE_COUNT"),
        ).toBeUndefined();
      });

      it("should return undefined for float", () => {
        expect(LiteralUtils.parseIntegerLiteral("3.14")).toBeUndefined();
      });

      it("should return undefined for string", () => {
        expect(LiteralUtils.parseIntegerLiteral('"hello"')).toBeUndefined();
      });

      it("should return undefined for expression", () => {
        expect(LiteralUtils.parseIntegerLiteral("2 + 2")).toBeUndefined();
      });

      it("should return undefined for empty string", () => {
        expect(LiteralUtils.parseIntegerLiteral("")).toBeUndefined();
      });
    });

    describe("whitespace handling", () => {
      it("should handle leading whitespace", () => {
        expect(LiteralUtils.parseIntegerLiteral("  42")).toBe(42);
      });

      it("should handle trailing whitespace", () => {
        expect(LiteralUtils.parseIntegerLiteral("42  ")).toBe(42);
      });

      it("should handle both leading and trailing whitespace", () => {
        expect(LiteralUtils.parseIntegerLiteral("  0xFF  ")).toBe(255);
      });
    });
  });
});
