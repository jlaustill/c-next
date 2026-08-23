/**
 * Unit tests for ArrayDimensionParser
 * Issue #644: Array dimension parsing consolidation
 */

import { describe, it, expect } from "vitest";
import CNextSourceParser from "../../transpiler/logic/parser/CNextSourceParser";
import ArrayDimensionParser from "../ArrayDimensionParser";
import UNRESOLVED_DIMENSION from "../../transpiler/constants/UNRESOLVED_DIMENSION";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";

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
      it.each([
        ["decimal", "u8 x <- 42;", 42],
        ["negative decimal", "i8 x <- -17;", -17],
        ["hex", "u8 x <- 0x2A;", 42],
        ["hex with lowercase x", "u8 x <- 0xff;", 255],
        ["binary", "u8 x <- 0b101010;", 42],
        ["binary with uppercase B", "u8 x <- 0B1111;", 15],
      ])("parses a %s literal", (_label, source, expected) => {
        const expr = getExpression(source as string);
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!);
        expect(result).toBe(expected);
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
      // Bit width divided by 8, so sizeof(u32) is 4 bytes.
      it.each([
        ["u32", "u8 x <- sizeof(u32);", 4],
        ["u8", "u8 x <- sizeof(u8);", 1],
        ["u64", "u8 x <- sizeof(u64);", 8],
      ])(
        "evaluates sizeof(%s) to its width in bytes",
        (_label, source, expected) => {
          const expr = getExpression(source as string);
          expect(expr).not.toBeNull();
          const result = ArrayDimensionParser.parseSingleDimension(expr!, {
            typeWidths: TYPE_WIDTH,
          });
          expect(result).toBe(expected);
        },
      );

      it("returns undefined for unknown type without struct check", () => {
        const expr = getExpression("u8 x <- sizeof(Unknown);");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          typeWidths: TYPE_WIDTH,
        });
        expect(result).toBeUndefined();
      });

      it("returns undefined for a type with no known width", () => {
        const expr = getExpression("u8 x <- sizeof(MyStruct);");
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          typeWidths: TYPE_WIDTH,
        });
        // Issue #1127: this used to pass an isKnownStruct predicate to
        // distinguish "known struct, size not computable yet" from "unknown
        // type". Both returned undefined, so the predicate changed no answer
        // and was removed; the behavior asserted here is unchanged.
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

      // Issue #1157: the two-literal row previously asserted undefined, on the
      // stated grounds that "1 + 2" has spaces and so misses the CONST+CONST
      // pattern. getText() strips whitespace, so the text is "1+2"; the real
      // reason it did not fold is that the pattern required an identifier on
      // both sides. A dimension that does not fold is dropped by the
      // collectors, which is what left `u8[8+1]` as a scalar in the header.
      //
      // An operand is a literal in any notation or the name of a known const,
      // resolved by one rule, so operand order does not matter and the last
      // row -- an identifier that is not a known const -- still yields
      // undefined rather than a partial answer.
      it.each([
        ["two integer literals", "u8 x <- 1 + 2;", 3],
        ["a const and a literal", "u8 x <- SIZE + 2;", 8],
        ["a literal and a const", "u8 x <- 2 + SIZE;", 8],
        ["a hex operand", "u8 x <- 0x10 + 1;", 17],
        ["an unknown identifier", "u8 x <- UNKNOWN + 1;", undefined],
      ])("resolves addition of %s", (_label, source, expected) => {
        const expr = getExpression(source as string);
        expect(expr).not.toBeNull();
        const result = ArrayDimensionParser.parseSingleDimension(expr!, {
          constValues: new Map([["SIZE", 6]]),
        });
        expect(result).toBe(expected);
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

  describe("parseDimensions", () => {
    // Issue #1127: parseSimpleDimensions and parseForParameters merged here.
    // They differed only in what an unresolved dimension produced -- omitted
    // vs 0 -- and omitting shifts every later dimension out of position.
    it.each([
      ["null input", null, []],
      ["empty input", [], []],
    ])("returns an empty list for %s", (_label, input, expected) => {
      expect(
        ArrayDimensionParser.parseDimensions(
          input as Parser.ArrayDimensionContext[] | null,
        ),
      ).toEqual(expected);
    });

    // The hex and binary rows previously expected [] from
    // parseSimpleDimensions: base-10 parseInt read "0x10" as 0 and 0 was
    // filtered out, so a hex-sized array looked identical to one whose size
    // could not be resolved and lost ADR-036 bounds checking (#1159).
    // u8[16], u8[0x10] and u8[0b10000] all describe the same array.
    //
    // An unresolved dimension keeps its slot as UNRESOLVED_DIMENSION; there is
    // no const map here, so SIZE cannot fold.
    it.each([
      ["a single integer dimension", "u8 arr[10];", [10]],
      ["multiple dimensions", "u8 arr[2][3];", [2, 3]],
      ["a hex dimension", "u8 arr[0x10];", [16]],
      ["a binary dimension", "u8 arr[0b10000];", [16]],
      ["a const identifier", "u8 arr[SIZE];", [UNRESOLVED_DIMENSION]],
      ["an unsized dimension", "u8 arr[];", [UNRESOLVED_DIMENSION]],
      [
        "mixed resolved and unresolved",
        "u8 arr[10][SIZE];",
        [10, UNRESOLVED_DIMENSION],
      ],
    ])("parses %s", (_label, source, expected) => {
      const dims = getArrayDimensions(source as string);
      expect(dims).not.toBeNull();
      expect(ArrayDimensionParser.parseDimensions(dims!)).toEqual(expected);
    });

    it("keeps an unresolved dimension in position", () => {
      // The whole reason the two methods merged: `u8 arr[SIZE][4]` reporting
      // [4] makes checkArrayBounds validate subscript 0 against dimension 2's
      // bound.
      const dims = getArrayDimensions("u8 arr[SIZE][4];");
      expect(dims).not.toBeNull();
      expect(ArrayDimensionParser.parseDimensions(dims!)).toEqual([
        UNRESOLVED_DIMENSION,
        4,
      ]);
    });
  });
});
