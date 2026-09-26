/**
 * Unit tests for LiteralGenerator
 *
 * Tests C-Next literal transformations:
 * - Boolean literals (true/false) → stdbool.h include effect
 * - Float suffixes: f32 → f, f64 → stripped
 * - Integer suffixes: u64 → ULL, i64 → LL, 8/16/32-bit → stripped
 */

import { describe, it, expect, beforeEach } from "vitest";
import generateLiteral from "../LiteralGenerator";
import type IGeneratorState from "../../IGeneratorState";
import TranspileState from "../../../../../TranspileState";

// #1445: generateLiteral takes the literal's text, so there is no node to
// fake. The `as unknown as LiteralContext` cast this file used to need is gone
// with it -- the function's real input was always a string.
const mockState = {} as IGeneratorState;

let state = new TranspileState();

describe("LiteralGenerator", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  describe("boolean literals", () => {
    it("should pass through boolean true with stdbool effect", () => {
      const result = generateLiteral("true", mockState, state);

      expect(result.code).toBe("true");
      expect(result.effects).toEqual([{ type: "include", header: "stdbool" }]);
    });

    it("should pass through boolean false with stdbool effect", () => {
      const result = generateLiteral("false", mockState, state);

      expect(result.code).toBe("false");
      expect(result.effects).toEqual([{ type: "include", header: "stdbool" }]);
    });
  });

  describe("float suffixes (ADR-024)", () => {
    it("should transform f32 suffix to C float suffix", () => {
      const result = generateLiteral("3.14f32", mockState, state);

      expect(result.code).toBe("3.14f");
      expect(result.effects).toEqual([]);
    });

    it("should transform f64 suffix by removing it", () => {
      const result = generateLiteral("3.14f64", mockState, state);

      expect(result.code).toBe("3.14");
      expect(result.effects).toEqual([]);
    });
  });

  describe("integer suffixes (Issue #130)", () => {
    it.each([
      ["should transform u64 suffix to ULL", "42u64", "42ULL"],
      ["should transform i64 suffix to LL", "42i64", "42LL"],
      ["should strip 8/16/32-bit integer suffixes", "42u8", "42"],
      ["should transform uppercase U64 suffix to ULL", "0xFFU64", "0xFFULL"],
    ])("%s", (_label, source, source2) => {
      const result = generateLiteral(source, mockState, state);

      expect(result.code).toBe(source2);
      expect(result.effects).toEqual([]);
    });
  });

  describe("passthrough literals", () => {
    it("should pass through plain integer without effects", () => {
      const result = generateLiteral("42", mockState, state);

      expect(result.code).toBe("42");
      expect(result.effects).toEqual([]);
    });

    it("should pass through string literal without effects", () => {
      const result = generateLiteral('"hello"', mockState, state);

      expect(result.code).toBe('"hello"');
      expect(result.effects).toEqual([]);
    });
  });

  describe("MISRA Rule 7.2: unsigned suffix for unsigned types", () => {
    /**
     * Create mock state with expectedType set.
     */
    function createStateWithExpectedType(
      expectedType: string | null,
    ): IGeneratorState {
      return { expectedType } as IGeneratorState;
    }

    it.each([
      [
        "should add U suffix to decimal literal when expectedType is u8",
        "255",
        "u8",
        "255U",
      ],
      [
        "should add U suffix to decimal literal when expectedType is u16",
        "60000",
        "u16",
        "60000U",
      ],
      [
        "should add U suffix to decimal literal when expectedType is u32",
        "4000000000",
        "u32",
        "4000000000U",
      ],
      [
        "should add ULL suffix to decimal literal when expectedType is u64",
        "42",
        "u64",
        "42ULL",
      ],
      [
        "should add U suffix to hex literal when expectedType is u8",
        "0xFF",
        "u8",
        "0xFFU",
      ],
      [
        "should add U suffix to binary literal when expectedType is u8",
        "0b11110000",
        "u8",
        "0b11110000U",
      ],
      [
        "should NOT add U suffix when expectedType is signed (i32)",
        "42",
        "i32",
        "42",
      ],
      ["should NOT add U suffix when expectedType is null", "42", null, "42"],
      [
        "should NOT add U suffix to string literals even with unsigned expectedType",
        '"hello"',
        "u8",
        '"hello"',
      ],
      [
        "should NOT add U suffix to float literals even with unsigned expectedType",
        "3.14",
        "u32",
        "3.14",
      ],
      [
        "should NOT double-add U suffix if already present via explicit suffix (u32 suffix is stripped, then U is added based on expectedType)",
        "42u32",
        "u32",
        "42U",
      ],
      ["should handle uint8_t C type as unsigned", "42", "uint8_t", "42U"],
      [
        "should handle uint32_t C type as unsigned",
        "0x80000000",
        "uint32_t",
        "0x80000000U",
      ],
    ])("%s", (_label, source, argument2, expected) => {
      const generatorState = createStateWithExpectedType(argument2);
      const result = generateLiteral(source, generatorState, state);

      expect(result.code).toBe(expected);
    });
  });
});
