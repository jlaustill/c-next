/**
 * Unit tests for SpecialHandlers.
 * Tests atomic RMW and overflow clamp handler functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import specialHandlers from "../SpecialHandlers";
import AssignmentKind from "../../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../../2-Plan/types/IAssignmentContext";
import TranspileState from "../../../../../TranspileState";
import HandlerTestUtils from "./handlerTestUtils";
import enterScope from "../../../../../../cli/__tests__/enterScope";

/**
 * Create mock context for testing.
 */
function createMockContext(
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  // Default resolved values based on first identifier
  const identifiers = overrides.identifiers ?? ["counter"];
  const resolvedTarget = overrides.resolvedTarget ?? identifiers[0];
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? identifiers[0];

  const ctx = {
    identifiers,
    ...HandlerTestUtils.subscriptsOf([]),
    isCompound: true,
    cnextOp: "+<-",
    cOp: "+=",
    generatedValue: "1",
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
    valueHasFloatingOperand: () => false,
    foldValue: () =>
      HandlerTestUtils.planner().tryEvaluateConstant(null as never),
    postfixOps: [],
    hasThis: false,
    hasGlobal: false,
    hasMemberAccess: false,
    hasArrayAccess: false,
    postfixOpsCount: 0,
    memberAccessDepth: 0,
    subscriptDepth: 0,
    isSimpleIdentifier: true,
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
  // #1668 (C7): what the target writes, as the binder would bind it
  return {
    ...ctx,
    target: overrides.target ?? HandlerTestUtils.targetOf(state, ctx),
  };
}

let state = new TranspileState();

describe("SpecialHandlers", () => {
  beforeEach(() => {
    state = new TranspileState();
    HandlerTestUtils.setupMockGenerator(state);
    HandlerTestUtils.setupMockSymbols(state);
  });

  describe("handler registration", () => {
    it("registers all expected special assignment kinds", () => {
      const kinds = specialHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.ATOMIC_RMW);
      expect(kinds).toContain(AssignmentKind.OVERFLOW_CLAMP);
    });

    it("exports exactly 2 handlers", () => {
      expect(specialHandlers).toHaveLength(2);
    });
  });

  describe("handleAtomicRMW (ATOMIC_RMW)", () => {
    const getHandler = () =>
      specialHandlers.find(([kind]) => kind === AssignmentKind.ATOMIC_RMW)?.[1];

    it("delegates to generateAtomicRMW for simple identifier", () => {
      HandlerTestUtils.declareTypes(state, [
        ["counter", { baseType: "u32", isAtomic: true }],
      ]);
      const generateAtomicRMW = vi.fn().mockReturnValue("LDREX/STREX pattern");
      const generateAssignmentTarget = vi.fn().mockReturnValue("counter");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAtomicRMW,
        generateAssignmentTarget,
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(generateAtomicRMW).toHaveBeenCalledWith(
        "counter",
        "+=",
        "1",
        expect.objectContaining({
          baseType: "u32",
          isAtomic: true,
        }),
        null,
      );
      expect(result).toBe("LDREX/STREX pattern");
    });

    it("handles this.member atomic variable", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.declareTypes(state, [
        ["Motor__count", { baseType: "u32", isAtomic: true }],
      ]);
      const generateAtomicRMW = vi.fn().mockReturnValue("atomic result");
      const generateAssignmentTarget = vi.fn().mockReturnValue("Motor__count");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAtomicRMW,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["count"],
        isSimpleIdentifier: false,
        isSimpleThisAccess: true,
      });

      const result = getHandler()!(ctx);

      expect(generateAtomicRMW).toHaveBeenCalledWith(
        "Motor__count",
        "+=",
        "1",
        expect.objectContaining({
          baseType: "u32",
          isAtomic: true,
        }),
        null,
      );
      expect(result).toBe("atomic result");
    });

    // #1357: qualify through the whole scope chain, not the leaf.
    // `setCurrentScopeByPath("Outer.Inner")` resolves a scope whose parent is
    // `Outer`, and the type registry is populated through the chain-walking
    // encoder (TypeRegistrationEngine -> QualifiedNameGenerator.forMember). A
    // handler that joins `currentScopePath.name` asks for `Inner__count` and misses.
    //
    // Not reachable from .cnx: `scopeMember` admits no `scopeDeclaration`
    // (grammar/CNext.g4:81-89), so no fixture can build depth two. It is
    // reachable here because `SymbolRegistry.getOrCreateScope` takes a dotted
    // path, which makes this the only level the encoder can be proven at.
    //
    // Negative control: "handles this.member atomic variable" above, which
    // asserts the depth-one case still qualifies as `Motor__count`. A change
    // that dropped the scope entirely would pass this test and fail that one.
    it("qualifies a this.member atomic variable through the whole scope chain", () => {
      enterScope(state, "Outer.Inner");
      HandlerTestUtils.declareTypes(state, [
        ["Outer__Inner__count", { baseType: "u32", isAtomic: true }],
      ]);
      const generateAtomicRMW = vi.fn().mockReturnValue("atomic result");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAtomicRMW,
        generateAssignmentTarget: vi
          .fn()
          .mockReturnValue("Outer__Inner__count"),
      });
      const ctx = createMockContext({
        identifiers: ["count"],
        isSimpleIdentifier: false,
        isSimpleThisAccess: true,
      });

      getHandler()!(ctx);

      expect(generateAtomicRMW).toHaveBeenCalledWith(
        "Outer__Inner__count",
        "+=",
        "1",
        expect.objectContaining({ baseType: "u32", isAtomic: true }),
        null,
      );
    });

    it("handles global.member atomic variable", () => {
      HandlerTestUtils.declareTypes(state, [
        ["globalCounter", { baseType: "u32", isAtomic: true }],
      ]);
      const generateAtomicRMW = vi.fn().mockReturnValue("global atomic result");
      const generateAssignmentTarget = vi.fn().mockReturnValue("globalCounter");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAtomicRMW,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["globalCounter"],
        isSimpleIdentifier: false,
        isSimpleGlobalAccess: true,
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("global atomic result");
    });

    it("handles subtract operation", () => {
      HandlerTestUtils.declareTypes(state, [
        ["counter", { baseType: "u32", isAtomic: true }],
      ]);
      const generateAtomicRMW = vi.fn().mockReturnValue("atomic sub");
      const generateAssignmentTarget = vi.fn().mockReturnValue("counter");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAtomicRMW,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        cnextOp: "-<-",
        cOp: "-=",
      });

      getHandler()!(ctx);

      expect(generateAtomicRMW).toHaveBeenCalledWith(
        "counter",
        "-=",
        "1",
        expect.anything(),
        null,
      );
    });
  });

  describe("handleOverflowClamp (OVERFLOW_CLAMP)", () => {
    const getHandler = () =>
      specialHandlers.find(
        ([kind]) => kind === AssignmentKind.OVERFLOW_CLAMP,
      )?.[1];

    it("generates clamp add helper for u8", () => {
      HandlerTestUtils.declareTypes(state, [
        ["saturated", { baseType: "u8", overflowBehavior: "clamp" }],
      ]);
      const generateAssignmentTarget = vi.fn().mockReturnValue("saturated");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["saturated"],
        generatedValue: "200",
      });

      const result = getHandler()!(ctx);

      expect(state.usedClampOps.has("add_u8")).toBe(true);
      expect(result).toBe("saturated = cnx_clamp_add_u8(saturated, 200);");
    });

    it("generates clamp sub helper for u16", () => {
      HandlerTestUtils.declareTypes(state, [
        ["value", { baseType: "u16", overflowBehavior: "clamp" }],
      ]);
      const generateAssignmentTarget = vi.fn().mockReturnValue("value");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["value"],
        cnextOp: "-<-",
        cOp: "-=",
        generatedValue: "100",
      });

      const result = getHandler()!(ctx);

      expect(state.usedClampOps.has("sub_u16")).toBe(true);
      expect(result).toBe("value = cnx_clamp_sub_u16(value, 100);");
    });

    it("generates clamp mul helper for u32", () => {
      HandlerTestUtils.declareTypes(state, [
        ["result", { baseType: "u32", overflowBehavior: "clamp" }],
      ]);
      const generateAssignmentTarget = vi.fn().mockReturnValue("result");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["result"],
        cnextOp: "*<-",
        cOp: "*=",
        generatedValue: "2",
      });

      const result = getHandler()!(ctx);

      expect(state.usedClampOps.has("mul_u32")).toBe(true);
      expect(result).toBe("result = cnx_clamp_mul_u32(result, 2);");
    });

    it("uses native arithmetic for float types", () => {
      HandlerTestUtils.declareTypes(state, [
        ["f", { baseType: "f32", overflowBehavior: "clamp" }],
      ]);
      const generateAssignmentTarget = vi.fn().mockReturnValue("f");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["f"],
        generatedValue: "1000.0",
      });

      const result = getHandler()!(ctx);

      expect(state.usedClampOps.size).toBe(0);
      expect(result).toBe("f += 1000.0;");
    });

    it("uses native arithmetic for f64 type", () => {
      HandlerTestUtils.declareTypes(state, [
        ["d", { baseType: "f64", overflowBehavior: "clamp" }],
      ]);
      const generateAssignmentTarget = vi.fn().mockReturnValue("d");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["d"],
        cOp: "-=",
        generatedValue: "0.5",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("d -= 0.5;");
    });

    it("falls back to native for unsupported operators", () => {
      HandlerTestUtils.declareTypes(state, [
        ["value", { baseType: "u32", overflowBehavior: "clamp" }],
      ]);
      const generateAssignmentTarget = vi.fn().mockReturnValue("value");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["value"],
        cnextOp: "/<-",
        cOp: "/=",
        generatedValue: "2",
      });

      const result = getHandler()!(ctx);

      expect(state.usedClampOps.size).toBe(0);
      expect(result).toBe("value /= 2;");
    });

    it("handles this.member with clamp", () => {
      enterScope(state, "Motor");
      HandlerTestUtils.declareTypes(state, [
        ["Motor__speed", { baseType: "u8", overflowBehavior: "clamp" }],
      ]);
      const generateAssignmentTarget = vi.fn().mockReturnValue("Motor__speed");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["speed"],
        isSimpleIdentifier: false,
        isSimpleThisAccess: true,
        generatedValue: "10",
      });

      const result = getHandler()!(ctx);

      expect(state.usedClampOps.has("add_u8")).toBe(true);
      expect(result).toBe("Motor__speed = cnx_clamp_add_u8(Motor__speed, 10);");
    });

    it("handles global.member with clamp", () => {
      HandlerTestUtils.declareTypes(state, [
        ["globalValue", { baseType: "i16", overflowBehavior: "clamp" }],
      ]);
      const generateAssignmentTarget = vi.fn().mockReturnValue("globalValue");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["globalValue"],
        isSimpleIdentifier: false,
        isSimpleGlobalAccess: true,
        generatedValue: "50",
      });

      const result = getHandler()!(ctx);

      expect(state.usedClampOps.has("add_i16")).toBe(true);
      expect(result).toBe("globalValue = cnx_clamp_add_i16(globalValue, 50);");
    });

    // #1668: `y *<- s.v` is `y <- y * s.v`, and the integer helper truncated
    // the float operand before multiplying.
    it("emits plain arithmetic when the value has a floating operand", () => {
      HandlerTestUtils.declareTypes(state, [
        ["scaled", { baseType: "u32", overflowBehavior: "clamp" }],
      ]);
      const generateAssignmentTarget = vi.fn().mockReturnValue("scaled");
      HandlerTestUtils.setupMockGenerator(state, {
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["scaled"],
        cnextOp: "*<-",
        cOp: "*=",
        generatedValue: "s.v",
        valueHasFloatingOperand: () => true,
      });

      const result = getHandler()!(ctx);

      expect(state.usedClampOps.size).toBe(0);
      expect(result).toBe("scaled *= s.v;");
    });
  });

  describe("atomic clamp decision (#1668)", () => {
    const getHandler = () =>
      specialHandlers.find(([kind]) => kind === AssignmentKind.ATOMIC_RMW)?.[1];

    it.each([
      ["an integer value", false, "add"],
      ["a floating value", true, null],
    ])(
      "passes the classifier's clamp helper for %s",
      (_label, floating, expected) => {
        HandlerTestUtils.declareTypes(state, [
          [
            "counter",
            { baseType: "u32", isAtomic: true, overflowBehavior: "clamp" },
          ],
        ]);
        const generateAtomicRMW = vi.fn().mockReturnValue("atomic");
        HandlerTestUtils.setupMockGenerator(state, {
          generateAtomicRMW,
          generateAssignmentTarget: vi.fn().mockReturnValue("counter"),
        });
        const ctx = createMockContext({
          valueHasFloatingOperand: () => floating,
        });

        getHandler()!(ctx);

        expect(generateAtomicRMW).toHaveBeenCalledWith(
          "counter",
          "+=",
          "1",
          expect.anything(),
          expected,
        );
      },
    );
  });
});
