/**
 * Unit tests for ArrayInitializerUtils.
 * Issue #636: Ensure consistent array size inference from initializers.
 */

import { describe, it, expect } from "vitest";
import CNextSourceParser from "../../../../parser/CNextSourceParser";
import ArrayInitializerUtils from "../ArrayInitializerUtils";
import * as Parser from "../../../../parser/grammar/CNextParser";

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

    it("returns null when expression is not an array initializer", () => {
      const expr = getVariableExpression("u8 x <- 42;");
      expect(expr).not.toBeNull();
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).toBeNull();
    });

    it("returns null for identifier expression", () => {
      const expr = getVariableExpression("u8 x <- other;");
      expect(expr).not.toBeNull();
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).toBeNull();
    });

    it("returns null for arithmetic expression", () => {
      const expr = getVariableExpression("u8 x <- 1 + 2;");
      expect(expr).not.toBeNull();
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).toBeNull();
    });

    it("returns null for logical expression", () => {
      const expr = getVariableExpression("bool x <- true && false;");
      expect(expr).not.toBeNull();
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).toBeNull();
    });

    it("returns null for comparison expression", () => {
      const expr = getVariableExpression("bool x <- 1 < 2;");
      expect(expr).not.toBeNull();
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).toBeNull();
    });

    it("returns null for bitwise expression", () => {
      const expr = getVariableExpression("u8 x <- 0xFF & 0x0F;");
      expect(expr).not.toBeNull();
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).toBeNull();
    });

    it("returns null for shift expression", () => {
      const expr = getVariableExpression("u8 x <- 1 << 2;");
      expect(expr).not.toBeNull();
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).toBeNull();
    });

    it("returns null for unary expression", () => {
      const expr = getVariableExpression("bool x <- !true;");
      expect(expr).not.toBeNull();
      const arrayInit = ArrayInitializerUtils.findArrayInitializer(expr!);
      expect(arrayInit).toBeNull();
    });

    it("returns null for string literal", () => {
      const expr = getVariableExpression('string<10> s <- "hello";');
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
    it("returns element count for list initializer", () => {
      const expr = getVariableExpression("u8 arr[] <- [10, 20, 30];");
      const size = ArrayInitializerUtils.getInferredSize(expr!);
      expect(size).toBe(3);
    });

    it("returns 1 for single element array", () => {
      const expr = getVariableExpression("u8 arr[] <- [42];");
      const size = ArrayInitializerUtils.getInferredSize(expr!);
      expect(size).toBe(1);
    });

    it("returns undefined for fill-all syntax", () => {
      const expr = getVariableExpression("u8 arr[5] <- [0*];");
      const size = ArrayInitializerUtils.getInferredSize(expr!);
      expect(size).toBeUndefined();
    });

    it("returns undefined for non-array expression", () => {
      const expr = getVariableExpression("u8 x <- 42;");
      const size = ArrayInitializerUtils.getInferredSize(expr!);
      expect(size).toBeUndefined();
    });

    it("returns undefined for arithmetic expression", () => {
      const expr = getVariableExpression("u8 x <- 1 + 2 + 3;");
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

    it("handles nested array and returns outer dimension", () => {
      const expr = getVariableExpression("u8 arr[][] <- [[1, 2], [3, 4]];");
      const size = ArrayInitializerUtils.getInferredSize(expr!);
      expect(size).toBe(2);
    });
  });
});
