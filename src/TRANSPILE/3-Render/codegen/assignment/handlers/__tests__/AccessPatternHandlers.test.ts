/**
 * Unit tests for AccessPatternHandlers.
 * Tests global/this access and member chain handler functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import accessPatternHandlers from "../AccessPatternHandlers";
import AssignmentKind from "../../../../../../transpiler/types/AssignmentKind";
import IAssignmentContext from "../../../../../../transpiler/types/IAssignmentContext";
import RenderState from "../../../../RenderState";
import HandlerTestUtils from "./handlerTestUtils";
import enterScope from "../../../../../../transpiler/__tests__/enterScope";

/**
 * Create mock context for testing.
 */
function createMockContext(
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  // Default resolved values based on first identifier
  const identifiers = overrides.identifiers ?? ["Counter", "value"];
  const resolvedTarget =
    overrides.resolvedTarget ?? `${identifiers.join("__")}`;
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? identifiers[0];

  return {
    identifiers,
    ...HandlerTestUtils.subscriptsOf([]),
    isCompound: false,
    cnextOp: "<-",
    cOp: "=",
    generatedValue: "5",
    // #1445: renders, not nodes -- each delegates to the mocked generator the
    // cases already configure, so a case that overrides
    // `generateAssignmentTarget` or `analyzeMemberChainForBitAccess` still
    // controls what this returns.
    renderTarget: () =>
      HandlerTestUtils.planner().generateAssignmentTarget(null as never),
    analyzeTargetForBitAccess: () =>
      HandlerTestUtils.planner().analyzeMemberChainForBitAccess(null as never),
    targetLine: 1,
    hasValue: true,
    valueExpressionType: () => null,
    valueIntegerType: () => null,
    foldValue: () =>
      HandlerTestUtils.planner().tryEvaluateConstant(null as never),
    postfixOps: [],
    hasThis: false,
    hasGlobal: true,
    hasMemberAccess: true,
    hasArrayAccess: false,
    postfixOpsCount: 1,
    memberAccessDepth: 1,
    subscriptDepth: 0,
    isSimpleIdentifier: false,
    isSimpleThisAccess: false,
    isSimpleGlobalAccess: false,
    resolvedTarget,
    resolvedBaseIdentifier,
    // #1452 box 4: a handler reaches 2.3's per-file state through the context
    // it is handed, so the mock context carries the same instance the test
    // set its facts up on.
    state,
    ...overrides,
  } as IAssignmentContext;
}

let state = new RenderState();

describe("AccessPatternHandlers", () => {
  beforeEach(() => {
    state = new RenderState();
    HandlerTestUtils.setupMockGenerator(state);
    HandlerTestUtils.setupMockSymbols(state);
  });

  describe("handler registration", () => {
    it("registers all expected access pattern kinds", () => {
      const kinds = accessPatternHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.GLOBAL_MEMBER);
      expect(kinds).toContain(AssignmentKind.GLOBAL_ARRAY);
      expect(kinds).toContain(AssignmentKind.THIS_MEMBER);
      expect(kinds).toContain(AssignmentKind.MEMBER_CHAIN);
    });

    it("exports exactly 4 handlers", () => {
      expect(accessPatternHandlers).toHaveLength(4);
    });

    it("uses same handler for GLOBAL_MEMBER and GLOBAL_ARRAY", () => {
      const globalMemberHandler = accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.GLOBAL_MEMBER,
      )?.[1];
      const globalArrayHandler = accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.GLOBAL_ARRAY,
      )?.[1];

      expect(globalMemberHandler).toBe(globalArrayHandler);
    });

    it("registers a handler for THIS_MEMBER", () => {
      // Issue #1115: THIS_ARRAY retired, so THIS_MEMBER is the only `this.`
      // kind this module serves. Subscripted `this.` targets classify as the
      // general array/bit kinds handled elsewhere.
      const thisMemberHandler = accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.THIS_MEMBER,
      )?.[1];

      expect(thisMemberHandler).toBeDefined();
    });
  });

  describe("handleGlobalAccess (GLOBAL_ARRAY)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.GLOBAL_ARRAY,
      )?.[1];

    it("generates standard assignment for global member", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("Counter__value"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(result).toBe("Counter__value = 5;");
    });

    it("handles compound assignment", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("Counter__value"),
      });
      const ctx = createMockContext({
        isCompound: true,
        cOp: "+=",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("Counter__value += 5;");
    });
  });

  describe("handleGlobalAccess (GLOBAL_ARRAY)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.GLOBAL_MEMBER,
      )?.[1];

    it("generates array element assignment", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("Buffer_data[i]"),
      });
      const ctx = createMockContext({
        identifiers: ["Buffer", "data"],
        ...HandlerTestUtils.subscriptsOf([{ mockValue: "i" } as never]),
        hasArrayAccess: true,
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("Buffer_data[i] = 5;");
    });
  });

  describe("handleThisAccess (THIS_MEMBER)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.THIS_MEMBER,
      )?.[1];

    it("generates scoped member assignment", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("Motor__speed"),
      });
      const ctx = createMockContext({
        identifiers: ["speed"],
        hasThis: true,
        hasGlobal: false,
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("Motor__speed = 5;");
    });

    // #1322a: the `'this' outside a scope` guard this asserted is deleted. It
    // was unreachable -- `this.x <- 5` at file scope is a PARSE error, so the
    // assignment never reaches codegen -- and this test reached it only by
    // calling the handler directly with state production cannot produce. A test
    // that is a dead branch's only caller is what keeps the branch alive.

    it("handles compound assignment", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("Motor_count"),
      });
      const ctx = createMockContext({
        identifiers: ["count"],
        hasThis: true,
        hasGlobal: false,
        isCompound: true,
        cOp: "-=",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("Motor_count -= 5;");
    });
  });

  describe("handleThisAccess (THIS_MEMBER)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.THIS_MEMBER,
      )?.[1];

    it("generates scoped array element assignment", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("Motor_items[0]"),
      });
      const ctx = createMockContext({
        identifiers: ["items"],
        ...HandlerTestUtils.subscriptsOf([{ mockValue: "0" } as never]),
        hasThis: true,
        hasGlobal: false,
        hasArrayAccess: true,
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("Motor_items[0] = 5;");
    });
  });

  describe("handleMemberChain (MEMBER_CHAIN)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.MEMBER_CHAIN,
      )?.[1];

    it("generates standard member chain assignment", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi
          .fn()
          .mockReturnValue("device.config.value"),
        analyzeMemberChainForBitAccess: vi
          .fn()
          .mockReturnValue({ isBitAccess: false }),
      });
      const ctx = createMockContext({
        identifiers: ["device", "config", "value"],
        memberAccessDepth: 2,
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("device.config.value = 5;");
    });

    it("generates bit access when detected in member chain", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        analyzeMemberChainForBitAccess: vi.fn().mockReturnValue({
          isBitAccess: true,
          baseTarget: "grid[2][3].flags",
          bitIndex: "0",
          baseType: "u32",
        }),
      });
      const ctx = createMockContext({
        identifiers: ["grid", "flags"],
        ...HandlerTestUtils.subscriptsOf([{ mockValue: "0" } as never]),
        generatedValue: "true",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("grid[2][3].flags =");
      expect(result).toContain("& ~(1U << 0)");
      expect(result).toContain("1U << 0");
    });

    it("uses 1ULL for 64-bit bit access", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        analyzeMemberChainForBitAccess: vi.fn().mockReturnValue({
          isBitAccess: true,
          baseTarget: "data.flags",
          bitIndex: "bit",
          baseType: "u64",
        }),
      });
      const ctx = createMockContext({
        identifiers: ["data", "flags"],
        ...HandlerTestUtils.subscriptsOf([{ mockValue: "bit" } as never]),
        generatedValue: "false",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("1ULL << bit");
    });

    // #1322: compound assignment on a bit index, bit range, slice, bitmap field
    // or string is E0857 in pass 2.1 -- one decision where `output/` had six
    // throws with four messages, and `validateNotCompound` defined twice verbatim.
    // The pipeline halts before these handlers run. Covered by
    // `1-Analyze/__tests__/CompoundAssignmentAnalyzer.test.ts` plus
    // `tests/compound-assign/` and `tests/string-assignment/`.

    it("handles compound assignment for normal member chain", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget: vi.fn().mockReturnValue("obj.field"),
        analyzeMemberChainForBitAccess: vi
          .fn()
          .mockReturnValue({ isBitAccess: false }),
      });
      const ctx = createMockContext({
        identifiers: ["obj", "field"],
        isCompound: true,
        cOp: "*=",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("obj.field *= 5;");
    });
  });
});
