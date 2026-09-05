/**
 * Unit tests for ArrayInitializerUtils.
 * Issue #636: Ensure consistent array size inference from initializers.
 */

import { describe, it, expect } from "vitest";
import CNextSourceParser from "../../../../../transpiler/logic/parser/CNextSourceParser";
import ArrayInitializerUtils from "../ArrayInitializerUtils";
import * as Parser from "../../../../../transpiler/logic/parser/grammar/CNextParser";

describe("ArrayInitializerUtils", () => {
  function getVariableExpression(
    source: string,
  ): Parser.ExpressionContext | null {
    const result = CNextSourceParser.parse(source);
    const decl = result.tree.declaration(0);
    const varDecl = decl?.variableDeclaration();
    return varDecl?.expression() ?? null;
  }

  describe("findArrayInitializer", () => {
    it("finds array initializer in simple expression", () => {
      const expr = getVariableExpression("u8 arr[] <- [1, 2, 3];");
      expect(expr).not.toBeNull();
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).not.toBeNull();
    });

    it.each([
      [
        "returns null when expression is not an array initializer",
        "u8 x <- 42;",
      ],
      ["returns null for identifier expression", "u8 x <- other;"],
      ["returns null for arithmetic expression", "u8 x <- 1 + 2;"],
      ["returns null for logical expression", "bool x <- true && false;"],
      ["returns null for comparison expression", "bool x <- 1 < 2;"],
      ["returns null for bitwise expression", "u8 x <- 0xFF & 0x0F;"],
      ["returns null for shift expression", "u8 x <- 1 << 2;"],
      ["returns null for unary expression", "bool x <- !true;"],
      ["returns null for string literal", 'string<10> s <- "hello";'],
    ])("%s", (_label, source) => {
      const expr = getVariableExpression(source);
      expect(expr).not.toBeNull();
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).toBeNull();
    });
  });

  describe("countElements", () => {
    it("counts elements in list-style initializer", () => {
      const expr = getVariableExpression("u8 arr[] <- [1, 2, 3, 4, 5];");
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).not.toBeNull();
      const result = ArrayInitializerUtils.countElements(arrayInit!);
      expect(result.count).toBe(5);
      expect(result.isFillAll).toBe(false);
    });

    it("counts single element array", () => {
      const expr = getVariableExpression("u8 arr[] <- [42];");
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).not.toBeNull();
      const result = ArrayInitializerUtils.countElements(arrayInit!);
      expect(result.count).toBe(1);
      expect(result.isFillAll).toBe(false);
    });

    it("identifies fill-all syntax", () => {
      const expr = getVariableExpression("u8 arr[10] <- [0*];");
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).not.toBeNull();
      const result = ArrayInitializerUtils.countElements(arrayInit!);
      expect(result.isFillAll).toBe(true);
    });

    it("identifies fill-all with non-zero value", () => {
      const expr = getVariableExpression("u8 arr[5] <- [0xFF*];");
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).not.toBeNull();
      const result = ArrayInitializerUtils.countElements(arrayInit!);
      expect(result.isFillAll).toBe(true);
    });

    it("counts struct initializers in array", () => {
      const source = `
struct Point { i32 x; i32 y; }
Point points[] <- [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }];
`;
      const result = CNextSourceParser.parse(source);
      const decls = result.tree.declaration();
      const varDecl = decls[1].variableDeclaration();
      const expr = varDecl?.expression();
      expect(expr).not.toBeNull();
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).not.toBeNull();
      const elemResult = ArrayInitializerUtils.countElements(arrayInit!);
      expect(elemResult.count).toBe(3);
    });

    it("counts nested array initializers", () => {
      const expr = getVariableExpression(
        "u8 arr[][] <- [[1, 2], [3, 4], [5, 6]];",
      );
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).not.toBeNull();
      const result = ArrayInitializerUtils.countElements(arrayInit!);
      expect(result.count).toBe(3);
      expect(result.isFillAll).toBe(false);
    });
  });

  describe("getInferredSize", () => {
    it.each([
      ["element count for a list initializer", "u8 arr[] <- [10, 20, 30];", 3],
      ["1 for a single element array", "u8 arr[] <- [42];", 1],
      [
        "the outer dimension for a nested array",
        "u8 arr[][] <- [[1, 2], [3, 4]];",
        2,
      ],
    ])("returns %s", (_label, source, expected) => {
      const expr = getVariableExpression(source);
      expect(ArrayInitializerUtils.getInferredSize(expr!)).toBe(expected);
    });

    it.each([
      ["returns undefined for fill-all syntax", "u8 arr[5] <- [0*];"],
      ["returns undefined for non-array expression", "u8 x <- 42;"],
      ["returns undefined for arithmetic expression", "u8 x <- 1 + 2 + 3;"],
    ])("%s", (_label, source) => {
      const expr = getVariableExpression(source);
      const size = ArrayInitializerUtils.getInferredSize(expr!);
      expect(size).toBeUndefined();
    });

    it("handles const struct array initializer (issue #636)", () => {
      const source = `
struct TItem { u32 id; u16 value; }
const TItem ITEMS[] <- [{ id: 1, value: 100 }, { id: 2, value: 200 }, { id: 3, value: 300 }];
`;
      const result = CNextSourceParser.parse(source);
      const decls = result.tree.declaration();
      const varDecl = decls[1].variableDeclaration();
      const expr = varDecl?.expression();
      expect(expr).not.toBeNull();
      const size = ArrayInitializerUtils.getInferredSize(expr!);
      expect(size).toBe(3);
    });
  });
});
