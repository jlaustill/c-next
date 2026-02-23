/**
 * Unit tests for UnaryExprGenerator
 *
 * Tests bitwise NOT (~) MISRA-compliant cast generation:
 * - Unsigned types get cast back to original type (MISRA 10.1/10.3)
 * - Signed types and unresolvable types are unchanged
 * - C++ mode uses static_cast
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import generateUnaryExpr from "../UnaryExprGenerator";
import type { UnaryExpressionContext } from "../../../../../logic/parser/grammar/CNextParser";
import type IGeneratorInput from "../../IGeneratorInput";
import type IGeneratorState from "../../IGeneratorState";
import type IOrchestrator from "../../IOrchestrator";
import CodeGenState from "../../../../../state/CodeGenState";

vi.mock("../../../TypeResolver", () => {
  return {
    default: {
      getUnaryExpressionType: vi.fn(),
      isUnsignedType: vi.fn(),
    },
  };
});

import TypeResolver from "../../../TypeResolver";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Create a mock UnaryExpressionContext for a prefix unary expression.
 * The node has no postfixExpression (prefix case) and a child unaryExpression.
 */
function createMockUnaryNode(fullText: string): UnaryExpressionContext {
  const innerUnary = {} as UnaryExpressionContext;
  return {
    postfixExpression: () => null,
    unaryExpression: () => innerUnary,
    getText: () => fullText,
  } as unknown as UnaryExpressionContext;
}

const mockInput = {} as IGeneratorInput;
const mockState = {} as IGeneratorState;

function createMockOrchestrator(innerResult: string): IOrchestrator {
  return {
    generateUnaryExpr: () => innerResult,
    generatePostfixExpr: () => "",
  } as unknown as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("UnaryExprGenerator", () => {
  afterEach(() => {
    vi.mocked(TypeResolver.getUnaryExpressionType).mockReset();
    vi.mocked(TypeResolver.isUnsignedType).mockReset();
    CodeGenState.cppMode = false;
  });

  describe("bitwise NOT on unsigned types", () => {
    it("should cast ~u8 to (uint8_t)~c in C mode", () => {
      vi.mocked(TypeResolver.getUnaryExpressionType).mockReturnValue("u8");
      vi.mocked(TypeResolver.isUnsignedType).mockReturnValue(true);

      const node = createMockUnaryNode("~c");
      const orchestrator = createMockOrchestrator("c");
      const result = generateUnaryExpr(
        node,
        mockInput,
        mockState,
        orchestrator,
      );

      expect(result.code).toBe("(uint8_t)~c");
      expect(result.effects).toEqual([]);
    });

    it("should cast ~u16 to (uint16_t)~c in C mode", () => {
      vi.mocked(TypeResolver.getUnaryExpressionType).mockReturnValue("u16");
      vi.mocked(TypeResolver.isUnsignedType).mockReturnValue(true);

      const node = createMockUnaryNode("~c");
      const orchestrator = createMockOrchestrator("c");
      const result = generateUnaryExpr(
        node,
        mockInput,
        mockState,
        orchestrator,
      );

      expect(result.code).toBe("(uint16_t)~c");
      expect(result.effects).toEqual([]);
    });

    it("should use static_cast in C++ mode", () => {
      CodeGenState.cppMode = true;
      vi.mocked(TypeResolver.getUnaryExpressionType).mockReturnValue("u8");
      vi.mocked(TypeResolver.isUnsignedType).mockReturnValue(true);

      const node = createMockUnaryNode("~c");
      const orchestrator = createMockOrchestrator("c");
      const result = generateUnaryExpr(
        node,
        mockInput,
        mockState,
        orchestrator,
      );

      expect(result.code).toBe("static_cast<uint8_t>(~c)");
      expect(result.effects).toEqual([]);
    });
  });

  describe("bitwise NOT on signed/unresolvable types", () => {
    it("should not cast ~i8 (signed type)", () => {
      vi.mocked(TypeResolver.getUnaryExpressionType).mockReturnValue("i8");
      vi.mocked(TypeResolver.isUnsignedType).mockReturnValue(false);

      const node = createMockUnaryNode("~c");
      const orchestrator = createMockOrchestrator("c");
      const result = generateUnaryExpr(
        node,
        mockInput,
        mockState,
        orchestrator,
      );

      expect(result.code).toBe("~c");
      expect(result.effects).toEqual([]);
    });

    it("should not cast when type is unresolvable", () => {
      vi.mocked(TypeResolver.getUnaryExpressionType).mockReturnValue(null);

      const node = createMockUnaryNode("~expr");
      const orchestrator = createMockOrchestrator("expr");
      const result = generateUnaryExpr(
        node,
        mockInput,
        mockState,
        orchestrator,
      );

      expect(result.code).toBe("~expr");
      expect(result.effects).toEqual([]);
    });
  });

  describe("other unary operators", () => {
    it("should generate logical NOT unchanged", () => {
      const node = createMockUnaryNode("!flag");
      const orchestrator = createMockOrchestrator("flag");
      const result = generateUnaryExpr(
        node,
        mockInput,
        mockState,
        orchestrator,
      );

      expect(result.code).toBe("!flag");
    });

    it("should generate negation unchanged", () => {
      const node = createMockUnaryNode("-x");
      const orchestrator = createMockOrchestrator("x");
      const result = generateUnaryExpr(
        node,
        mockInput,
        mockState,
        orchestrator,
      );

      expect(result.code).toBe("-x");
    });

    it("should generate address-of unchanged", () => {
      const node = createMockUnaryNode("&x");
      const orchestrator = createMockOrchestrator("x");
      const result = generateUnaryExpr(
        node,
        mockInput,
        mockState,
        orchestrator,
      );

      expect(result.code).toBe("&x");
    });
  });
});
