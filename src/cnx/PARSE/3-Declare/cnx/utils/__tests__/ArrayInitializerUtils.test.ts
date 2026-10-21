/**
 * Unit tests for ArrayInitializerUtils.
 * Issue #636: Ensure consistent array size inference from initializers.
 */

import { describe, it, expect } from "vitest";
import CnxSourceParser from "../../../../2-Parse/CnxSourceParser";
import ArrayInitializerUtils from "../ArrayInitializerUtils";

describe("ArrayInitializerUtils", () => {
  function initializerOf(source: string, index = 0) {
    const declaration =
      CnxSourceParser.parse(source).program.declarations[index].declaration;
    if (
      declaration.kind !== "variableDeclaration" ||
      !declaration.initializer
    ) {
      throw new Error(`declaration ${index} has no initializer`);
    }
    return declaration.initializer;
  }

  describe("getInferredSize", () => {
    it.each([
      ["element count for a list initializer", "u8 arr[] <- [10, 20, 30];", 3],
      ["1 for a single element array", "u8 arr[] <- [42];", 1],
      [
        "the outer dimension for a nested array",
        "u8 arr[][] <- [[1, 2], [3, 4]];",
        2,
      ],
      [
        "a string literal's bytes and terminator (ADR-035)",
        'u8[] m <- "Hi";',
        3,
      ],
    ])("returns %s", (_label, source, expected) => {
      expect(ArrayInitializerUtils.getInferredSize(initializerOf(source))).toBe(
        expected,
      );
    });

    it.each([
      ["fill-all syntax", "u8 arr[5] <- [0*];"],
      ["a number", "u8 x <- 42;"],
      ["an identifier", "u8 x <- other;"],
      ["arithmetic", "u8 x <- 1 + 2 + 3;"],
      ["a comparison", "bool x <- 1 < 2;"],
      ["a unary expression", "bool x <- !true;"],
      ["a parenthesized list", "u8 arr[] <- ([1, 2]);"],
    ])("returns undefined for %s", (_label, source) => {
      expect(
        ArrayInitializerUtils.getInferredSize(initializerOf(source)),
      ).toBeUndefined();
    });

    it("handles const struct array initializer (issue #636)", () => {
      const source = `
struct TItem { u32 id; u16 value; }
TItem ITEMS[] <- [{ id: 1, value: 100 }, { id: 2, value: 200 }, { id: 3, value: 300 }];
`;
      expect(
        ArrayInitializerUtils.getInferredSize(initializerOf(source, 1)),
      ).toBe(3);
    });
  });
});
