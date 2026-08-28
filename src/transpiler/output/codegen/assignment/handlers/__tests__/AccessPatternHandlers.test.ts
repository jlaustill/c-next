/**
 * Unit tests for AccessPatternHandlers.
 * Tests global/this access and member chain handler functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import accessPatternHandlers from "../AccessPatternHandlers";
import AssignmentKind from "../../AssignmentKind";
import IAssignmentContext from "../../IAssignmentContext";
import CodeGenState from "../../../../../state/CodeGenState";
import HandlerTestUtils from "./handlerTestUtils";

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
    subscripts: [],
    isCompound: false,
    cnextOp: "<-",
    cOp: "=",
    generatedValue: "5",
    targetCtx: {} as never,
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
    ...overrides,
  } as IAssignmentContext;
}

describe("AccessPatternHandlers", () => {
  beforeEach(() => {
    CodeGenState.reset();
    HandlerTestUtils.setupMockGenerator();
    HandlerTestUtils.setupMockSymbols();
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
      HandlerTestUtils.setupMockGenerator({
        generateAssignmentTarget: vi.fn().mockReturnValue("Counter__value"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(result).toBe("Counter__value = 5;");
    });

    it("validates cross-scope visibility when first id is a scope", () => {
      const validateCrossScopeVisibility = vi.fn();
      HandlerTestUtils.setupMockGenerator({
        generateAssignmentTarget: vi.fn().mockReturnValue("Motor__speed"),
        validateCrossScopeVisibility,
      });
      HandlerTestUtils.setupMockSymbols({
        knownScopes: new Set(["Motor"]),
      });
      const ctx = createMockContext({
        identifiers: ["Motor", "speed"],
      });

      getHandler()!(ctx);

      expect(validateCrossScopeVisibility).toHaveBeenCalledWith(
        "Motor",
        "speed",
      );
    });

    it("does not validate when first id is not a scope", () => {
      const validateCrossScopeVisibility = vi.fn();
      HandlerTestUtils.setupMockGenerator({
        generateAssignmentTarget: vi.fn().mockReturnValue("someVar"),
        validateCrossScopeVisibility,
      });
      HandlerTestUtils.setupMockSymbols({
        knownScopes: new Set(),
      });
      const ctx = createMockContext({
        identifiers: ["someVar"],
      });

      getHandler()!(ctx);

      expect(validateCrossScopeVisibility).not.toHaveBeenCalled();
    });

    it("handles compound assignment", () => {
      HandlerTestUtils.setupMockGenerator({
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
      HandlerTestUtils.setupMockGenerator({
        generateAssignmentTarget: vi.fn().mockReturnValue("Buffer_data[i]"),
      });
      const ctx = createMockContext({
        identifiers: ["Buffer", "data"],
        subscripts: [{ mockValue: "i" } as never],
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
      CodeGenState.setCurrentScopeByName("Motor");
      HandlerTestUtils.setupMockGenerator({
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

    it("throws when used outside scope", () => {
      CodeGenState.setCurrentScopeByName(null);
      const ctx = createMockContext({ hasThis: true, hasGlobal: false });

      expect(() => getHandler()!(ctx)).toThrow(
        "'this' can only be used inside a scope",
      );
    });

    it("handles compound assignment", () => {
      CodeGenState.setCurrentScopeByName("Motor");
      HandlerTestUtils.setupMockGenerator({
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
      CodeGenState.setCurrentScopeByName("Motor");
      HandlerTestUtils.setupMockGenerator({
        generateAssignmentTarget: vi.fn().mockReturnValue("Motor_items[0]"),
      });
      const ctx = createMockContext({
        identifiers: ["items"],
        subscripts: [{ mockValue: "0" } as never],
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
      HandlerTestUtils.setupMockGenerator({
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
      HandlerTestUtils.setupMockGenerator({
        analyzeMemberChainForBitAccess: vi.fn().mockReturnValue({
          isBitAccess: true,
          baseTarget: "grid[2][3].flags",
          bitIndex: "0",
          baseType: "u32",
        }),
      });
      const ctx = createMockContext({
        identifiers: ["grid", "flags"],
        subscripts: [{ mockValue: "0" } as never],
        generatedValue: "true",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("grid[2][3].flags =");
      expect(result).toContain("& ~(1U << 0)");
      expect(result).toContain("1U << 0");
    });

    it("uses 1ULL for 64-bit bit access", () => {
      HandlerTestUtils.setupMockGenerator({
        analyzeMemberChainForBitAccess: vi.fn().mockReturnValue({
          isBitAccess: true,
          baseTarget: "data.flags",
          bitIndex: "bit",
          baseType: "u64",
        }),
      });
      const ctx = createMockContext({
        identifiers: ["data", "flags"],
        subscripts: [{ mockValue: "bit" } as never],
        generatedValue: "false",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("1ULL << bit");
    });

    it("throws on compound assignment for bit access in member chain", () => {
      HandlerTestUtils.setupMockGenerator({
        analyzeMemberChainForBitAccess: vi.fn().mockReturnValue({
          isBitAccess: true,
          baseTarget: "data.flags",
          bitIndex: "0",
          baseType: "u32",
        }),
      });
      const ctx = createMockContext({
        isCompound: true,
        cnextOp: "+<-",
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "Compound assignment operators not supported for bit field access",
      );
    });

    it("handles compound assignment for normal member chain", () => {
      HandlerTestUtils.setupMockGenerator({
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
