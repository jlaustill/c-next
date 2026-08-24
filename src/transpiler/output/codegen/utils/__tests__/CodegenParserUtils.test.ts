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

    it.each([
      ["returns null for member access", "obj.field"],
      ["returns null for array access", "arr[0]"],
      ["returns null for binary expression", "a + b"],
      ["returns null for function call", "foo()"],
      ["returns null for literal", "42"],
    ])("%s", (_label, source) => {
      const expr = parseExpression(source);
      expect(CodegenParserUtils.getSimpleIdentifier(expr)).toBeNull();
    });
  });

  describe("isMainFunctionWithArgs", () => {
    it.each([
      [
        "returns true for main with string args[]",
        "void main(string args[]) {}",
      ],
      ["returns true for main with u8 args[][]", "void main(u8 args[][]) {}"],
      ["returns true for main with i8 args[][]", "void main(i8 args[][]) {}"],
    ])("%s", (_label, source) => {
      const { name, paramList } = parseFunctionDeclaration(source);
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

    it.each([
      ["returns false for non-main function", "void foo(string args[]) {}"],
      [
        "returns false for main with wrong parameter type",
        "void main(u32 count) {}",
      ],
      [
        "returns false for main with multiple parameters",
        "void main(string args[], u32 count) {}",
      ],
    ])("%s", (_label, source) => {
      const { name, paramList } = parseFunctionDeclaration(source);
      expect(CodegenParserUtils.isMainFunctionWithArgs(name, paramList)).toBe(
        false,
      );
    });
  });
});
