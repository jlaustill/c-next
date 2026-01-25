/**
 * Unit tests for ExpressionUtils
 * Tests expression tree traversal utilities.
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../parser/grammar/CNextLexer";
import { CNextParser, ExpressionContext } from "../parser/grammar/CNextParser";
import ExpressionUtils from "./ExpressionUtils";

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
});
