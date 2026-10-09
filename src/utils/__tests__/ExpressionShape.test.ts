/**
 * Unit tests for ExpressionShape: shape questions over a lowered expression.
 */
import { describe, it, expect } from "vitest";
import ExpressionShape from "../ExpressionShape";
import CNextSourceParser from "../../PARSE/2-Parse/CNextSourceParser";
import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";

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

const lowered = (source: string) =>
  SyntaxLowering.expression(parseExpression(source));

describe("ExpressionShape", () => {
  describe("simpleIdentifier", () => {
    it("should return identifier name for simple variable", () => {
      expect(ExpressionShape.simpleIdentifier(lowered("myVar"))).toBe("myVar");
    });

    it.each([
      ["should return null for member access", "obj.field"],
      ["should return null for array indexing", "arr[0]"],
      ["should return null for numeric literal", "42"],
      ["should return null for binary expression", "a + b"],
      // #1445: carried over from CodegenParserUtils' duplicate of this
      // function when that copy was deleted.
      ["should return null for function call", "foo()"],
      ["should return null for a parenthesized name", "(myVar)"],
      ["should return null for a negated name", "-myVar"],
      ["should return null for a this-rooted member", "this.myVar"],
    ])("%s", (_label, source) => {
      expect(ExpressionShape.simpleIdentifier(lowered(source))).toBeNull();
    });
  });

  describe("rootName", () => {
    it.each([
      ["myVar", "myVar"],
      ["obj.field", "obj"],
      ["grid[1][2]", "grid"],
      ["getStr()[0]", "getStr"],
      ["this.myVar", null],
      ["(a).b", null],
      ["a + b", null],
    ])("%s -> %s", (source, expected) => {
      expect(ExpressionShape.rootName(lowered(source))).toBe(expected);
    });
  });
});
