import { describe, it, expect, vi, beforeEach } from "vitest";
import expressionGenerators from "../ExpressionGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";
import CodeGenState from "../../../../../state/CodeGenState";
import TestGeneratorState from "../../__tests__/testGeneratorState";

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
  return TestGeneratorState.create();
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

        expect(orchestrator.generateOrExpr).toHaveBeenCalled();
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

        expect(orchestrator.generateOrExpr).toHaveBeenCalledWith(condition);
      });

      // #1322: the two "validates no nested ternary in <branch> branch" tests
      // that stood here are gone with the call they asserted. Removing only
      // their `expect` would have left two tests that run the generator and
      // assert nothing -- green forever, whatever the generator did. ADR-022's
      // rule is E0710 in `1-Analyze/__tests__/NestedTernaryAnalyzer.test.ts`.
      // #1322: the E0702 delegation test that stood here is gone with the
      // call. ADR-022's controlling-expression rules -- E0701 and E0702 -- are
      // authored in pass 2.1, which halts before codegen runs. Deleted rather
      // than emptied: an `it` that runs the generator and asserts nothing is
      // green whatever the generator does.

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

    // #1322: the "validation error propagation" suite that stood here is gone.
    // Its two cases asserted that `generateTernaryExpr` propagates a throw from
    // `validateTernaryCondition` and from `validateTernaryConditionNoFunctionCall`;
    // ADR-022's controlling-expression rules are E0701/E0702 in pass 2.1, which
    // halts before codegen runs, so there is no throw left to propagate. The
    // empty `describe` went too -- vitest fails a suite with no tests, which is
    // the right answer to a container that asserts nothing.

    describe("inDeclarationInit clearing (Issue #992)", () => {
      beforeEach(() => {
        CodeGenState.reset();
      });

      it("clears inDeclarationInit in ternary true and false arms", () => {
        CodeGenState.inDeclarationInit = true;

        const condition = createMockOrExpr("x > 0");
        const trueExpr = createMockOrExpr("a");
        const falseExpr = createMockOrExpr("b");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();

        const flagDuringTrue: boolean[] = [];
        const flagDuringFalse: boolean[] = [];

        const orchestrator = createMockOrchestrator();
        let callCount = 0;
        (
          orchestrator.generateOrExpr as ReturnType<typeof vi.fn>
        ).mockImplementation((ctx: Parser.OrExpressionContext) => {
          callCount++;
          if (callCount === 2) {
            flagDuringTrue.push(CodeGenState.inDeclarationInit);
          } else if (callCount === 3) {
            flagDuringFalse.push(CodeGenState.inDeclarationInit);
          }
          return ctx.getText();
        });

        expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(flagDuringTrue).toEqual([false]);
        expect(flagDuringFalse).toEqual([false]);
        expect(CodeGenState.inDeclarationInit).toBe(true);
      });

      it("does not affect condition generation", () => {
        CodeGenState.inDeclarationInit = true;

        const condition = createMockOrExpr("x > 0");
        const trueExpr = createMockOrExpr("a");
        const falseExpr = createMockOrExpr("b");
        const ctx = createMockTernaryContext([condition, trueExpr, falseExpr]);

        const input = createMockInput();
        const state = createMockState();

        let flagDuringCondition = false;
        const orchestrator = createMockOrchestrator();
        let callCount = 0;
        (
          orchestrator.generateOrExpr as ReturnType<typeof vi.fn>
        ).mockImplementation((ctx: Parser.OrExpressionContext) => {
          callCount++;
          if (callCount === 1) {
            flagDuringCondition = CodeGenState.inDeclarationInit;
          }
          return ctx.getText();
        });

        expressionGenerators.generateTernaryExpr(
          ctx,
          input,
          state,
          orchestrator,
        );

        expect(flagDuringCondition).toBe(true);
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
