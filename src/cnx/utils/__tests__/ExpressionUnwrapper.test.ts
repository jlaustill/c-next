/**
 * Unit tests for ExpressionUnwrapper utility
 */

import { describe, it, expect } from "vitest";
import ExpressionUnwrapper from "../ExpressionUnwrapper";
import CNextSourceParser from "../../PARSE/2-Parse/CNextSourceParser";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";

/**
 * Helper to parse a simple expression and get its ExpressionContext
 */
function parseExpression(exprSource: string): Parser.ExpressionContext {
  // Wrap in a variable declaration in main() to get a complete program
  const source = `void main() { u32 x <- ${exprSource}; }`;
  const { tree, parseErrors: errors } = CNextSourceParser.parse(source);

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

    it.each([
      ["should return null for binary operation (addition)", "a + b"],
      ["should return null for binary operation (comparison)", "a > b"],
      ["should return null for logical OR", "a || b"],
    ])("%s", (_label, source) => {
      const expr = parseExpression(source);
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

  describe("bracketedInner", () => {
    /** The relational a condition leaf is: the single one under `source`. */
    const leaf = (source: string): Parser.RelationalExpressionContext =>
      parseExpression(source)
        .ternaryExpression()
        .orExpression(0)!
        .andExpression(0)!
        .equalityExpression(0)!
        .relationalExpression(0)!;

    it("returns what a bare group holds", () => {
      expect(
        ExpressionUnwrapper.bracketedInner(leaf("(a > b)"))?.getText(),
      ).toBe("a>b");
    });

    it("unwraps one group per call", () => {
      // The caller recurses, so `((a > b))` is decided by the same check.
      expect(
        ExpressionUnwrapper.bracketedInner(leaf("((a > b))"))?.getText(),
      ).toBe("(a>b)");
    });

    // Every shape a guard declines, with the group FIRST: an operand that has
    // no group at all is declined at the last step whether or not the guard
    // exists, so it would prove nothing about the guard.
    it.each([
      ["no group (control for the last step)", "a"],
      ["a relational operator", "(a) < b"],
      ["`|` outside the group", "(a > b) | 1"],
      ["`^` outside the group", "(a > b) ^ 1"],
      ["`&` outside the group", "(a > b) & 1"],
      ["`<<` outside the group", "(a > b) << 1"],
      ["`+` outside the group", "(a > b) + 1"],
      ["`*` outside the group", "(a > b) * 2"],
      ["a prefix", "!(a > b)"],
      ["a postfix", "(a > b)[0]"],
    ])("returns null for %s: %s", (_label, source) => {
      expect(ExpressionUnwrapper.bracketedInner(leaf(source))).toBeNull();
    });
  });
});
