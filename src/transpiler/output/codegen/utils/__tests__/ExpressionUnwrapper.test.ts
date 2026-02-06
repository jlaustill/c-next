/**
 * Unit tests for ExpressionUnwrapper utility
 */

import { describe, it, expect } from "vitest";
import ExpressionUnwrapper from "../ExpressionUnwrapper";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser";
import * as Parser from "../../../../logic/parser/grammar/CNextParser";

/**
 * Helper to parse a simple expression and get its ExpressionContext
 */
function parseExpression(exprSource: string): Parser.ExpressionContext {
  // Wrap in a variable declaration in main() to get a complete program
  const source = `void main() { u32 x <- ${exprSource}; }`;
  const { tree, errors } = CNextSourceParser.parse(source);

  if (errors.length > 0) {
    throw new Error(`Parse failed: ${errors.map((e) => e.message).join(", ")}`);
  }

  // Navigate to the expression in the AST
  // Find main function
  for (const decl of tree.declaration()) {
    if (decl.functionDeclaration()) {
      const funcDecl = decl.functionDeclaration()!;
      if (funcDecl.IDENTIFIER().getText() === "main") {
        const block = funcDecl.block();
        if (block && block.statement().length > 0) {
          const stmt = block.statement()[0];
          const varDecl = stmt.variableDeclaration();
          if (varDecl?.expression()) {
            return varDecl.expression()!;
          }
        }
      }
    }
  }

  throw new Error("Could not find expression in parsed tree");
}

describe("ExpressionUnwrapper", () => {
  describe("getPostfixExpression", () => {
    it("should extract postfix from simple identifier", () => {
      const expr = parseExpression("myVar");
      const postfix = ExpressionUnwrapper.getPostfixExpression(expr);

      expect(postfix).not.toBeNull();
      expect(postfix?.primaryExpression().IDENTIFIER()?.getText()).toBe(
        "myVar",
      );
    });

    it("should extract postfix from numeric literal", () => {
      const expr = parseExpression("42");
      const postfix = ExpressionUnwrapper.getPostfixExpression(expr);

      expect(postfix).not.toBeNull();
      expect(postfix?.primaryExpression().literal()).not.toBeNull();
    });

    it("should return null for binary operation (addition)", () => {
      const expr = parseExpression("a + b");
      const postfix = ExpressionUnwrapper.getPostfixExpression(expr);

      expect(postfix).toBeNull();
    });

    it("should return null for binary operation (comparison)", () => {
      const expr = parseExpression("a > b");
      const postfix = ExpressionUnwrapper.getPostfixExpression(expr);

      expect(postfix).toBeNull();
    });

    it("should return null for logical OR", () => {
      const expr = parseExpression("a || b");
      const postfix = ExpressionUnwrapper.getPostfixExpression(expr);

      expect(postfix).toBeNull();
    });

    it("should extract postfix from member access", () => {
      const expr = parseExpression("obj.field");
      const postfix = ExpressionUnwrapper.getPostfixExpression(expr);

      expect(postfix).not.toBeNull();
      // Has postfix operations
      expect(postfix?.postfixOp().length).toBeGreaterThan(0);
    });

    it("should extract postfix from array indexing", () => {
      const expr = parseExpression("arr[0]");
      const postfix = ExpressionUnwrapper.getPostfixExpression(expr);

      expect(postfix).not.toBeNull();
      expect(postfix?.postfixOp().length).toBeGreaterThan(0);
    });
  });

  describe("getSimpleIdentifier", () => {
    it("should return identifier name for simple variable", () => {
      const expr = parseExpression("myVar");
      const name = ExpressionUnwrapper.getSimpleIdentifier(expr);

      expect(name).toBe("myVar");
    });

    it("should return null for member access", () => {
      const expr = parseExpression("obj.field");
      const name = ExpressionUnwrapper.getSimpleIdentifier(expr);

      expect(name).toBeNull();
    });

    it("should return null for array indexing", () => {
      const expr = parseExpression("arr[0]");
      const name = ExpressionUnwrapper.getSimpleIdentifier(expr);

      expect(name).toBeNull();
    });

    it("should return null for numeric literal", () => {
      const expr = parseExpression("42");
      const name = ExpressionUnwrapper.getSimpleIdentifier(expr);

      expect(name).toBeNull();
    });

    it("should return null for binary expression", () => {
      const expr = parseExpression("a + b");
      const name = ExpressionUnwrapper.getSimpleIdentifier(expr);

      expect(name).toBeNull();
    });
  });

  describe("isSimpleIdentifier", () => {
    it("should return true for simple identifier", () => {
      const expr = parseExpression("myVar");
      expect(ExpressionUnwrapper.isSimpleIdentifier(expr)).toBe(true);
    });

    it("should return false for complex expression", () => {
      const expr = parseExpression("obj.field");
      expect(ExpressionUnwrapper.isSimpleIdentifier(expr)).toBe(false);
    });
  });

  describe("getUnaryExpression", () => {
    it("should extract unary from simple expression", () => {
      const expr = parseExpression("myVar");
      const unary = ExpressionUnwrapper.getUnaryExpression(expr);

      expect(unary).not.toBeNull();
    });

    it("should return null for binary expression", () => {
      const expr = parseExpression("a + b");
      const unary = ExpressionUnwrapper.getUnaryExpression(expr);

      expect(unary).toBeNull();
    });
  });

  describe("getAdditiveExpression", () => {
    it("should extract additive from simple expression", () => {
      const expr = parseExpression("myVar");
      const additive = ExpressionUnwrapper.getAdditiveExpression(expr);

      expect(additive).not.toBeNull();
    });

    it("should return null for comparison expression", () => {
      const expr = parseExpression("a > b");
      const additive = ExpressionUnwrapper.getAdditiveExpression(expr);

      expect(additive).toBeNull();
    });
  });
});
