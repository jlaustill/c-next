/**
 * Unit tests for AccessPatternHandlers.
 * Tests global/this access and member chain handler functions.
 */

import { describe, expect, it, vi } from "vitest";
import accessPatternHandlers from "../AccessPatternHandlers";
import AssignmentKind from "../../AssignmentKind";
import IAssignmentContext from "../../IAssignmentContext";
import IHandlerDeps from "../IHandlerDeps";

/**
 * Create mock dependencies for testing.
 */
function createMockDeps(overrides: Record<string, unknown> = {}): IHandlerDeps {
  const base = {
    typeRegistry: new Map(),
    symbols: {
      structFields: new Map(),
      structFieldDimensions: new Map(),
      bitmapFields: new Map(),
      registerMemberAccess: new Map(),
      registerBaseAddresses: new Map(),
      registerMemberOffsets: new Map(),
      registerMemberTypes: new Map(),
    },
    currentScope: null,
    currentParameters: new Map(),
    targetCapabilities: { hasLDREX: false },
    generateAssignmentTarget: vi.fn().mockReturnValue("target"),
    generateExpression: vi
      .fn()
      .mockImplementation((ctx) => ctx?.mockValue ?? "0"),
    markNeedsString: vi.fn(),
    markClampOpUsed: vi.fn(),
    isKnownScope: vi.fn().mockReturnValue(false),
    isKnownStruct: vi.fn().mockReturnValue(false),
    validateCrossScopeVisibility: vi.fn(),
    validateBitmapFieldLiteral: vi.fn(),
    checkArrayBounds: vi.fn(),
    analyzeMemberChainForBitAccess: vi
      .fn()
      .mockReturnValue({ isBitAccess: false }),
    tryEvaluateConstant: vi.fn().mockReturnValue(undefined),
    getMemberTypeInfo: vi.fn().mockReturnValue(null),
    generateFloatBitWrite: vi.fn().mockReturnValue(null),
    foldBooleanToInt: vi.fn().mockImplementation((expr) => expr),
    generateAtomicRMW: vi.fn().mockReturnValue("atomic_rmw"),
    ...overrides,
  };
  return base as unknown as IHandlerDeps;
}

/**
 * Create mock context for testing.
 */
function createMockContext(
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  return {
    identifiers: ["Counter", "value"],
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
    ...overrides,
  } as IAssignmentContext;
}

describe("AccessPatternHandlers", () => {
  describe("handler registration", () => {
    it("registers all expected access pattern kinds", () => {
      const kinds = accessPatternHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.GLOBAL_MEMBER);
      expect(kinds).toContain(AssignmentKind.GLOBAL_ARRAY);
      expect(kinds).toContain(AssignmentKind.GLOBAL_REGISTER_BIT);
      expect(kinds).toContain(AssignmentKind.THIS_MEMBER);
      expect(kinds).toContain(AssignmentKind.THIS_ARRAY);
      expect(kinds).toContain(AssignmentKind.MEMBER_CHAIN);
    });

    it("exports exactly 6 handlers", () => {
      expect(accessPatternHandlers.length).toBe(6);
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

    it("uses same handler for THIS_MEMBER and THIS_ARRAY", () => {
      const thisMemberHandler = accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.THIS_MEMBER,
      )?.[1];
      const thisArrayHandler = accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.THIS_ARRAY,
      )?.[1];

      expect(thisMemberHandler).toBe(thisArrayHandler);
    });
  });

  describe("handleGlobalAccess (GLOBAL_MEMBER)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.GLOBAL_MEMBER,
      )?.[1];

    it("generates standard assignment for global member", () => {
      const generateAssignmentTarget = vi.fn().mockReturnValue("Counter_value");
      const deps = createMockDeps({ generateAssignmentTarget });
      const ctx = createMockContext();

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("Counter_value = 5;");
    });

    it("validates cross-scope visibility when first id is a scope", () => {
      const validateCrossScopeVisibility = vi.fn();
      const deps = createMockDeps({
        isKnownScope: vi.fn().mockReturnValue(true),
        validateCrossScopeVisibility,
        generateAssignmentTarget: vi.fn().mockReturnValue("Motor_speed"),
      });
      const ctx = createMockContext({
        identifiers: ["Motor", "speed"],
      });

      getHandler()!(ctx, deps);

      expect(validateCrossScopeVisibility).toHaveBeenCalledWith(
        "Motor",
        "speed",
      );
    });

    it("does not validate when first id is not a scope", () => {
      const validateCrossScopeVisibility = vi.fn();
      const deps = createMockDeps({
        isKnownScope: vi.fn().mockReturnValue(false),
        validateCrossScopeVisibility,
        generateAssignmentTarget: vi.fn().mockReturnValue("someVar"),
      });
      const ctx = createMockContext({
        identifiers: ["someVar"],
      });

      getHandler()!(ctx, deps);

      expect(validateCrossScopeVisibility).not.toHaveBeenCalled();
    });

    it("handles compound assignment", () => {
      const deps = createMockDeps({
        generateAssignmentTarget: vi.fn().mockReturnValue("Counter_value"),
      });
      const ctx = createMockContext({
        isCompound: true,
        cOp: "+=",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("Counter_value += 5;");
    });
  });

  describe("handleGlobalAccess (GLOBAL_ARRAY)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.GLOBAL_ARRAY,
      )?.[1];

    it("generates array element assignment", () => {
      const deps = createMockDeps({
        generateAssignmentTarget: vi.fn().mockReturnValue("Buffer_data[i]"),
      });
      const ctx = createMockContext({
        identifiers: ["Buffer", "data"],
        subscripts: [{ mockValue: "i" } as never],
        hasArrayAccess: true,
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("Buffer_data[i] = 5;");
    });
  });

  describe("handleThisAccess (THIS_MEMBER)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.THIS_MEMBER,
      )?.[1];

    it("generates scoped member assignment", () => {
      const deps = createMockDeps({
        currentScope: "Motor",
        generateAssignmentTarget: vi.fn().mockReturnValue("Motor_speed"),
      });
      const ctx = createMockContext({
        identifiers: ["speed"],
        hasThis: true,
        hasGlobal: false,
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("Motor_speed = 5;");
    });

    it("throws when used outside scope", () => {
      const deps = createMockDeps({ currentScope: null });
      const ctx = createMockContext({ hasThis: true, hasGlobal: false });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "'this' can only be used inside a scope",
      );
    });

    it("handles compound assignment", () => {
      const deps = createMockDeps({
        currentScope: "Motor",
        generateAssignmentTarget: vi.fn().mockReturnValue("Motor_count"),
      });
      const ctx = createMockContext({
        identifiers: ["count"],
        hasThis: true,
        hasGlobal: false,
        isCompound: true,
        cOp: "-=",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("Motor_count -= 5;");
    });
  });

  describe("handleThisAccess (THIS_ARRAY)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.THIS_ARRAY,
      )?.[1];

    it("generates scoped array element assignment", () => {
      const deps = createMockDeps({
        currentScope: "Motor",
        generateAssignmentTarget: vi.fn().mockReturnValue("Motor_items[0]"),
      });
      const ctx = createMockContext({
        identifiers: ["items"],
        subscripts: [{ mockValue: "0" } as never],
        hasThis: true,
        hasGlobal: false,
        hasArrayAccess: true,
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("Motor_items[0] = 5;");
    });
  });

  describe("handleGlobalRegisterBit (GLOBAL_REGISTER_BIT)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.GLOBAL_REGISTER_BIT,
      )?.[1];

    it("generates read-modify-write for single bit", () => {
      const deps = createMockDeps({
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        subscripts: [{ mockValue: "LED_BIT" } as never],
        generatedValue: "true",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("GPIO7_DR_SET =");
      expect(result).toContain("& ~(1 <<");
      expect(result).toContain("LED_BIT");
    });

    it("generates simple write for write-only register single bit", () => {
      const registerMemberAccess = new Map([["GPIO7_DR_SET", "wo"]]);
      const deps = createMockDeps({
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
        symbols: {
          structFields: new Map(),
          structFieldDimensions: new Map(),
          bitmapFields: new Map(),
          registerMemberAccess,
          registerBaseAddresses: new Map(),
          registerMemberOffsets: new Map(),
          registerMemberTypes: new Map(),
        },
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        subscripts: [{ mockValue: "LED_BIT" } as never],
        generatedValue: "true",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("GPIO7_DR_SET = (1 << LED_BIT);");
    });

    it("throws on write-only register with false value", () => {
      const registerMemberAccess = new Map([["GPIO7_DR_SET", "wo"]]);
      const deps = createMockDeps({
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
        symbols: {
          structFields: new Map(),
          structFieldDimensions: new Map(),
          bitmapFields: new Map(),
          registerMemberAccess,
          registerBaseAddresses: new Map(),
          registerMemberOffsets: new Map(),
          registerMemberTypes: new Map(),
        },
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        subscripts: [{ mockValue: "LED_BIT" } as never],
        generatedValue: "false",
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Cannot assign false to write-only register bit",
      );
    });

    it("generates read-modify-write for bit range", () => {
      const deps = createMockDeps({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        subscripts: [{ mockValue: "0" } as never, { mockValue: "8" } as never],
        generatedValue: "value",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("GPIO7_DR_SET =");
      expect(result).toContain("& ~(");
      expect(result).toContain("<< 0");
    });

    it("generates simple write for write-only bit range", () => {
      const registerMemberAccess = new Map([["GPIO7_DR_SET", "w1s"]]);
      const deps = createMockDeps({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
        symbols: {
          structFields: new Map(),
          structFieldDimensions: new Map(),
          bitmapFields: new Map(),
          registerMemberAccess,
          registerBaseAddresses: new Map(),
          registerMemberOffsets: new Map(),
          registerMemberTypes: new Map(),
        },
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        subscripts: [{ mockValue: "0" } as never, { mockValue: "8" } as never],
        generatedValue: "value",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).not.toContain("& ~");
    });

    it("throws on write-only bit range with 0 value", () => {
      const registerMemberAccess = new Map([["GPIO7_DR_SET", "w1c"]]);
      const deps = createMockDeps({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
        symbols: {
          structFields: new Map(),
          structFieldDimensions: new Map(),
          bitmapFields: new Map(),
          registerMemberAccess,
          registerBaseAddresses: new Map(),
          registerMemberOffsets: new Map(),
          registerMemberTypes: new Map(),
        },
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        subscripts: [{ mockValue: "0" } as never, { mockValue: "8" } as never],
        generatedValue: "0",
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Cannot assign 0 to write-only register bits",
      );
    });

    it("throws on compound assignment", () => {
      const deps = createMockDeps();
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        subscripts: [{ mockValue: "LED_BIT" } as never],
        isCompound: true,
        cnextOp: "+<-",
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Compound assignment operators not supported for bit field access",
      );
    });
  });

  describe("handleMemberChain (MEMBER_CHAIN)", () => {
    const getHandler = () =>
      accessPatternHandlers.find(
        ([kind]) => kind === AssignmentKind.MEMBER_CHAIN,
      )?.[1];

    it("generates standard member chain assignment", () => {
      const deps = createMockDeps({
        generateAssignmentTarget: vi
          .fn()
          .mockReturnValue("device.config.value"),
      });
      const ctx = createMockContext({
        identifiers: ["device", "config", "value"],
        memberAccessDepth: 2,
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("device.config.value = 5;");
    });

    it("generates bit access when detected in member chain", () => {
      const deps = createMockDeps({
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

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("grid[2][3].flags =");
      expect(result).toContain("& ~(1 << 0)");
      expect(result).toContain("1 << 0");
    });

    it("uses 1ULL for 64-bit bit access", () => {
      const deps = createMockDeps({
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

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("1ULL << bit");
    });

    it("throws on compound assignment for bit access in member chain", () => {
      const deps = createMockDeps({
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

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Compound assignment operators not supported for bit field access",
      );
    });

    it("handles compound assignment for normal member chain", () => {
      const deps = createMockDeps({
        generateAssignmentTarget: vi.fn().mockReturnValue("obj.field"),
      });
      const ctx = createMockContext({
        identifiers: ["obj", "field"],
        isCompound: true,
        cOp: "*=",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("obj.field *= 5;");
    });
  });
});
