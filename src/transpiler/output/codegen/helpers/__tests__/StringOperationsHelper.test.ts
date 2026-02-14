/**
 * Unit tests for StringOperationsHelper
 *
 * Tests string operation detection and extraction.
 */

import { describe, it, expect, beforeEach } from "vitest";
import StringOperationsHelper from "../StringOperationsHelper.js";
import CodeGenState from "../../../../state/CodeGenState.js";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser.js";
import * as Parser from "../../../../logic/parser/grammar/CNextParser.js";

/**
 * Helper to parse an expression from source code.
 */
function parseExpression(source: string): Parser.ExpressionContext {
  // Wrap expression in a variable declaration to get valid syntax
  const fullSource = `u8 x <- ${source};`;
  const result = CNextSourceParser.parse(fullSource);
  const decl = result.tree.declaration(0);
  const varDecl = decl?.variableDeclaration();
  const expr = varDecl?.expression();
  if (!expr) {
    throw new Error(`Failed to parse expression from: ${source}`);
  }
  return expr;
}

describe("StringOperationsHelper", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  // ========================================================================
  // getStringExprCapacity
  // ========================================================================

  describe("getStringExprCapacity", () => {
    it("returns literal length for string literal", () => {
      const capacity = StringOperationsHelper.getStringExprCapacity('"hello"');
      expect(capacity).toBe(5);
    });

    it("returns literal length for empty string", () => {
      const capacity = StringOperationsHelper.getStringExprCapacity('""');
      expect(capacity).toBe(0);
    });

    it("returns null for non-string expression", () => {
      const capacity = StringOperationsHelper.getStringExprCapacity("123");
      expect(capacity).toBeNull();
    });

    it("returns capacity from type registry for string variable", () => {
      CodeGenState.setVariableTypeInfo("myStr", {
        baseType: "char",
        bitWidth: 8,
        isArray: true,
        arrayDimensions: [33],
        isConst: false,
        isString: true,
        stringCapacity: 32,
      });

      const capacity = StringOperationsHelper.getStringExprCapacity("myStr");
      expect(capacity).toBe(32);
    });

    it("returns null for non-string variable", () => {
      CodeGenState.setVariableTypeInfo("myInt", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        arrayDimensions: [],
        isConst: false,
      });

      const capacity = StringOperationsHelper.getStringExprCapacity("myInt");
      expect(capacity).toBeNull();
    });

    it("returns null for unknown variable", () => {
      const capacity =
        StringOperationsHelper.getStringExprCapacity("unknownVar");
      expect(capacity).toBeNull();
    });

    it("returns null for complex expression", () => {
      const capacity = StringOperationsHelper.getStringExprCapacity("a + b");
      expect(capacity).toBeNull();
    });
  });

  // ========================================================================
  // getStringConcatOperands
  // ========================================================================

  describe("getStringConcatOperands", () => {
    beforeEach(() => {
      // Set up string variables for concatenation tests
      CodeGenState.setVariableTypeInfo("str1", {
        baseType: "char",
        bitWidth: 8,
        isArray: true,
        arrayDimensions: [33],
        isConst: false,
        isString: true,
        stringCapacity: 32,
      });
      CodeGenState.setVariableTypeInfo("str2", {
        baseType: "char",
        bitWidth: 8,
        isArray: true,
        arrayDimensions: [17],
        isConst: false,
        isString: true,
        stringCapacity: 16,
      });
    });

    it("returns operands for string variable concatenation", () => {
      const expr = parseExpression("str1 + str2");
      const result = StringOperationsHelper.getStringConcatOperands(expr);

      expect(result).not.toBeNull();
      expect(result!.left).toBe("str1");
      expect(result!.right).toBe("str2");
      expect(result!.leftCapacity).toBe(32);
      expect(result!.rightCapacity).toBe(16);
    });

    it("returns operands for string literal concatenation", () => {
      const expr = parseExpression('"hello" + "world"');
      const result = StringOperationsHelper.getStringConcatOperands(expr);

      expect(result).not.toBeNull();
      expect(result!.left).toBe('"hello"');
      expect(result!.right).toBe('"world"');
      expect(result!.leftCapacity).toBe(5);
      expect(result!.rightCapacity).toBe(5);
    });

    it("returns null for integer addition", () => {
      const expr = parseExpression("1 + 2");
      const result = StringOperationsHelper.getStringConcatOperands(expr);
      expect(result).toBeNull();
    });

    it("returns null for subtraction", () => {
      const expr = parseExpression("str1 - str2");
      const result = StringOperationsHelper.getStringConcatOperands(expr);
      expect(result).toBeNull();
    });

    it("returns null for mixed string/non-string", () => {
      const expr = parseExpression("str1 + 5");
      const result = StringOperationsHelper.getStringConcatOperands(expr);
      expect(result).toBeNull();
    });

    it("returns null for more than 2 operands", () => {
      // This expression has 3 operands at the additive level
      const expr = parseExpression("str1 + str2 + str1");
      const result = StringOperationsHelper.getStringConcatOperands(expr);
      // With 3 operands, it should return null (simple concat only)
      expect(result).toBeNull();
    });

    it("handles string literal containing hyphen correctly", () => {
      // Regression test: ensure hyphen in string literal doesn't
      // falsely trigger subtraction detection
      const expr = parseExpression('str1 + "hello-world"');
      const result = StringOperationsHelper.getStringConcatOperands(expr);

      expect(result).not.toBeNull();
      expect(result!.left).toBe("str1");
      expect(result!.right).toBe('"hello-world"');
      expect(result!.leftCapacity).toBe(32);
      expect(result!.rightCapacity).toBe(11); // "hello-world" is 11 chars
    });
  });

  // ========================================================================
  // getSubstringOperands
  // ========================================================================

  describe("getSubstringOperands", () => {
    beforeEach(() => {
      CodeGenState.setVariableTypeInfo("myStr", {
        baseType: "char",
        bitWidth: 8,
        isArray: true,
        arrayDimensions: [65],
        isConst: false,
        isString: true,
        stringCapacity: 64,
      });
    });

    it("returns operands for substring [start, length] pattern", () => {
      const expr = parseExpression("myStr[0, 5]");
      const result = StringOperationsHelper.getSubstringOperands(expr, {
        generateExpression: (ctx) => ctx.getText(),
      });

      expect(result).not.toBeNull();
      expect(result!.source).toBe("myStr");
      expect(result!.start).toBe("0");
      expect(result!.length).toBe("5");
      expect(result!.sourceCapacity).toBe(64);
    });

    it("returns operands for single-char access [index] pattern", () => {
      const expr = parseExpression("myStr[3]");
      const result = StringOperationsHelper.getSubstringOperands(expr, {
        generateExpression: (ctx) => ctx.getText(),
      });

      expect(result).not.toBeNull();
      expect(result!.source).toBe("myStr");
      expect(result!.start).toBe("3");
      expect(result!.length).toBe("1");
      expect(result!.sourceCapacity).toBe(64);
    });

    it("returns null for non-string variable", () => {
      CodeGenState.setVariableTypeInfo("myArray", {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        arrayDimensions: [10],
        isConst: false,
      });

      const expr = parseExpression("myArray[0, 5]");
      const result = StringOperationsHelper.getSubstringOperands(expr, {
        generateExpression: (ctx) => ctx.getText(),
      });
      expect(result).toBeNull();
    });

    it("returns null for unknown variable", () => {
      const expr = parseExpression("unknown[0, 5]");
      const result = StringOperationsHelper.getSubstringOperands(expr, {
        generateExpression: (ctx) => ctx.getText(),
      });
      expect(result).toBeNull();
    });

    it("returns null for function call expression", () => {
      const expr = parseExpression("getStr()[0, 5]");
      const result = StringOperationsHelper.getSubstringOperands(expr, {
        generateExpression: (ctx) => ctx.getText(),
      });
      expect(result).toBeNull();
    });

    it("uses callback to generate expression code", () => {
      const expr = parseExpression("myStr[idx, len]");
      const result = StringOperationsHelper.getSubstringOperands(expr, {
        generateExpression: (ctx) => `generated_${ctx.getText()}`,
      });

      expect(result).not.toBeNull();
      expect(result!.start).toBe("generated_idx");
      expect(result!.length).toBe("generated_len");
    });
  });
});
