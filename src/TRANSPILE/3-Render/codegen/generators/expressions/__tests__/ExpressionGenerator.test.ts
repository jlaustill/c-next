/**
 * Unit tests for the ternary expression generator.
 *
 * #1445: the generator takes `TPlannedTernary`, so these build plans instead
 * of mock contexts cast `as unknown as`. What moved out with the contexts is
 * `CodeGenerator.planTernary` -- the child-count discrimination, which the
 * 1259 integration fixtures exercise.
 *
 * The thunks also let the Issue #992 tests assert the flag from INSIDE the
 * render rather than by counting orchestrator calls, which is what they were
 * reaching for through a `callCount === 2` branch.
 */

import { describe, it, expect, beforeEach } from "vitest";
import generateTernaryExpr from "../ExpressionGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import CodeGenState from "../../../../../../transpiler/state/CodeGenState";
import TestGeneratorState from "../../__tests__/testGeneratorState";
import type TPlannedTernary from "../../../types/TPlannedTernary";
import RenderState from "../../../../../../transpiler/state/RenderState";

/** Minimal mock input. */
function createMockInput(): IGeneratorInput {
  return {
    symbols: null,
    symbolTable: null,
    typeRegistry: new Map(),
    functionSignatures: new Map(),
    knownFunctions: new Set(),
    knownStructs: new Set(),
    knownScopes: new Set<string>(),
    constValues: new Map(),
    callbackTypes: new Map(),
    callbackFieldTypes: new Map(),
    targetCapabilities: { hasAtomicSupport: false },
    debugMode: false,
  } as unknown as IGeneratorInput;
}

function createMockState(): IGeneratorState {
  return TestGeneratorState.create();
}

/**
 * The generator names the orchestrator and reads nothing from it -- every
 * operand arrives already planned -- so an empty object is the honest mock.
 */
function createMockOrchestrator(): IOrchestrator {
  return {} as unknown as IOrchestrator;
}

/**
 * #1452: the generator reads `inDeclarationInit` off the orchestrator's state
 * now, so the mock and the assertions share ONE instance -- otherwise the test
 * would set a flag on an object the generator never sees.
 */
let renderState = new RenderState();

/** Run the generator on a plan. */
function generate(planned: TPlannedTernary) {
  return generateTernaryExpr(planned, createMockInput(), createMockState(), {
    ...createMockOrchestrator(),
    state: renderState,
  } as IOrchestrator);
}

describe("generateTernaryExpr", () => {
  describe("non-ternary path (a single operand)", () => {
    it.each([
      ["a literal", "42"],
      ["a product", "a * b"],
    ])("passes %s through unchanged", (_label, code) => {
      const result = generate({ kind: "value", code });

      expect(result.code).toBe(code);
      expect(result.effects).toEqual([]);
    });
  });

  describe("ternary path (ADR-022)", () => {
    it("wraps the condition in parentheses", () => {
      const result = generate({
        kind: "ternary",
        renderCondition: () => "x > 0",
        renderTrue: () => "1",
        renderFalse: () => "0",
      });

      expect(result.code).toBe("(x > 0) ? 1 : 0");
      expect(result.effects).toEqual([]);
    });

    it("renders each arm exactly once", () => {
      const rendered: string[] = [];

      generate({
        kind: "ternary",
        // ADR-001: C-Next uses "=" for equality, which maps to C's "==". That
        // translation is the operand generator's, so the plan carries its
        // result.
        renderCondition: () => {
          rendered.push("condition");
          return "a == b";
        },
        renderTrue: () => {
          rendered.push("true");
          return "yes";
        },
        renderFalse: () => {
          rendered.push("false");
          return "no";
        },
      });

      expect(rendered).toEqual(["condition", "true", "false"]);
    });

    it("handles complex expressions in both arms", () => {
      const result = generate({
        kind: "ternary",
        renderCondition: () => "a + b > c * d",
        renderTrue: () => "x + y",
        renderFalse: () => "z - w",
      });

      expect(result.code).toBe("(a + b > c * d) ? x + y : z - w");
    });
  });

  describe("inDeclarationInit clearing (Issue #992)", () => {
    beforeEach(() => {
      CodeGenState.reset();
      renderState = new RenderState();
    });

    it("clears the flag in both arms and restores it after", () => {
      renderState.inDeclarationInit = true;
      const seen: Record<string, boolean> = {};

      generate({
        kind: "ternary",
        renderCondition: () => {
          seen.condition = renderState.inDeclarationInit;
          return "x > 0";
        },
        renderTrue: () => {
          seen.trueArm = renderState.inDeclarationInit;
          return "a";
        },
        renderFalse: () => {
          seen.falseArm = renderState.inDeclarationInit;
          return "b";
        },
      });

      // The condition keeps the flag as it stands; only the arms clear it.
      expect(seen).toEqual({
        condition: true,
        trueArm: false,
        falseArm: false,
      });
      expect(renderState.inDeclarationInit).toBe(true);
    });
  });

  describe("effects", () => {
    it("returns an empty effects array", () => {
      expect(generate({ kind: "value", code: "value" }).effects).toEqual([]);
    });
  });
});
