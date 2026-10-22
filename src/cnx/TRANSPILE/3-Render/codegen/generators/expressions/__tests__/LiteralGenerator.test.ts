/**
 * Unit tests for LiteralGenerator
 *
 * Tests cnx literal transformations:
 * - Boolean literals (true/false) → stdbool.h include effect
 * - Float suffixes: f32 → f, f64 → stripped
 * - Integer suffixes: u64 → ULL, i64 → LL, 8/16/32-bit → stripped
 */

import TestSymbolTable from "../../../../../__tests__/TestSymbolTable";
import { describe, it, expect, beforeEach } from "vitest";
import generateLiteral from "../LiteralGenerator";
import type IGeneratorState from "../../IGeneratorState";
import TranspileState from "../../../../../TranspileState";
import ESourceLanguage from "../../../../../../utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../../../types/__testUtils__/testSourceSpan";

// #1445: generateLiteral takes the literal's text, so there is no node to
// fake. The `as unknown as LiteralContext` cast this file used to need is gone
// with it -- the function's real input was always a string.
const mockState = {} as IGeneratorState;

let state = new TranspileState();

describe("LiteralGenerator", () => {
  beforeEach(() => {
    state = new TranspileState();
    TestSymbolTable.install(state);
  });

  describe("boolean literals", () => {
    it("should pass through boolean true with no effect", () => {
      const result = generateLiteral("true", mockState, state, null);

      expect(result.code).toBe("true");
      expect(result.effects).toEqual([]);
    });

    it("should pass through boolean false with no effect", () => {
      const result = generateLiteral("false", mockState, state, null);

      expect(result.code).toBe("false");
      expect(result.effects).toEqual([]);
    });
  });

  describe("float suffixes (ADR-024)", () => {
    it("should transform f32 suffix to C float suffix", () => {
      const result = generateLiteral("3.14f32", mockState, state, null);

      expect(result.code).toBe("3.14f");
      expect(result.effects).toEqual([]);
    });

    it("should transform f64 suffix by removing it", () => {
      const result = generateLiteral("3.14f64", mockState, state, null);

      expect(result.code).toBe("3.14");
      expect(result.effects).toEqual([]);
    });
  });

  // #1668: a hex integer can END in `F32`/`F64`. Reading that as a float
  // suffix emitted 0xFF32 as `0xFf` (255) and 0xABCDEF64 as `0xABCDE`.
  describe("hex literals ending in F32 or F64 (#1668)", () => {
    it.each([
      ["0xFF32", "u32", "0xFF32U"],
      ["0xABCDEF64", "u64", "0xABCDEF64ULL"],
      ["0xF32", "i32", "0xF32"],
    ])("keeps %s whole (expected %s)", (text, expectedType, code) => {
      const result = generateLiteral(
        text,
        { expectedType } as IGeneratorState,
        state,
        null,
      );

      expect(result.code).toBe(code);
    });
  });

  describe("integer suffixes (Issue #130)", () => {
    it.each([
      ["should transform u64 suffix to ULL", "42u64", "42ULL"],
      ["should transform i64 suffix to LL", "42i64", "42LL"],
      ["should strip 8/16/32-bit integer suffixes", "42u8", "42"],
      ["should transform uppercase U64 suffix to ULL", "0xFFU64", "0xFFULL"],
    ])("%s", (_label, source, source2) => {
      const result = generateLiteral(source, mockState, state, null);

      expect(result.code).toBe(source2);
      expect(result.effects).toEqual([]);
    });
  });

  describe("passthrough literals", () => {
    it("should pass through plain integer without effects", () => {
      const result = generateLiteral("42", mockState, state, null);

      expect(result.code).toBe("42");
      expect(result.effects).toEqual([]);
    });

    it("should pass through string literal without effects", () => {
      const result = generateLiteral('"hello"', mockState, state, null);

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
      const result = generateLiteral(source, generatorState, state, null);

      expect(result.code).toBe(expected);
    });
  });

  describe("MISRA Rule 7.2: a header's typedef chain (#1755)", () => {
    function typedef(name: string, type: string): void {
      TestSymbolTable.of(state).addCSymbol({
        name,
        kind: "type",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "libc.h",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type,
      });
    }

    beforeEach(() => {
      typedef("size_t", "unsigned long");
      typedef("uint32_t", "__uint32_t");
      typedef("__uint32_t", "unsigned int");
      typedef("uint64_t", "__uint64_t");
      typedef("__uint64_t", "unsigned long long");
      typedef("int32_t", "__int32_t");
      typedef("__int32_t", "int");
      typedef("byte_t", "uint8_t");
      typedef("loop_a", "loop_b");
      typedef("loop_b", "loop_a");
    });

    it.each([
      ["size_t, which ends in `unsigned long`", "size_t", "0U"],
      ["uint32_t, which ends in `unsigned int`", "uint32_t", "0U"],
      ["uint64_t, through `__uint64_t`", "uint64_t", "0ULL"],
      ["a project typedef of uint8_t", "byte_t", "0U"],
      ["`unsigned long long` itself", "unsigned long long", "0U"],
      ["GCC's `long unsigned int`", "long unsigned int", "0U"],
      ["GCC's `short unsigned int`", "short unsigned int", "0U"],
      ["GCC's `long long unsigned int`", "long long unsigned int", "0U"],
      ["`unsigned`, alone", "unsigned", "0U"],
      ["`long int`, which is signed", "long int", "0"],
      ["`unsigned unsigned`, which is no type", "unsigned unsigned", "0"],
      ["`unsigned float`, which is no integer", "unsigned float", "0"],
      ["int32_t, which ends in `int`", "int32_t", "0"],
      ["a typedef cycle", "loop_a", "0"],
    ])("%s", (_label, expectedType, expected) => {
      const generatorState = { expectedType } as IGeneratorState;
      expect(generateLiteral("0", generatorState, state, null).code).toBe(
        expected,
      );
    });
  });
});
