/**
 * Unit tests for UnaryExprGenerator
 *
 * Tests bitwise NOT (~) MISRA-compliant cast generation:
 * - Unsigned types get cast back to original type (MISRA 10.1/10.3)
 * - Signed types and unresolvable types are unchanged
 * - C++ mode uses static_cast
 *
 * #1445: the generator takes `{ operator, operandCode, operandType }`, so
 * there is no node to fake and no orchestrator to stand in for the recursion.
 * `ExpressionTypeResolver.getUnaryExpressionType` is no longer mocked here either -- it
 * moved to the caller, and the operand's type arrives through the thunk.
 * `isUnsignedType` is still the generator's, and still mocked.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import generateUnaryExpr from "../UnaryExprGenerator";
import type IGeneratorInput from "../../IGeneratorInput";
import type IGeneratorState from "../../IGeneratorState";
import type IOrchestrator from "../../IOrchestrator";
import CodeGenState from "../../../../../../transpiler/state/CodeGenState";

vi.mock("../../../../../2-Plan/ExpressionTypeResolver", () => {
  return {
    default: {
      isUnsignedType: vi.fn(),
    },
  };
});

import ExpressionTypeResolver from "../../../../../2-Plan/ExpressionTypeResolver";

// ========================================================================
// Test Helpers
// ========================================================================

const mockInput = {} as IGeneratorInput;
const mockState = {} as IGeneratorState;
const mockOrchestrator = {} as IOrchestrator;

/** The generator's whole input: an operator, the operand's code, its type. */
function planned(
  operator: "!" | "-" | "~" | "&" | null,
  operandCode: string,
  operandType: string | null = null,
) {
  return { operator, operandCode, operandType: () => operandType };
}

const run = (
  operator: "!" | "-" | "~" | "&" | null,
  operandCode: string,
  operandType: string | null = null,
) =>
  generateUnaryExpr(
    planned(operator, operandCode, operandType),
    mockInput,
    mockState,
    mockOrchestrator,
  );

// ========================================================================
// Tests
// ========================================================================

describe("UnaryExprGenerator", () => {
  afterEach(() => {
    vi.mocked(ExpressionTypeResolver.isUnsignedType).mockReset();
    CodeGenState.cppMode = false;
  });

  describe("bitwise NOT on unsigned types", () => {
    it("should cast ~u8 to (uint8_t)~c in C mode", () => {
      vi.mocked(ExpressionTypeResolver.isUnsignedType).mockReturnValue(true);

      const result = run("~", "c", "u8");

      expect(result.code).toBe("(uint8_t)~c");
      expect(result.effects).toEqual([]);
    });

    it("should cast ~u16 to (uint16_t)~c in C mode", () => {
      vi.mocked(ExpressionTypeResolver.isUnsignedType).mockReturnValue(true);

      const result = run("~", "c", "u16");

      expect(result.code).toBe("(uint16_t)~c");
      expect(result.effects).toEqual([]);
    });

    it("should use static_cast in C++ mode", () => {
      CodeGenState.cppMode = true;
      vi.mocked(ExpressionTypeResolver.isUnsignedType).mockReturnValue(true);

      const result = run("~", "c", "u8");

      expect(result.code).toBe("static_cast<uint8_t>(~c)");
      expect(result.effects).toEqual([]);
    });
  });

  describe("bitwise NOT on signed/unresolvable types", () => {
    it("should not cast ~i8 (signed type)", () => {
      vi.mocked(ExpressionTypeResolver.isUnsignedType).mockReturnValue(false);

      const result = run("~", "c", "i8");

      expect(result.code).toBe("~c");
      expect(result.effects).toEqual([]);
    });

    it("should not cast when type is unresolvable", () => {
      const result = run("~", "expr", null);

      expect(result.code).toBe("~expr");
      expect(result.effects).toEqual([]);
    });
  });

  describe("other unary operators", () => {
    it.each([
      ["should generate logical NOT unchanged", "!", "flag", "!flag"],
      ["should generate negation unchanged", "-", "x", "-x"],
      ["should generate address-of unchanged", "&", "x", "&x"],
    ] as const)("%s", (_label, operator, operandCode, expected) => {
      expect(run(operator, operandCode).code).toBe(expected);
    });

    it("returns the operand unchanged when there is no operator", () => {
      // #1445: null covers the base case (operand is a postfix expression) and
      // the grammar-impossible fallback. Both returned the operand before.
      expect(run(null, "someValue").code).toBe("someValue");
    });
  });
});
