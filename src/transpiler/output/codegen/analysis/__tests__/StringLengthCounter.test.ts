/**
 * Unit tests for StringLengthCounter
 * Issue #644: strlen caching optimization
 */

import { describe, it, expect, vi } from "vitest";
import StringLengthCounter from "../StringLengthCounter";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser";
import TTypeInfo from "../../types/TTypeInfo";

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
  describe("countExpression", () => {
    it("counts single .length access on string variable", () => {
      const typeRegistry = vi.fn((name: string): TTypeInfo | undefined => {
        if (name === "myStr") {
          return {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 64,
          };
        }
        return undefined;
      });

      const counter = new StringLengthCounter(typeRegistry);
      const expr = parseExpression("myStr.length");
      const counts = counter.countExpression(expr);

      expect(counts.get("myStr")).toBe(1);
    });

    it("counts multiple .length accesses on same variable", () => {
      const typeRegistry = vi.fn((name: string): TTypeInfo | undefined => {
        if (name === "str") {
          return {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 32,
          };
        }
        return undefined;
      });

      const counter = new StringLengthCounter(typeRegistry);
      // Expression: str.length + str.length
      const expr = parseExpression("str.length + str.length");
      const counts = counter.countExpression(expr);

      expect(counts.get("str")).toBe(2);
    });

    it("counts .length accesses on different string variables", () => {
      const typeRegistry = vi.fn((name: string): TTypeInfo | undefined => {
        if (name === "a" || name === "b") {
          return {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 16,
          };
        }
        return undefined;
      });

      const counter = new StringLengthCounter(typeRegistry);
      const expr = parseExpression("a.length + b.length");
      const counts = counter.countExpression(expr);

      expect(counts.get("a")).toBe(1);
      expect(counts.get("b")).toBe(1);
    });

    it("ignores .length on non-string variables", () => {
      const typeRegistry = vi.fn((name: string): TTypeInfo | undefined => {
        if (name === "arr") {
          return {
            baseType: "u8",
            bitWidth: 8,
            isArray: true,
            isConst: false,
            arrayDimensions: [10],
          };
        }
        return undefined;
      });

      const counter = new StringLengthCounter(typeRegistry);
      const expr = parseExpression("arr.length");
      const counts = counter.countExpression(expr);

      expect(counts.get("arr")).toBeUndefined();
    });

    it("ignores other member accesses", () => {
      const typeRegistry = vi.fn((name: string): TTypeInfo | undefined => {
        if (name === "obj") {
          return {
            baseType: "MyStruct",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          };
        }
        return undefined;
      });

      const counter = new StringLengthCounter(typeRegistry);
      const expr = parseExpression("obj.value");
      const counts = counter.countExpression(expr);

      expect(counts.size).toBe(0);
    });

    it("handles unknown variables gracefully", () => {
      const typeRegistry = vi.fn((): TTypeInfo | undefined => undefined);

      const counter = new StringLengthCounter(typeRegistry);
      const expr = parseExpression("unknown.length");
      const counts = counter.countExpression(expr);

      expect(counts.size).toBe(0);
    });
  });

  describe("countBlock", () => {
    it("counts .length accesses across multiple statements", () => {
      const typeRegistry = vi.fn((name: string): TTypeInfo | undefined => {
        if (name === "msg") {
          return {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 128,
          };
        }
        return undefined;
      });

      const counter = new StringLengthCounter(typeRegistry);
      const block = parseBlock(`
        u32 len <- msg.length;
        u32 doubled <- msg.length * 2;
      `);
      const counts = counter.countBlock(block);

      expect(counts.get("msg")).toBe(2);
    });

    it("counts .length in assignment statements", () => {
      const typeRegistry = vi.fn((name: string): TTypeInfo | undefined => {
        if (name === "text") {
          return {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 64,
          };
        }
        return undefined;
      });

      const counter = new StringLengthCounter(typeRegistry);
      const block = parseBlock(`
        u32 x;
        x <- text.length;
      `);
      const counts = counter.countBlock(block);

      expect(counts.get("text")).toBe(1);
    });
  });

  describe("countBlockInto", () => {
    it("adds counts to existing map", () => {
      const typeRegistry = vi.fn((name: string): TTypeInfo | undefined => {
        if (name === "s1" || name === "s2") {
          return {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 32,
          };
        }
        return undefined;
      });

      const counter = new StringLengthCounter(typeRegistry);

      // Pre-populate counts
      const counts = new Map<string, number>();
      counts.set("s1", 1);

      const block = parseBlock(`
        u32 a <- s1.length;
        u32 b <- s2.length;
      `);
      counter.countBlockInto(block, counts);

      expect(counts.get("s1")).toBe(2); // 1 existing + 1 new
      expect(counts.get("s2")).toBe(1);
    });
  });

  describe("nested expressions", () => {
    it("counts .length in ternary expressions", () => {
      const typeRegistry = vi.fn((name: string): TTypeInfo | undefined => {
        if (name === "str") {
          return {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 64,
          };
        }
        return undefined;
      });

      const counter = new StringLengthCounter(typeRegistry);
      const expr = parseExpression("(str.length > 0) ? str.length : 0");
      const counts = counter.countExpression(expr);

      expect(counts.get("str")).toBe(2);
    });

    it("counts .length in comparison expressions", () => {
      const typeRegistry = vi.fn((name: string): TTypeInfo | undefined => {
        if (name === "name") {
          return {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 50,
          };
        }
        return undefined;
      });

      const counter = new StringLengthCounter(typeRegistry);
      const expr = parseExpression("name.length = 10");
      const counts = counter.countExpression(expr);

      expect(counts.get("name")).toBe(1);
    });
  });
});
