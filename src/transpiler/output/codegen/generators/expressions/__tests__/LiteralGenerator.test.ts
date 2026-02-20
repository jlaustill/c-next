/**
 * Unit tests for LiteralGenerator
 *
 * Tests C-Next literal transformations:
 * - Boolean literals (true/false) → stdbool.h include effect
 * - Float suffixes: f32 → f, f64 → stripped
 * - Integer suffixes: u64 → ULL, i64 → LL, 8/16/32-bit → stripped
 */

import { describe, it, expect } from "vitest";
import generateLiteral from "../LiteralGenerator";
import type { LiteralContext } from "../../../../../logic/parser/grammar/CNextParser";
import type IGeneratorInput from "../../IGeneratorInput";
import type IGeneratorState from "../../IGeneratorState";
import type IOrchestrator from "../../IOrchestrator";

/**
 * Create a mock LiteralContext that returns the specified text.
 * generateLiteral only calls node.getText(), so this is sufficient.
 */
function createMockLiteral(text: string): LiteralContext {
  return { getText: () => text } as unknown as LiteralContext;
}

// generateLiteral does not use input, state, or orchestrator
const mockInput = {} as IGeneratorInput;
const mockState = {} as IGeneratorState;
const mockOrchestrator = {} as IOrchestrator;

describe("LiteralGenerator", () => {
  describe("boolean literals", () => {
    it("should pass through boolean true with stdbool effect", () => {
      const node = createMockLiteral("true");
      const result = generateLiteral(
        node,
        mockInput,
        mockState,
        mockOrchestrator,
      );

      expect(result.code).toBe("true");
      expect(result.effects).toEqual([{ type: "include", header: "stdbool" }]);
    });

    it("should pass through boolean false with stdbool effect", () => {
      const node = createMockLiteral("false");
      const result = generateLiteral(
        node,
        mockInput,
        mockState,
        mockOrchestrator,
      );

      expect(result.code).toBe("false");
      expect(result.effects).toEqual([{ type: "include", header: "stdbool" }]);
    });
  });

  describe("float suffixes (ADR-024)", () => {
    it("should transform f32 suffix to C float suffix", () => {
      const node = createMockLiteral("3.14f32");
      const result = generateLiteral(
        node,
        mockInput,
        mockState,
        mockOrchestrator,
      );

      expect(result.code).toBe("3.14f");
      expect(result.effects).toEqual([]);
    });

    it("should transform f64 suffix by removing it", () => {
      const node = createMockLiteral("3.14f64");
      const result = generateLiteral(
        node,
        mockInput,
        mockState,
        mockOrchestrator,
      );

      expect(result.code).toBe("3.14");
      expect(result.effects).toEqual([]);
    });
  });

  describe("integer suffixes (Issue #130)", () => {
    it("should transform u64 suffix to ULL", () => {
      const node = createMockLiteral("42u64");
      const result = generateLiteral(
        node,
        mockInput,
        mockState,
        mockOrchestrator,
      );

      expect(result.code).toBe("42ULL");
      expect(result.effects).toEqual([]);
    });

    it("should transform i64 suffix to LL", () => {
      const node = createMockLiteral("42i64");
      const result = generateLiteral(
        node,
        mockInput,
        mockState,
        mockOrchestrator,
      );

      expect(result.code).toBe("42LL");
      expect(result.effects).toEqual([]);
    });

    it("should strip 8/16/32-bit integer suffixes", () => {
      const node = createMockLiteral("42u8");
      const result = generateLiteral(
        node,
        mockInput,
        mockState,
        mockOrchestrator,
      );

      expect(result.code).toBe("42");
      expect(result.effects).toEqual([]);
    });

    it("should transform uppercase U64 suffix to ULL", () => {
      const node = createMockLiteral("0xFFU64");
      const result = generateLiteral(
        node,
        mockInput,
        mockState,
        mockOrchestrator,
      );

      expect(result.code).toBe("0xFFULL");
      expect(result.effects).toEqual([]);
    });
  });

  describe("passthrough literals", () => {
    it("should pass through plain integer without effects", () => {
      const node = createMockLiteral("42");
      const result = generateLiteral(
        node,
        mockInput,
        mockState,
        mockOrchestrator,
      );

      expect(result.code).toBe("42");
      expect(result.effects).toEqual([]);
    });

    it("should pass through string literal without effects", () => {
      const node = createMockLiteral('"hello"');
      const result = generateLiteral(
        node,
        mockInput,
        mockState,
        mockOrchestrator,
      );

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

    it("should add U suffix to decimal literal when expectedType is u8", () => {
      const node = createMockLiteral("255");
      const state = createStateWithExpectedType("u8");
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      expect(result.code).toBe("255U");
    });

    it("should add U suffix to decimal literal when expectedType is u16", () => {
      const node = createMockLiteral("60000");
      const state = createStateWithExpectedType("u16");
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      expect(result.code).toBe("60000U");
    });

    it("should add U suffix to decimal literal when expectedType is u32", () => {
      const node = createMockLiteral("4000000000");
      const state = createStateWithExpectedType("u32");
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      expect(result.code).toBe("4000000000U");
    });

    it("should add ULL suffix to decimal literal when expectedType is u64", () => {
      const node = createMockLiteral("42");
      const state = createStateWithExpectedType("u64");
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      expect(result.code).toBe("42ULL");
    });

    it("should add U suffix to hex literal when expectedType is u8", () => {
      const node = createMockLiteral("0xFF");
      const state = createStateWithExpectedType("u8");
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      expect(result.code).toBe("0xFFU");
    });

    it("should add U suffix to binary literal when expectedType is u8", () => {
      const node = createMockLiteral("0b11110000");
      const state = createStateWithExpectedType("u8");
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      expect(result.code).toBe("0b11110000U");
    });

    it("should NOT add U suffix when expectedType is signed (i32)", () => {
      const node = createMockLiteral("42");
      const state = createStateWithExpectedType("i32");
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      expect(result.code).toBe("42");
    });

    it("should NOT add U suffix when expectedType is null", () => {
      const node = createMockLiteral("42");
      const state = createStateWithExpectedType(null);
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      expect(result.code).toBe("42");
    });

    it("should NOT add U suffix to string literals even with unsigned expectedType", () => {
      const node = createMockLiteral('"hello"');
      const state = createStateWithExpectedType("u8");
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      expect(result.code).toBe('"hello"');
    });

    it("should NOT add U suffix to float literals even with unsigned expectedType", () => {
      const node = createMockLiteral("3.14");
      const state = createStateWithExpectedType("u32");
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      expect(result.code).toBe("3.14");
    });

    it("should NOT double-add U suffix if already present via explicit suffix", () => {
      const node = createMockLiteral("42u32");
      const state = createStateWithExpectedType("u32");
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      // u32 suffix is stripped, then U is added based on expectedType
      expect(result.code).toBe("42U");
    });

    it("should handle uint8_t C type as unsigned", () => {
      const node = createMockLiteral("42");
      const state = createStateWithExpectedType("uint8_t");
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      expect(result.code).toBe("42U");
    });

    it("should handle uint32_t C type as unsigned", () => {
      const node = createMockLiteral("0x80000000");
      const state = createStateWithExpectedType("uint32_t");
      const result = generateLiteral(node, mockInput, state, mockOrchestrator);

      expect(result.code).toBe("0x80000000U");
    });
  });
});
