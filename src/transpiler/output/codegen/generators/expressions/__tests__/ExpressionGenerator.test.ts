import { describe, it, expect, vi } from "vitest";
import expressionGenerators from "../ExpressionGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Create a mock OrExpressionContext with getText for debugging.
 */
function createMockOrExpr(text: string): Parser.OrExpressionContext {
  return {
    getText: () => text,
  } as unknown as Parser.OrExpressionContext;
}

/**
 * Create a mock TernaryExpressionContext with the specified orExpressions.
 *
 * Note: The C-Next grammar guarantees orExprs.length is either 1 (non-ternary)
 * or 3 (ternary: condition, trueExpr, falseExpr). Other lengths are not possible.
 *
 * For non-ternary: pass 1 orExpression
 * For ternary: pass 3 orExpressions (condition, true, false)
 */
function createMockTernaryContext(
  orExpressions: Parser.OrExpressionContext[],
): Parser.TernaryExpressionContext {
  return {
    orExpression: () => orExpressions,
  } as unknown as Parser.TernaryExpressionContext;
}

/**
 * Create a mock ExpressionContext that wraps a TernaryExpressionContext.
 */
function createMockExpressionContext(
  ternaryCtx: Parser.TernaryExpressionContext,
): Parser.ExpressionContext {
  return {
    ternaryExpression: () => ternaryCtx,
  } as unknown as Parser.ExpressionContext;
}

/**
 * Create minimal mock input.
 */
function createMockInput(): IGeneratorInput {
  return {
    symbols: null,
    symbolTable: null,
    typeRegistry: new Map(),
    functionSignatures: new Map(),
    knownFunctions: new Set(),
    knownStructs: new Set(),
    constValues: new Map(),
    callbackTypes: new Map(),
    callbackFieldTypes: new Map(),
    targetCapabilities: { hasAtomicSupport: false },
    debugMode: false,
  } as unknown as IGeneratorInput;
}

/**
 * Create minimal mock state.
 */
function createMockState(): IGeneratorState {
  return {
    currentScope: null,
    indentLevel: 0,
    inFunctionBody: false,
    currentParameters: new Map(),
    localVariables: new Set(),
    localArrays: new Set(),
    expectedType: null,
    selfIncludeAdded: false,
    scopeMembers: new Map(),
    mainArgsName: null,
    floatBitShadows: new Set(),
    floatShadowCurrent: new Set(),
    lengthCache: null,
  };
}

/**
 * Create a mock orchestrator with configurable behavior.
 */
function createMockOrchestrator(
  orExprResults: Map<Parser.OrExpressionContext, string> = new Map(),
): IOrchestrator {
  return {
    generateOrExpr: vi.fn((ctx: Parser.OrExpressionContext) => {
      return orExprResults.get(ctx) ?? ctx.getText();
    }),
    validateTernaryCondition: vi.fn(),
    validateNoNestedTernary: vi.fn(),
    validateTernaryConditionNoFunctionCall: vi.fn(),
  } as unknown as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("ExpressionGenerator", () => {
  describe("generateExpression", () => {
    it("delegates to generateTernaryExpr via node.ternaryExpression()", () => {
      const orExpr = createMockOrExpr("x + 1");
      const ternaryCtx = createMockTernaryContext([orExpr]);
      const exprCtx = createMockExpressionContext(ternaryCtx);

      const input = createMockInput();
      const state = createMockState();
      const orExprResults = new Map([[orExpr, "x + 1"]]);
      const orchestrator = createMockOrchestrator(orExprResults);

      const result = expressionGenerators.generateExpression(
        exprCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("x + 1");
      expect(result.effects).toEqual([]);
      expect(orchestrator.generateOrExpr).toHaveBeenCalledWith(orExpr);
    });
  });

  describe("generateTernaryExpr", () => {
    describe("non-ternary path (single orExpression)", () => {
      it("generates code for single expression", () => {
        const orExpr = createMockOrExpr("42");
        const ctx = createMockTernaryContext([orExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orExprResults = new Map([[orExpr, "42"]]);
        const orchestrator = createMockOrchestrator(orExprResults);

        const result = expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(result.code).toBe("42");
        expect(result.effects).toEqual([]);
      });

      it("delegates to orchestrator.generateOrExpr", () => {
        const orExpr = createMockOrExpr("a * b");
        const ctx = createMockTernaryContext([orExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orExprResults = new Map([[orExpr, "a * b"]]);
        const orchestrator = createMockOrchestrator(orExprResults);

        expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(orchestrator.generateOrExpr).toHaveBeenCalledWith(orExpr);
        expect(orchestrator.generateOrExpr).toHaveBeenCalledTimes(1);
      });

      it("does not call ternary validations for non-ternary", () => {
        const orExpr = createMockOrExpr("value");
        const ctx = createMockTernaryContext([orExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(orchestrator.validateTernaryCondition).not.toHaveBeenCalled();
        expect(orchestrator.validateNoNestedTernary).not.toHaveBeenCalled();
        expect(
          orchestrator.validateTernaryConditionNoFunctionCall,
        ).not.toHaveBeenCalled();
      });
    });

    describe("ternary path (ADR-022)", () => {
      it("generates ternary expression with parentheses", () => {
        const condition = createMockOrExpr("x > 0");
        const trueExpr = createMockOrExpr("1");
        const falseExpr = createMockOrExpr("0");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orExprResults = new Map([
          [condition, "x > 0"],
          [trueExpr, "1"],
          [falseExpr, "0"],
        ]);
        const orchestrator = createMockOrchestrator(orExprResults);

        const result = expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(result.code).toBe("(x > 0) ? 1 : 0");
        expect(result.effects).toEqual([]);
      });

      it("calls generateOrExpr for all three branches", () => {
        // ADR-001: C-Next uses "=" for equality, which maps to C's "=="
        // The orchestrator's generateOrExpr handles this translation
        const condition = createMockOrExpr("a = b");
        const trueExpr = createMockOrExpr("yes");
        const falseExpr = createMockOrExpr("no");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();
        // Mock returns "a == b" to simulate the ADR-001 translation
        const orExprResults = new Map([
          [condition, "a == b"],
          [trueExpr, "yes"],
          [falseExpr, "no"],
        ]);
        const orchestrator = createMockOrchestrator(orExprResults);

        expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(orchestrator.generateOrExpr).toHaveBeenCalledWith(condition);
        expect(orchestrator.generateOrExpr).toHaveBeenCalledWith(trueExpr);
        expect(orchestrator.generateOrExpr).toHaveBeenCalledWith(falseExpr);
        expect(orchestrator.generateOrExpr).toHaveBeenCalledTimes(3);
      });

      it("validates ternary condition is a comparison (ADR-022)", () => {
        const condition = createMockOrExpr("x > 0");
        const trueExpr = createMockOrExpr("a");
        const falseExpr = createMockOrExpr("b");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(orchestrator.validateTernaryCondition).toHaveBeenCalledWith(
          condition,
        );
      });

      it("validates no nested ternary in true branch (ADR-022)", () => {
        const condition = createMockOrExpr("x > 0");
        const trueExpr = createMockOrExpr("a");
        const falseExpr = createMockOrExpr("b");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(orchestrator.validateNoNestedTernary).toHaveBeenCalledWith(
          trueExpr,
          "true branch",
        );
      });

      it("validates no nested ternary in false branch (ADR-022)", () => {
        const condition = createMockOrExpr("x > 0");
        const trueExpr = createMockOrExpr("a");
        const falseExpr = createMockOrExpr("b");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(orchestrator.validateNoNestedTernary).toHaveBeenCalledWith(
          falseExpr,
          "false branch",
        );
      });

      it("validates no function calls in condition (Issue #254, E0702)", () => {
        const condition = createMockOrExpr("isReady()");
        const trueExpr = createMockOrExpr("a");
        const falseExpr = createMockOrExpr("b");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(
          orchestrator.validateTernaryConditionNoFunctionCall,
        ).toHaveBeenCalledWith(condition);
      });

      it("handles complex expressions in ternary branches", () => {
        const condition = createMockOrExpr("a + b > c * d");
        const trueExpr = createMockOrExpr("x + y");
        const falseExpr = createMockOrExpr("z - w");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orExprResults = new Map([
          [condition, "a + b > c * d"],
          [trueExpr, "x + y"],
          [falseExpr, "z - w"],
        ]);
        const orchestrator = createMockOrchestrator(orExprResults);

        const result = expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(result.code).toBe("(a + b > c * d) ? x + y : z - w");
      });
    });

    describe("validation error propagation", () => {
      it("propagates error when validateTernaryCondition throws", () => {
        const condition = createMockOrExpr("flag");
        const trueExpr = createMockOrExpr("a");
        const falseExpr = createMockOrExpr("b");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();
        (
          orchestrator.validateTernaryCondition as ReturnType<typeof vi.fn>
        ).mockImplementation(() => {
          throw new Error("Error: Ternary condition must be a comparison");
        });

        expect(() =>
          expressionGenerators.generateTernaryExpr(
            ctx,
            input,
            state,
            orchestrator,
          ),
        ).toThrow("Error: Ternary condition must be a comparison");
      });

      it("propagates error when validateNoNestedTernary throws", () => {
        const condition = createMockOrExpr("x > 0");
        const trueExpr = createMockOrExpr("nested ? a : b");
        const falseExpr = createMockOrExpr("c");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();
        (
          orchestrator.validateNoNestedTernary as ReturnType<typeof vi.fn>
        ).mockImplementation((_expr, branch) => {
          if (branch === "true branch") {
            throw new Error("Error: Nested ternary not allowed in true branch");
          }
        });

        expect(() =>
          expressionGenerators.generateTernaryExpr(
            ctx,
            input,
            state,
            orchestrator,
          ),
        ).toThrow("Error: Nested ternary not allowed in true branch");
      });

      it("propagates error when validateTernaryConditionNoFunctionCall throws", () => {
        const condition = createMockOrExpr("isReady()");
        const trueExpr = createMockOrExpr("a");
        const falseExpr = createMockOrExpr("b");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();
        (
          orchestrator.validateTernaryConditionNoFunctionCall as ReturnType<
            typeof vi.fn
          >
        ).mockImplementation(() => {
          throw new Error(
            "Error[E0702]: Function calls not allowed in ternary condition",
          );
        });

        expect(() =>
          expressionGenerators.generateTernaryExpr(
            ctx,
            input,
            state,
            orchestrator,
          ),
        ).toThrow(
          "Error[E0702]: Function calls not allowed in ternary condition",
        );
      });
    });

    describe("effects", () => {
      it("returns empty effects array for non-ternary", () => {
        const orExpr = createMockOrExpr("value");
        const ctx = createMockTernaryContext([orExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(result.effects).toEqual([]);
      });

      it("returns empty effects array for ternary", () => {
        const condition = createMockOrExpr("x > 0");
        const trueExpr = createMockOrExpr("1");
        const falseExpr = createMockOrExpr("0");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(result.effects).toEqual([]);
      });
    });
  });
});
