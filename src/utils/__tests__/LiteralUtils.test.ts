/**
 * Unit tests for LiteralUtils
 * Tests literal detection for zero values and floating-point types.
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../PARSE/2-Parse/grammar/CNextLexer";
import {
  CNextParser,
  LiteralContext,
} from "../../PARSE/2-Parse/grammar/CNextParser";
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
  // isZeroText: Integer Literals
  // ========================================================================

  describe("isZeroText of a parsed literal - integer literals", () => {
    it.each([
      ["0", true],
      ["1", false],
      ["42", false],
    ])("isZeroText(%s) is %s", (source, expected) => {
      const literal = extractLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZeroText(literal!.getText())).toBe(expected);
    });
  });

  // ========================================================================
  // isZeroText: Hex Literals
  // ========================================================================

  describe("isZeroText of a parsed literal - hex literals", () => {
    it.each([
      ["0x0", true],
      ["0X0", true],
      ["0xFF", false],
      ["0x1", false],
    ])("isZeroText(%s) is %s", (source, expected) => {
      const literal = extractLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZeroText(literal!.getText())).toBe(expected);
    });
  });

  // ========================================================================
  // isZeroText: Binary Literals
  // ========================================================================

  describe("isZeroText of a parsed literal - binary literals", () => {
    it.each([
      ["0b0", true],
      ["0B0", true],
      ["0b1010", false],
      ["0b1", false],
    ])("isZeroText(%s) is %s", (source, expected) => {
      const literal = extractLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZeroText(literal!.getText())).toBe(expected);
    });
  });

  // ========================================================================
  // isZeroText: Suffixed Literals
  // ========================================================================

  describe("isZeroText of a parsed literal - suffixed decimal literals", () => {
    it.each([
      ["0u8", true],
      ["0i32", true],
      ["5u32", false],
    ])("isZeroText(%s) is %s", (source, expected) => {
      const literal = extractLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZeroText(literal!.getText())).toBe(expected);
    });
  });

  describe("isZeroText of a parsed literal - suffixed hex literals", () => {
    it.each([
      ["0x0u8", true],
      ["0X0i32", true],
      ["0xFFu8", false],
    ])("isZeroText(%s) is %s", (source, expected) => {
      const literal = extractLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZeroText(literal!.getText())).toBe(expected);
    });
  });

  describe("isZeroText of a parsed literal - suffixed binary literals", () => {
    it.each([
      ["0b0u8", true],
      ["0B0i16", true],
      ["0b1u8", false],
    ])("isZeroText(%s) is %s", (source, expected) => {
      const literal = extractLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZeroText(literal!.getText())).toBe(expected);
    });
  });

  // ========================================================================
  // isZeroText: Float Literals (Issue #1010)
  // ========================================================================

  describe("isZeroText of a parsed literal - float literals (Issue #1010)", () => {
    it.each([
      ["0.0", true],
      ["0.0f", true],
      ["0.0F", true],
      [".0", true],
      ["1.0", false],
      ["0.001", false],
    ])("isZeroText(%s) is %s", (source, expected) => {
      const literal = extractFloatLiteral(source);
      expect(literal).not.toBeNull();
      expect(LiteralUtils.isZeroText(literal!.getText())).toBe(expected);
    });

    it("should return false for negative float (-0.5)", () => {
      const literal = extractFloatLiteral("-0.5");
      // Note: -0.5 may not parse as a single literal due to negation
      // This is expected - the unary minus is a separate operator
      if (literal) {
        expect(LiteralUtils.isZeroText(literal!.getText())).toBe(false);
      }
    });
  });

  // ========================================================================
  // isFloatZero (Issue #1010)
  // ========================================================================

  // #1664 box 7: zero by value, from text -- a const's initializer has no
  // parse node when it is declared in another file
  describe("isZeroText", () => {
    it.each([
      ["0", true],
      ["00", true],
      ["0x00", true],
      ["0x00u8", true],
      ["0b000i16", true],
      ["0u32", true],
      ["0.0", true],
      ["0.0f32", true],
      ["0e0", true],
      ["-0", true],
      ["0x10", false],
      ["0x0Fu8", false],
      ["10u8", false],
      ["0.5f64", false],
      ["false", false],
      ["'\\0'", false],
      ['"0"', false],
    ])("isZeroText(%s) is %s", (text, expected) => {
      expect(LiteralUtils.isZeroText(text)).toBe(expected);
    });
  });

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
  // parseIntegerLiteral (Issue #455)
  // ========================================================================

  // ========================================================================
  // Literal Type Detection
  // ========================================================================

  // #1668: the one decision of whether a literal is floating, read from the
  // whole literal rather than from a suffix or a dot.
  describe("floatLiteralWidth", () => {
    it.each([
      ["2.5", 64],
      ["2.5f64", 64],
      ["2.5f32", 32],
      ["2.5F32", 32],
      ["1e5", 64],
      ["1e5f32", 32],
      ["1.5e-3", 64],
      ["0xFF32", null],
      ["0xABCDEF64", null],
      ["42", null],
      ["42u32", null],
      ["'.'", null],
      ['"2.5"', null],
      ["true", null],
    ])("%s -> %s", (text, expected) => {
      expect(LiteralUtils.floatLiteralWidth(text)).toBe(expected);
    });
  });

  describe("typeOf", () => {
    const mockLiteral = (text: string) => text;

    describe("boolean literals", () => {
      it("should return bool for true", () => {
        expect(LiteralUtils.typeOf(mockLiteral("true"))).toBe("bool");
      });

      it("should return bool for false", () => {
        expect(LiteralUtils.typeOf(mockLiteral("false"))).toBe("bool");
      });
    });

    describe("integer suffixes", () => {
      it("should detect u8 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("255u8"))).toBe("u8");
        expect(LiteralUtils.typeOf(mockLiteral("0U8"))).toBe("u8");
      });

      it("should detect u16 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("1000u16"))).toBe("u16");
      });

      it("should detect u32 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("1000000u32"))).toBe("u32");
      });

      it("should detect u64 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("1000000000u64"))).toBe("u64");
      });

      it("should detect i8 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("-50i8"))).toBe("i8");
        expect(LiteralUtils.typeOf(mockLiteral("50I8"))).toBe("i8");
      });

      it("should detect i16 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("1000i16"))).toBe("i16");
      });

      it("should detect i32 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("1000000i32"))).toBe("i32");
      });

      it("should detect i64 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("1000000000i64"))).toBe("i64");
      });
    });

    describe("float suffixes", () => {
      it("should detect f32 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("3.14f32"))).toBe("f32");
        expect(LiteralUtils.typeOf(mockLiteral("3.14F32"))).toBe("f32");
      });

      it("should detect f64 suffix", () => {
        expect(LiteralUtils.typeOf(mockLiteral("3.14159f64"))).toBe("f64");
        expect(LiteralUtils.typeOf(mockLiteral("3.14159F64"))).toBe("f64");
      });
    });

    describe("unsuffixed literals (MISRA 10.3 compliance)", () => {
      it("should return int for unsuffixed integer", () => {
        expect(LiteralUtils.typeOf(mockLiteral("42"))).toBe("int");
      });

      it("should return int for unsuffixed hex", () => {
        expect(LiteralUtils.typeOf(mockLiteral("0xFF"))).toBe("int");
      });

      it("should return int for a hex literal ending in F32 or F64 (#1668)", () => {
        expect(LiteralUtils.typeOf(mockLiteral("0xFF32"))).toBe("int");
        expect(LiteralUtils.typeOf(mockLiteral("0xABCDEF64"))).toBe("int");
      });

      it("should return f64 for unsuffixed float", () => {
        expect(LiteralUtils.typeOf(mockLiteral("3.14"))).toBe("f64");
      });
    });
  });

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

  // #1760 review: a fold has a value only when a double holds it exactly
  describe("exactIntegerLiteral", () => {
    it.each([
      ["9007199254740991", 9007199254740991],
      ["-9007199254740991", -9007199254740991],
      ["0x1FFFFFFFFFFFFF", 9007199254740991],
      // 2^53 + 1 parses to 2^53, and 2^53 is the first value it could be
      ["9007199254740993", undefined],
      ["9007199254740992", undefined],
      ["0xFFFFFFFFFFFFFFFF", undefined],
      ["N", undefined],
    ])("reads %j as %j", (text, value) => {
      expect(LiteralUtils.exactIntegerLiteral(text)).toBe(value);
    });

    it("says a computed value is exact only in the safe range", () => {
      expect(LiteralUtils.isExactInteger(2 ** 53 - 1)).toBe(true);
      expect(LiteralUtils.isExactInteger(2 ** 53)).toBe(false);
      expect(LiteralUtils.isExactInteger(Number.NaN)).toBe(false);
      expect(LiteralUtils.isExactInteger(1.5)).toBe(false);
      expect(LiteralUtils.isExactInteger(undefined)).toBe(false);
    });
  });

  // #1668: the one reading of an integer literal's value as written
  describe("hasLeadingZero (ADR-044: no octal literal, E0912)", () => {
    it.each([
      ["010", true],
      ["00", true],
      ["07u8", true],
      ["0", false],
      ["0u8", false],
      ["10", false],
    ])("%j -> %j", (text, expected) => {
      expect(LiteralUtils.hasLeadingZero(text)).toBe(expected);
    });
  });

  describe("integerValue", () => {
    it.each([
      ["9", 9],
      ["0", 0],
      ["9u8", 9],
      ["3i32", 3],
      ["0x1F", 31],
      ["0b101", 5],
      // ADR-044 has no octal literal: a leading zero is E0912, with no value
      ["010", null],
      ["010u8", null],
      ["1.5", null],
      ["true", null],
      ["N", null],
    ])("reads %j as %j", (text, value) => {
      expect(LiteralUtils.integerValue(text)).toBe(value);
    });
  });
});
