import { describe, it, expect, vi } from "vitest";
import ArrayDimensionUtils from "../ArrayDimensionUtils";
import IOrchestrator from "../../IOrchestrator";

describe("ArrayDimensionUtils", () => {
  const createMockOrchestrator = (
    constValue?: number,
    exprText = "EXPR",
  ): IOrchestrator => {
    return {
      tryEvaluateConstant: vi.fn().mockReturnValue(constValue),
      generateExpression: vi.fn().mockReturnValue(exprText),
    } as unknown as IOrchestrator;
  };

  describe("generateArrayTypeDimension", () => {
    it("returns empty string for null context", () => {
      const orchestrator = createMockOrchestrator();
      const result = ArrayDimensionUtils.generateArrayTypeDimension(
        null,
        orchestrator,
      );
      expect(result).toBe("");
    });

    it("returns [] for context with no expression", () => {
      const orchestrator = createMockOrchestrator();
      const ctx = {
        expression: () => null,
      };
      const result = ArrayDimensionUtils.generateArrayTypeDimension(
        ctx as never,
        orchestrator,
      );
      expect(result).toBe("[]");
    });

    it("returns constant dimension when evaluable", () => {
      const orchestrator = createMockOrchestrator(16);
      const ctx = {
        expression: () => ({ getText: () => "16" }),
      };
      const result = ArrayDimensionUtils.generateArrayTypeDimension(
        ctx as never,
        orchestrator,
      );
      expect(result).toBe("[16]");
      expect(orchestrator.tryEvaluateConstant).toHaveBeenCalled();
    });

    it("falls back to expression generation for non-constant", () => {
      const orchestrator = createMockOrchestrator(undefined, "BUFFER_SIZE");
      const mockExpr = { getText: () => "BUFFER_SIZE" };
      const ctx = {
        expression: () => mockExpr,
      };
      const result = ArrayDimensionUtils.generateArrayTypeDimension(
        ctx as never,
        orchestrator,
      );
      expect(result).toBe("[BUFFER_SIZE]");
      expect(orchestrator.generateExpression).toHaveBeenCalledWith(mockExpr);
    });
  });

  describe("generateStringCapacityDim", () => {
    it("returns empty string for non-string type", () => {
      const ctx = {
        stringType: () => null,
      };
      const result = ArrayDimensionUtils.generateStringCapacityDim(
        ctx as never,
      );
      expect(result).toBe("");
    });

    it("returns empty string for string without capacity", () => {
      const ctx = {
        stringType: () => ({
          INTEGER_LITERAL: () => null,
        }),
      };
      const result = ArrayDimensionUtils.generateStringCapacityDim(
        ctx as never,
      );
      expect(result).toBe("");
    });

    it("returns capacity + 1 for string with capacity", () => {
      const ctx = {
        stringType: () => ({
          INTEGER_LITERAL: () => ({
            getText: () => "32",
          }),
        }),
      };
      const result = ArrayDimensionUtils.generateStringCapacityDim(
        ctx as never,
      );
      expect(result).toBe("[33]");
    });

    it("handles various capacity values", () => {
      const testCases = [
        { input: "8", expected: "[9]" },
        { input: "64", expected: "[65]" },
        { input: "255", expected: "[256]" },
      ];

      for (const { input, expected } of testCases) {
        const ctx = {
          stringType: () => ({
            INTEGER_LITERAL: () => ({
              getText: () => input,
            }),
          }),
        };
        const result = ArrayDimensionUtils.generateStringCapacityDim(
          ctx as never,
        );
        expect(result).toBe(expected);
      }
    });
  });
});
