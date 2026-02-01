/**
 * Unit tests for LiteralUtils
 * Tests literal detection for zero values and floating-point types.
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../logic/parser/grammar/CNextLexer";
import {
  CNextParser,
  LiteralContext,
} from "../logic/parser/grammar/CNextParser";
import LiteralUtils from "./LiteralUtils";

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
    it("should return true for integer zero", () => {
      const literal = extractLiteral("0");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(true);
    });

    it("should return false for non-zero integer", () => {
      const literal = extractLiteral("1");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(false);
    });

    it("should return false for larger integers", () => {
      const literal = extractLiteral("42");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(false);
    });
  });

  // ========================================================================
  // isZero: Hex Literals
  // ========================================================================

  describe("isZero - hex literals", () => {
    it("should return true for hex zero (0x0)", () => {
      const literal = extractLiteral("0x0");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(true);
    });

    it("should return true for uppercase hex zero (0X0)", () => {
      const literal = extractLiteral("0X0");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(true);
    });

    it("should return false for non-zero hex", () => {
      const literal = extractLiteral("0xFF");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(false);
    });

    it("should return false for hex one (0x1)", () => {
      const literal = extractLiteral("0x1");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(false);
    });
  });

  // ========================================================================
  // isZero: Binary Literals
  // ========================================================================

  describe("isZero - binary literals", () => {
    it("should return true for binary zero (0b0)", () => {
      const literal = extractLiteral("0b0");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(true);
    });

    it("should return true for uppercase binary zero (0B0)", () => {
      const literal = extractLiteral("0B0");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(true);
    });

    it("should return false for non-zero binary", () => {
      const literal = extractLiteral("0b1010");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(false);
    });

    it("should return false for binary one (0b1)", () => {
      const literal = extractLiteral("0b1");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(false);
    });
  });

  // ========================================================================
  // isZero: Suffixed Literals
  // ========================================================================

  describe("isZero - suffixed decimal literals", () => {
    it("should return true for suffixed unsigned zero (0u8)", () => {
      const literal = extractLiteral("0u8");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(true);
    });

    it("should return true for suffixed signed zero (0i32)", () => {
      const literal = extractLiteral("0i32");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(true);
    });

    it("should return false for suffixed non-zero (5u32)", () => {
      const literal = extractLiteral("5u32");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(false);
    });
  });

  describe("isZero - suffixed hex literals", () => {
    it("should return true for suffixed hex zero (0x0u8)", () => {
      const literal = extractLiteral("0x0u8");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(true);
    });

    it("should return true for uppercase suffixed hex zero (0X0i32)", () => {
      const literal = extractLiteral("0X0i32");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(true);
    });

    it("should return false for suffixed non-zero hex (0xFFu8)", () => {
      const literal = extractLiteral("0xFFu8");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(false);
    });
  });

  describe("isZero - suffixed binary literals", () => {
    it("should return true for suffixed binary zero (0b0u8)", () => {
      const literal = extractLiteral("0b0u8");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(true);
    });

    it("should return true for uppercase suffixed binary zero (0B0i16)", () => {
      const literal = extractLiteral("0B0i16");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(true);
    });

    it("should return false for suffixed non-zero binary (0b1u8)", () => {
      const literal = extractLiteral("0b1u8");
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZero(literal!)).toBe(false);
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
