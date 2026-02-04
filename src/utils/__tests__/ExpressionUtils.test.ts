/**
 * Unit tests for ExpressionUtils
 * Tests expression tree traversal utilities.
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../transpiler/logic/parser/grammar/CNextLexer";
import {
  CNextParser,
  ExpressionContext,
} from "../../transpiler/logic/parser/grammar/CNextParser";
import ExpressionUtils from "../ExpressionUtils";

/**
 * Helper to parse C-Next code and extract the expression from a variable declaration.
 * Parses: "void main() { u32 x <- <expression>; }"
 */
function extractExpression(exprText: string): ExpressionContext | null {
  const code = `void main() { u32 x <- ${exprText}; }`;
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

  return varDecl.expression() ?? null;
}

describe("ExpressionUtils", () => {
  // ========================================================================
  // extractLiteral
  // ========================================================================

  describe("extractLiteral", () => {
    it("should extract integer literal", () => {
      const expr = extractExpression("42");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).not.toBeNull();
      expect(literal!.getText()).toBe("42");
    });

    it("should extract zero literal", () => {
      const expr = extractExpression("0");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).not.toBeNull();
      expect(literal!.getText()).toBe("0");
    });

    it("should extract hex literal", () => {
      const expr = extractExpression("0xFF");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).not.toBeNull();
      expect(literal!.getText()).toBe("0xFF");
    });

    it("should extract binary literal", () => {
      const expr = extractExpression("0b1010");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).not.toBeNull();
      expect(literal!.getText()).toBe("0b1010");
    });

    it("should extract suffixed literal", () => {
      const expr = extractExpression("42u32");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).not.toBeNull();
      expect(literal!.getText()).toBe("42u32");
    });

    it("should return null for addition expression", () => {
      const expr = extractExpression("1 + 2");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).toBeNull();
    });

    it("should return null for subtraction expression", () => {
      const expr = extractExpression("5 - 3");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).toBeNull();
    });

    it("should return null for multiplication expression", () => {
      const expr = extractExpression("2 * 3");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).toBeNull();
    });

    it("should return null for division expression", () => {
      const expr = extractExpression("10 / 2");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).toBeNull();
    });

    it("should return null for identifier expression", () => {
      const expr = extractExpression("someVar");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).toBeNull();
    });

    it("should return null for comparison expression", () => {
      const expr = extractExpression("a < b");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).toBeNull();
    });

    it("should return null for logical OR expression", () => {
      const expr = extractExpression("a || b");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).toBeNull();
    });

    it("should return null for logical AND expression", () => {
      const expr = extractExpression("a && b");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).toBeNull();
    });

    it("should return null for bitwise OR expression", () => {
      const expr = extractExpression("a | b");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).toBeNull();
    });

    it("should return null for shift expression", () => {
      const expr = extractExpression("a << 2");
      expect(expr).not.toBeNull();

      const literal = ExpressionUtils.extractLiteral(expr!);
      expect(literal).toBeNull();
    });
  });

  // ========================================================================
  // extractPrimaryExpression
  // ========================================================================

  describe("extractPrimaryExpression", () => {
    it("should extract primary expression from literal", () => {
      const expr = extractExpression("42");
      expect(expr).not.toBeNull();

      const primary = ExpressionUtils.extractPrimaryExpression(expr!);
      expect(primary).not.toBeNull();
      expect(primary!.literal()).not.toBeNull();
    });

    it("should extract primary expression from identifier", () => {
      const expr = extractExpression("myVar");
      expect(expr).not.toBeNull();

      const primary = ExpressionUtils.extractPrimaryExpression(expr!);
      expect(primary).not.toBeNull();
      expect(primary!.IDENTIFIER()).not.toBeNull();
      expect(primary!.IDENTIFIER()!.getText()).toBe("myVar");
    });

    it("should return null for binary expression", () => {
      const expr = extractExpression("1 + 2");
      expect(expr).not.toBeNull();

      const primary = ExpressionUtils.extractPrimaryExpression(expr!);
      expect(primary).toBeNull();
    });

    it("should return null for function call", () => {
      const expr = extractExpression("foo()");
      expect(expr).not.toBeNull();

      const primary = ExpressionUtils.extractPrimaryExpression(expr!);
      // Function call has postfixOps, so should return null
      expect(primary).toBeNull();
    });

    it("should return null for array access", () => {
      const expr = extractExpression("arr[0]");
      expect(expr).not.toBeNull();

      const primary = ExpressionUtils.extractPrimaryExpression(expr!);
      // Array access has postfixOps, so should return null
      expect(primary).toBeNull();
    });

    it("should return null for member access", () => {
      const expr = extractExpression("obj.field");
      expect(expr).not.toBeNull();

      const primary = ExpressionUtils.extractPrimaryExpression(expr!);
      // Member access has postfixOps, so should return null
      expect(primary).toBeNull();
    });
  });

  // ========================================================================
  // extractUnaryExpression
  // ========================================================================

  describe("extractUnaryExpression", () => {
    it("should extract unary expression from simple literal", () => {
      const expr = extractExpression("42");
      expect(expr).not.toBeNull();

      const unary = ExpressionUtils.extractUnaryExpression(expr!);
      expect(unary).not.toBeNull();
    });

    it("should extract unary expression from identifier", () => {
      const expr = extractExpression("x");
      expect(expr).not.toBeNull();

      const unary = ExpressionUtils.extractUnaryExpression(expr!);
      expect(unary).not.toBeNull();
    });

    it("should return null for addition", () => {
      const expr = extractExpression("1 + 2");
      expect(expr).not.toBeNull();

      const unary = ExpressionUtils.extractUnaryExpression(expr!);
      expect(unary).toBeNull();
    });

    it("should return null for modulo", () => {
      const expr = extractExpression("10 % 3");
      expect(expr).not.toBeNull();

      const unary = ExpressionUtils.extractUnaryExpression(expr!);
      expect(unary).toBeNull();
    });
  });

  // ========================================================================
  // extractIdentifier
  // ========================================================================

  describe("extractIdentifier", () => {
    it("should extract identifier from simple expression", () => {
      const expr = extractExpression("myVariable");
      expect(expr).not.toBeNull();

      const identifier = ExpressionUtils.extractIdentifier(expr!);
      expect(identifier).toBe("myVariable");
    });

    it("should return null for literal expression", () => {
      const expr = extractExpression("42");
      expect(expr).not.toBeNull();

      const identifier = ExpressionUtils.extractIdentifier(expr!);
      expect(identifier).toBeNull();
    });

    it("should return null for binary expression with identifiers", () => {
      const expr = extractExpression("a + b");
      expect(expr).not.toBeNull();

      const identifier = ExpressionUtils.extractIdentifier(expr!);
      expect(identifier).toBeNull();
    });

    it("should return null for function call", () => {
      const expr = extractExpression("getValue()");
      expect(expr).not.toBeNull();

      const identifier = ExpressionUtils.extractIdentifier(expr!);
      expect(identifier).toBeNull();
    });

    it("should return null for member access", () => {
      const expr = extractExpression("obj.field");
      expect(expr).not.toBeNull();

      const identifier = ExpressionUtils.extractIdentifier(expr!);
      expect(identifier).toBeNull();
    });
  });

  // ========================================================================
  // hasFunctionCall (ADR-023: MISRA 13.5 function call detection)
  // ========================================================================

  describe("hasFunctionCall", () => {
    it("should detect simple function call", () => {
      const expr = extractExpression("getValue()");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should detect function call with arguments", () => {
      const expr = extractExpression("foo(1, 2, 3)");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should detect function call in addition", () => {
      const expr = extractExpression("a + getValue()");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should detect function call in subtraction", () => {
      const expr = extractExpression("getValue() - b");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should detect function call in multiplication", () => {
      const expr = extractExpression("a * compute()");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should detect function call in logical AND", () => {
      const expr = extractExpression("flag && isReady()");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should detect function call in logical OR", () => {
      const expr = extractExpression("check() || backup");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should detect function call in comparison", () => {
      const expr = extractExpression("getCount() < 10");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should detect function call in equality check", () => {
      const expr = extractExpression("status = getStatus()");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should detect function call in bitwise OR", () => {
      const expr = extractExpression("flags | getFlags()");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should detect function call in bitwise XOR", () => {
      const expr = extractExpression("mask ^ getMask()");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should detect function call in bitwise AND", () => {
      const expr = extractExpression("value & getMask()");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should detect function call in shift expression", () => {
      const expr = extractExpression("getBase() << 4");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(true);
    });

    it("should return false for simple literal", () => {
      const expr = extractExpression("42");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(false);
    });

    it("should return false for simple identifier", () => {
      const expr = extractExpression("myVar");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(false);
    });

    it("should return false for arithmetic without function calls", () => {
      const expr = extractExpression("a + b * c");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(false);
    });

    it("should return false for comparison without function calls", () => {
      const expr = extractExpression("a < b");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(false);
    });

    it("should return false for logical expression without function calls", () => {
      const expr = extractExpression("flag && ready");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(false);
    });

    it("should return false for array access", () => {
      const expr = extractExpression("arr[0]");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(false);
    });

    it("should return false for member access", () => {
      const expr = extractExpression("obj.field");
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(false);
    });
  });
});
