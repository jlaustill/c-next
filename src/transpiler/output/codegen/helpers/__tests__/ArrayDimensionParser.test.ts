/**
 * Unit tests for ArrayDimensionParser
 * Issue #644: Array dimension parsing consolidation
 */

import { describe, it, expect } from "vitest";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser";
import ArrayDimensionParser from "../ArrayDimensionParser";
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";

describe("ArrayDimensionParser", () => {
  /**
   * Helper to extract an expression context from C-Next source.
   */
  function getExpression(source: string): Parser.ExpressionContext | null {
    const result = CNextSourceParser.parse(source);
    const decl = result.tree.declaration(0);
    const varDecl = decl?.variableDeclaration();
    return varDecl?.expression() ?? null;
  }

  /**
   * Helper to extract array dimension contexts from C-Next source.
   */
  function getArrayDimensions(
    source: string,
  ): Parser.ArrayDimensionContext[] | null {
    const result = CNextSourceParser.parse(source);
    const decl = result.tree.declaration(0);
    const varDecl = decl?.variableDeclaration();
    return varDecl?.arrayDimension() ?? null;
  }

  describe("parseSingleDimension", () => {
    describe("integer literals", () => {
      it("parses decimal integer", () => {
        const expr = getExpression("u8 x <- 42;");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!);
        expect(result).toBe(42);
      });

      it("parses negative decimal integer", () => {
        const expr = getExpression("i8 x <- -17;");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!);
        expect(result).toBe(-17);
      });

      it("parses hex literal", () => {
        const expr = getExpression("u8 x <- 0x2A;");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!);
        expect(result).toBe(42);
      });

      it("parses hex literal with lowercase x", () => {
        const expr = getExpression("u8 x <- 0xff;");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!);
        expect(result).toBe(255);
      });

      it("parses binary literal", () => {
        const expr = getExpression("u8 x <- 0b101010;");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!);
        expect(result).toBe(42);
      });

      it("parses binary literal with uppercase B", () => {
        const expr = getExpression("u8 x <- 0B1111;");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!);
        expect(result).toBe(15);
      });
    });

    describe("const references", () => {
      it("resolves known const value", () => {
        const expr = getExpression("u8 x <- SIZE;");
        expect(expr).not.toBeNull();
        const constValues = new Map([["SIZE", 10]]);
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          constValues,
        });
        expect(result).toBe(10);
      });

      it("returns undefined for unknown identifier", () => {
        const expr = getExpression("u8 x <- UNKNOWN;");
        expect(expr).not.toBeNull();
        const constValues = new Map([["SIZE", 10]]);
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          constValues,
        });
        expect(result).toBeUndefined();
      });

      it("returns undefined for identifier without const map", () => {
        const expr = getExpression("u8 x <- SIZE;");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!);
        expect(result).toBeUndefined();
      });
    });

    describe("binary expressions with const values", () => {
      it("evaluates CONST + CONST", () => {
        const expr = getExpression("u8 x <- A+B;");
        expect(expr).not.toBeNull();
        const constValues = new Map([
          ["A", 5],
          ["B", 3],
        ]);
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          constValues,
        });
        expect(result).toBe(8);
      });

      it("returns undefined when left operand unknown", () => {
        const expr = getExpression("u8 x <- UNKNOWN+B;");
        expect(expr).not.toBeNull();
        const constValues = new Map([["B", 3]]);
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          constValues,
        });
        expect(result).toBeUndefined();
      });

      it("returns undefined when right operand unknown", () => {
        const expr = getExpression("u8 x <- A+UNKNOWN;");
        expect(expr).not.toBeNull();
        const constValues = new Map([["A", 5]]);
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          constValues,
        });
        expect(result).toBeUndefined();
      });
    });

    describe("sizeof expressions", () => {
      it("evaluates sizeof(u32)", () => {
        const expr = getExpression("u8 x <- sizeof(u32);");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          typeWidths: TYPE_WIDTH,
        });
        expect(result).toBe(4); // 32 bits / 8 = 4 bytes
      });

      it("evaluates sizeof(u8)", () => {
        const expr = getExpression("u8 x <- sizeof(u8);");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          typeWidths: TYPE_WIDTH,
        });
        expect(result).toBe(1);
      });

      it("evaluates sizeof(u64)", () => {
        const expr = getExpression("u8 x <- sizeof(u64);");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          typeWidths: TYPE_WIDTH,
        });
        expect(result).toBe(8);
      });

      it("returns undefined for unknown type without struct check", () => {
        const expr = getExpression("u8 x <- sizeof(Unknown);");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          typeWidths: TYPE_WIDTH,
        });
        expect(result).toBeUndefined();
      });

      it("returns undefined for known struct type", () => {
        const expr = getExpression("u8 x <- sizeof(MyStruct);");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          typeWidths: TYPE_WIDTH,
          isKnownStruct: (name) => name === "MyStruct",
        });
        expect(result).toBeUndefined();
      });
    });

    describe("sizeof multiplication", () => {
      it("evaluates sizeof(u32)*10", () => {
        const expr = getExpression("u8 x <- sizeof(u32)*10;");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          typeWidths: TYPE_WIDTH,
        });
        expect(result).toBe(40); // 4 bytes * 10
      });

      it("evaluates sizeof(u8)*256", () => {
        const expr = getExpression("u16 x <- sizeof(u8)*256;");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          typeWidths: TYPE_WIDTH,
        });
        expect(result).toBe(256);
      });
    });

    describe("sizeof addition", () => {
      it("evaluates sizeof(u32)+4", () => {
        const expr = getExpression("u8 x <- sizeof(u32)+4;");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          typeWidths: TYPE_WIDTH,
        });
        expect(result).toBe(8); // 4 bytes + 4
      });

      it("evaluates sizeof(u16)+1", () => {
        const expr = getExpression("u8 x <- sizeof(u16)+1;");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          typeWidths: TYPE_WIDTH,
        });
        expect(result).toBe(3); // 2 bytes + 1
      });
    });

    describe("complex expressions", () => {
      it("returns undefined for function calls", () => {
        const expr = getExpression("u8 x <- getSize();");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!);
        expect(result).toBeUndefined();
      });

      it("returns undefined for arithmetic expressions", () => {
        const expr = getExpression("u8 x <- 1 + 2;");
        expect(expr).not.toBeNull();
        // Note: This is "1 + 2" with spaces, which doesn't match the CONST+CONST pattern
        const result = ArrayDimensionParser.parseSingleDimension(expr!);
        expect(result).toBeUndefined();
      });
    });
  });

  describe("parseAllDimensions", () => {
    it("returns undefined for null input", () => {
      const result = ArrayDimensionParser.parseAllDimensions(null);
      expect(result).toBeUndefined();
    });

    it("returns undefined for empty array", () => {
      const result = ArrayDimensionParser.parseAllDimensions([]);
      expect(result).toBeUndefined();
    });

    it("parses single integer dimension", () => {
      const dims = getArrayDimensions("u8 arr[10];");
      expect(dims).not.toBeNull();
      const result = ArrayDimensionParser.parseAllDimensions(dims!);
      expect(result).toEqual([10]);
    });

    it("parses multiple integer dimensions", () => {
      const dims = getArrayDimensions("u8 arr[3][4][5];");
      expect(dims).not.toBeNull();
      const result = ArrayDimensionParser.parseAllDimensions(dims!);
      expect(result).toEqual([3, 4, 5]);
    });

    it("parses hex dimension", () => {
      const dims = getArrayDimensions("u8 arr[0x10];");
      expect(dims).not.toBeNull();
      const result = ArrayDimensionParser.parseAllDimensions(dims!);
      expect(result).toEqual([16]);
    });

    it("parses with const values", () => {
      const dims = getArrayDimensions("u8 arr[SIZE];");
      expect(dims).not.toBeNull();
      const constValues = new Map([["SIZE", 20]]);
      const result = ArrayDimensionParser.parseAllDimensions(dims!, {
        constValues,
      });
      expect(result).toEqual([20]);
    });

    it("drops unresolved dimensions", () => {
      const dims = getArrayDimensions("u8 arr[UNKNOWN];");
      expect(dims).not.toBeNull();
      const result = ArrayDimensionParser.parseAllDimensions(dims!);
      expect(result).toBeUndefined();
    });

    it("drops zero or negative dimensions", () => {
      const dims = getArrayDimensions("u8 arr[0];");
      expect(dims).not.toBeNull();
      const result = ArrayDimensionParser.parseAllDimensions(dims!);
      expect(result).toBeUndefined();
    });
  });

  describe("parseSimpleDimensions", () => {
    it("returns empty array for null input", () => {
      const result = ArrayDimensionParser.parseSimpleDimensions(null);
      expect(result).toEqual([]);
    });

    it("returns empty array for empty input", () => {
      const result = ArrayDimensionParser.parseSimpleDimensions([]);
      expect(result).toEqual([]);
    });

    it("parses single integer dimension", () => {
      const dims = getArrayDimensions("u8 arr[10];");
      expect(dims).not.toBeNull();
      const result = ArrayDimensionParser.parseSimpleDimensions(dims!);
      expect(result).toEqual([10]);
    });

    it("parses multiple dimensions", () => {
      const dims = getArrayDimensions("u8 arr[2][3];");
      expect(dims).not.toBeNull();
      const result = ArrayDimensionParser.parseSimpleDimensions(dims!);
      expect(result).toEqual([2, 3]);
    });

    it("skips non-numeric dimensions", () => {
      const dims = getArrayDimensions("u8 arr[SIZE];");
      expect(dims).not.toBeNull();
      // parseSimpleDimensions doesn't use const map, so SIZE is not resolved
      const result = ArrayDimensionParser.parseSimpleDimensions(dims!);
      expect(result).toEqual([]);
    });

    it("skips hex literals (parseInt doesn't parse 0x)", () => {
      const dims = getArrayDimensions("u8 arr[0x10];");
      expect(dims).not.toBeNull();
      const result = ArrayDimensionParser.parseSimpleDimensions(dims!);
      // parseInt("0x10", 10) returns 0, which is filtered out as not > 0
      expect(result).toEqual([]);
    });
  });

  describe("parseForParameters", () => {
    it("returns empty array for null input", () => {
      const result = ArrayDimensionParser.parseForParameters(null);
      expect(result).toEqual([]);
    });

    it("returns empty array for empty input", () => {
      const result = ArrayDimensionParser.parseForParameters([]);
      expect(result).toEqual([]);
    });

    it("parses single numeric dimension", () => {
      const dims = getArrayDimensions("u8 arr[10];");
      expect(dims).not.toBeNull();
      const result = ArrayDimensionParser.parseForParameters(dims!);
      expect(result).toEqual([10]);
    });

    it("uses 0 for non-numeric dimension (const identifier)", () => {
      const dims = getArrayDimensions("u8 arr[SIZE];");
      expect(dims).not.toBeNull();
      const result = ArrayDimensionParser.parseForParameters(dims!);
      expect(result).toEqual([0]);
    });

    it("uses 0 for unsized dimension", () => {
      const dims = getArrayDimensions("u8 arr[];");
      expect(dims).not.toBeNull();
      const result = ArrayDimensionParser.parseForParameters(dims!);
      expect(result).toEqual([0]);
    });

    it("handles mixed dimensions", () => {
      const dims = getArrayDimensions("u8 arr[10][SIZE];");
      expect(dims).not.toBeNull();
      const result = ArrayDimensionParser.parseForParameters(dims!);
      expect(result).toEqual([10, 0]);
    });
  });
});
