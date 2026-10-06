/**
 * Unit tests for ExpressionUtils
 * Tests expression tree traversal utilities.
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../PARSE/2-Parse/grammar/CNextLexer";
import {
  CNextParser,
  ExpressionContext,
} from "../../PARSE/2-Parse/grammar/CNextParser";
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

    it.each([
      ["should return null for function call", "foo()"],
      ["should return null for array access", "arr[0]"],
      ["should return null for member access", "obj.field"],
    ])("%s", (_label, expected) => {
      const expr = extractExpression(expected);
      expect(expr).not.toBeNull();

      const primary = ExpressionUtils.extractPrimaryExpression(expr!);

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

    it.each([
      ["should return null for literal expression", "42"],
      ["should return null for binary expression with identifiers", "a + b"],
      ["should return null for function call", "getValue()"],
      ["should return null for member access", "obj.field"],
    ])("%s", (_label, source) => {
      const expr = extractExpression(source);
      expect(expr).not.toBeNull();

      const identifier = ExpressionUtils.extractIdentifier(expr!);
      expect(identifier).toBeNull();
    });
  });

  // ========================================================================
  // hasFunctionCall (ADR-023: MISRA 13.5 function call detection)
  // ========================================================================

  describe("hasFunctionCall", () => {
    it.each([
      ["should detect simple function call", "getValue()", true],
      ["should detect function call with arguments", "foo(1, 2, 3)", true],
      ["should detect function call in addition", "a + getValue()", true],
      ["should detect function call in subtraction", "getValue() - b", true],
      ["should detect function call in multiplication", "a * compute()", true],
      ["should detect function call in logical AND", "flag && isReady()", true],
      ["should detect function call in logical OR", "check() || backup", true],
      ["should detect function call in comparison", "getCount() < 10", true],
      [
        "should detect function call in equality check",
        "status = getStatus()",
        true,
      ],
      ["should detect function call in bitwise OR", "flags | getFlags()", true],
      ["should detect function call in bitwise XOR", "mask ^ getMask()", true],
      ["should detect function call in bitwise AND", "value & getMask()", true],
      [
        "should detect function call in shift expression",
        "getBase() << 4",
        true,
      ],
      ["should return false for simple literal", "42", false],
      ["should return false for simple identifier", "myVar", false],
      [
        "should return false for arithmetic without function calls",
        "a + b * c",
        false,
      ],
      [
        "should return false for comparison without function calls",
        "a < b",
        false,
      ],
      [
        "should return false for logical expression without function calls",
        "flag && ready",
        false,
      ],
      ["should return false for array access", "arr[0]", false],
      ["should return false for member access", "obj.field", false],
    ])("%s", (_label, source, expected) => {
      const expr = extractExpression(source);
      expect(expr).not.toBeNull();

      const hasFn = ExpressionUtils.hasFunctionCall(expr!);
      expect(hasFn).toBe(expected);
    });
  });
});
