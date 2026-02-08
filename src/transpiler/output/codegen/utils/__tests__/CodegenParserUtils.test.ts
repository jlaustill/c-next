/**
 * Unit tests for CodegenParserUtils
 */

import { describe, expect, it } from "vitest";
import CodegenParserUtils from "../CodegenParserUtils";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser";
import * as Parser from "../../../../logic/parser/grammar/CNextParser";

/**
 * Helper to parse and get the expression from a variable declaration
 */
function parseExpression(exprSource: string): Parser.ExpressionContext {
  const source = `void main() { u32 x <- ${exprSource}; }`;
  const { tree, errors } = CNextSourceParser.parse(source);

  if (errors.length > 0) {
    throw new Error(`Parse failed: ${errors.map((e) => e.message).join(", ")}`);
  }

  // Navigate to the expression in the AST
  for (const decl of tree.declaration()) {
    const funcDecl = decl.functionDeclaration();
    if (funcDecl?.IDENTIFIER().getText() === "main") {
      const block = funcDecl.block();
      const stmt = block?.statement()[0];
      const varDecl = stmt?.variableDeclaration();
      const expr = varDecl?.expression();
      if (expr) return expr;
    }
  }

  throw new Error("Could not find expression in parsed tree");
}

/**
 * Helper to drill down to additive expression level
 * Follows the same pattern as ExpressionUnwrapper for navigating expression tree
 */
function getAdditiveFromExpr(
  expr: Parser.ExpressionContext,
): Parser.AdditiveExpressionContext | null {
  const ternary = expr.ternaryExpression();
  if (!ternary) return null;

  const orExprs = ternary.orExpression();
  if (orExprs.length !== 1) return null;

  const or = orExprs[0];
  const and = or.andExpression()[0];
  if (!and) return null;

  const eq = and.equalityExpression()[0];
  if (!eq) return null;

  const rel = eq.relationalExpression()[0];
  if (!rel) return null;

  const bor = rel.bitwiseOrExpression()[0];
  if (!bor) return null;

  const bxor = bor.bitwiseXorExpression()[0];
  if (!bxor) return null;

  const band = bxor.bitwiseAndExpression()[0];
  if (!band) return null;

  const shift = band.shiftExpression()[0];
  if (!shift) return null;

  return shift.additiveExpression()[0] ?? null;
}

/**
 * Helper to parse a function declaration and get its parameter list
 */
function parseFunctionDeclaration(source: string): {
  name: string;
  paramList: Parser.ParameterListContext | null;
} {
  const { tree, errors } = CNextSourceParser.parse(source);

  if (errors.length > 0) {
    throw new Error(`Parse failed: ${errors.map((e) => e.message).join(", ")}`);
  }

  for (const decl of tree.declaration()) {
    const funcDecl = decl.functionDeclaration();
    if (funcDecl) {
      return {
        name: funcDecl.IDENTIFIER().getText(),
        paramList: funcDecl.parameterList() ?? null,
      };
    }
  }

  throw new Error("Could not find function declaration in parsed tree");
}

describe("CodegenParserUtils", () => {
  describe("getOperatorsFromChildren", () => {
    it("extracts operators from additive expression", () => {
      const expr = parseExpression("1 + 2 - 3");
      const additive = getAdditiveFromExpr(expr);
      expect(additive).not.toBeNull();

      const operators = CodegenParserUtils.getOperatorsFromChildren(additive!);
      expect(operators).toEqual(["+", "-"]);
    });

    it("extracts operators from multiplicative expression", () => {
      const expr = parseExpression("2 * 3 / 4");
      const additive = getAdditiveFromExpr(expr);
      const mult = additive?.multiplicativeExpression(0);
      expect(mult).toBeDefined();

      const operators = CodegenParserUtils.getOperatorsFromChildren(mult!);
      expect(operators).toEqual(["*", "/"]);
    });

    it("returns empty array for expression with no operators", () => {
      // For a simple expression like "42", the additive expression has only one
      // multiplicative child (no operators between terms)
      const expr = parseExpression("42");
      const additive = getAdditiveFromExpr(expr);
      expect(additive).not.toBeNull();

      // Additive expression with single term has no terminal operators
      const operators = CodegenParserUtils.getOperatorsFromChildren(additive!);
      expect(operators).toEqual([]);
    });
  });

  describe("getSimpleIdentifier", () => {
    it("returns identifier for simple variable", () => {
      const expr = parseExpression("myVar");
      expect(CodegenParserUtils.getSimpleIdentifier(expr)).toBe("myVar");
    });

    it("returns null for member access", () => {
      const expr = parseExpression("obj.field");
      expect(CodegenParserUtils.getSimpleIdentifier(expr)).toBeNull();
    });

    it("returns null for array access", () => {
      const expr = parseExpression("arr[0]");
      expect(CodegenParserUtils.getSimpleIdentifier(expr)).toBeNull();
    });

    it("returns null for binary expression", () => {
      const expr = parseExpression("a + b");
      expect(CodegenParserUtils.getSimpleIdentifier(expr)).toBeNull();
    });

    it("returns null for function call", () => {
      const expr = parseExpression("foo()");
      expect(CodegenParserUtils.getSimpleIdentifier(expr)).toBeNull();
    });

    it("returns null for literal", () => {
      const expr = parseExpression("42");
      expect(CodegenParserUtils.getSimpleIdentifier(expr)).toBeNull();
    });
  });

  describe("isMainFunctionWithArgs", () => {
    it("returns true for main with string args[]", () => {
      const { name, paramList } = parseFunctionDeclaration(
        "void main(string args[]) {}",
      );
      expect(CodegenParserUtils.isMainFunctionWithArgs(name, paramList)).toBe(
        true,
      );
    });

    it("returns true for main with u8 args[][]", () => {
      const { name, paramList } = parseFunctionDeclaration(
        "void main(u8 args[][]) {}",
      );
      expect(CodegenParserUtils.isMainFunctionWithArgs(name, paramList)).toBe(
        true,
      );
    });

    it("returns true for main with i8 args[][]", () => {
      const { name, paramList } = parseFunctionDeclaration(
        "void main(i8 args[][]) {}",
      );
      expect(CodegenParserUtils.isMainFunctionWithArgs(name, paramList)).toBe(
        true,
      );
    });

    it("returns false for main with no parameters", () => {
      const { name, paramList } = parseFunctionDeclaration("void main() {}");
      expect(CodegenParserUtils.isMainFunctionWithArgs(name, paramList)).toBe(
        false,
      );
    });

    it("returns false for non-main function", () => {
      const { name, paramList } = parseFunctionDeclaration(
        "void foo(string args[]) {}",
      );
      expect(CodegenParserUtils.isMainFunctionWithArgs(name, paramList)).toBe(
        false,
      );
    });

    it("returns false for main with wrong parameter type", () => {
      const { name, paramList } = parseFunctionDeclaration(
        "void main(u32 count) {}",
      );
      expect(CodegenParserUtils.isMainFunctionWithArgs(name, paramList)).toBe(
        false,
      );
    });

    it("returns false for main with multiple parameters", () => {
      const { name, paramList } = parseFunctionDeclaration(
        "void main(string args[], u32 count) {}",
      );
      expect(CodegenParserUtils.isMainFunctionWithArgs(name, paramList)).toBe(
        false,
      );
    });
  });
});
