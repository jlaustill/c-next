/**
 * Unit tests for StringLengthCounter
 * Issue #644: strlen caching optimization
 */

import { describe, it, expect, beforeEach } from "vitest";
import StringLengthCounter from "../StringLengthCounter";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser";
import CodeGenState from "../../../../state/CodeGenState";

/**
 * Parse a C-Next expression and return the expression context.
 */
function parseExpression(source: string) {
  // Wrap expression in a function to make it valid C-Next
  const fullSource = `void test() { ${source}; }`;
  const result = CNextSourceParser.parse(fullSource);
  const funcDecl = result.tree.declaration(0)!.functionDeclaration()!;
  const block = funcDecl.block()!;
  const stmt = block.statement(0)!;
  return stmt.expressionStatement()!.expression();
}

/**
 * Parse a C-Next block and return the block context.
 */
function parseBlock(statements: string) {
  const fullSource = `void test() { ${statements} }`;
  const result = CNextSourceParser.parse(fullSource);
  const funcDecl = result.tree.declaration(0)!.functionDeclaration()!;
  return funcDecl.block()!;
}

describe("StringLengthCounter", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  describe("countExpression", () => {
    it("counts single .length access on string variable", () => {
      CodeGenState.setVariableTypeInfo("myStr", {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 64,
      });

      const expr = parseExpression("myStr.length");
      const counts = StringLengthCounter.countExpression(expr);

      expect(counts.get("myStr")).toBe(1);
    });

    it("counts multiple .length accesses on same variable", () => {
      CodeGenState.setVariableTypeInfo("str", {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 32,
      });

      // Expression: str.length + str.length
      const expr = parseExpression("str.length + str.length");
      const counts = StringLengthCounter.countExpression(expr);

      expect(counts.get("str")).toBe(2);
    });

    it("counts .length accesses on different string variables", () => {
      CodeGenState.setVariableTypeInfo("a", {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 16,
      });
      CodeGenState.setVariableTypeInfo("b", {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 16,
      });

      const expr = parseExpression("a.length + b.length");
      const counts = StringLengthCounter.countExpression(expr);

      expect(counts.get("a")).toBe(1);
      expect(counts.get("b")).toBe(1);
    });

    it("ignores .length on non-string variables", () => {
      CodeGenState.setVariableTypeInfo("arr", {
        baseType: "u8",
        bitWidth: 8,
        isArray: true,
        isConst: false,
        arrayDimensions: [10],
      });

      const expr = parseExpression("arr.length");
      const counts = StringLengthCounter.countExpression(expr);

      expect(counts.get("arr")).toBeUndefined();
    });

    it("ignores other member accesses", () => {
      CodeGenState.setVariableTypeInfo("obj", {
        baseType: "MyStruct",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });

      const expr = parseExpression("obj.value");
      const counts = StringLengthCounter.countExpression(expr);

      expect(counts.size).toBe(0);
    });

    it("handles unknown variables gracefully", () => {
      // No type registered for "unknown"
      const expr = parseExpression("unknown.length");
      const counts = StringLengthCounter.countExpression(expr);

      expect(counts.size).toBe(0);
    });
  });

  describe("countBlock", () => {
    it("counts .length accesses across multiple statements", () => {
      CodeGenState.setVariableTypeInfo("msg", {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 128,
      });

      const block = parseBlock(`
        u32 len <- msg.length;
        u32 doubled <- msg.length * 2;
      `);
      const counts = StringLengthCounter.countBlock(block);

      expect(counts.get("msg")).toBe(2);
    });

    it("counts .length in assignment statements", () => {
      CodeGenState.setVariableTypeInfo("text", {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 64,
      });

      const block = parseBlock(`
        u32 x;
        x <- text.length;
      `);
      const counts = StringLengthCounter.countBlock(block);

      expect(counts.get("text")).toBe(1);
    });
  });

  describe("countBlockInto", () => {
    it("adds counts to existing map", () => {
      CodeGenState.setVariableTypeInfo("s1", {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 32,
      });
      CodeGenState.setVariableTypeInfo("s2", {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 32,
      });

      // Pre-populate counts
      const counts = new Map<string, number>();
      counts.set("s1", 1);

      const block = parseBlock(`
        u32 a <- s1.length;
        u32 b <- s2.length;
      `);
      StringLengthCounter.countBlockInto(block, counts);

      expect(counts.get("s1")).toBe(2); // 1 existing + 1 new
      expect(counts.get("s2")).toBe(1);
    });
  });

  describe("nested expressions", () => {
    it("counts .length in ternary expressions", () => {
      CodeGenState.setVariableTypeInfo("str", {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 64,
      });

      const expr = parseExpression("(str.length > 0) ? str.length : 0");
      const counts = StringLengthCounter.countExpression(expr);

      expect(counts.get("str")).toBe(2);
    });

    it("counts .length in comparison expressions", () => {
      CodeGenState.setVariableTypeInfo("name", {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: 50,
      });

      const expr = parseExpression("name.length = 10");
      const counts = StringLengthCounter.countExpression(expr);

      expect(counts.get("name")).toBe(1);
    });
  });
});
