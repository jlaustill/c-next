/**
 * Unit tests for SpecialHandlers.
 * Tests atomic RMW and overflow clamp handler functions.
 */

import { describe, expect, it, vi } from "vitest";
import specialHandlers from "../SpecialHandlers";
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
    generateAtomicRMW: vi.fn().mockReturnValue("atomic_rmw_result"),
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
    identifiers: ["counter"],
    subscripts: [],
    isCompound: true,
    cnextOp: "+<-",
    cOp: "+=",
    generatedValue: "1",
    targetCtx: {} as never,
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
    ...overrides,
  } as IAssignmentContext;
}

describe("SpecialHandlers", () => {
  describe("handler registration", () => {
    it("registers all expected special assignment kinds", () => {
      const kinds = specialHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.ATOMIC_RMW);
      expect(kinds).toContain(AssignmentKind.OVERFLOW_CLAMP);
    });

    it("exports exactly 2 handlers", () => {
      expect(specialHandlers.length).toBe(2);
    });
  });

  describe("handleAtomicRMW (ATOMIC_RMW)", () => {
    const getHandler = () =>
      specialHandlers.find(([kind]) => kind === AssignmentKind.ATOMIC_RMW)?.[1];

    it("delegates to generateAtomicRMW for simple identifier", () => {
      const typeRegistry = new Map([
        ["counter", { baseType: "u32", isAtomic: true }],
      ]);
      const generateAtomicRMW = vi.fn().mockReturnValue("LDREX/STREX pattern");
      const generateAssignmentTarget = vi.fn().mockReturnValue("counter");
      const deps = createMockDeps({
        typeRegistry,
        generateAtomicRMW,
        generateAssignmentTarget,
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx, deps);

      expect(generateAtomicRMW).toHaveBeenCalledWith("counter", "+=", "1", {
        baseType: "u32",
        isAtomic: true,
      });
      expect(result).toBe("LDREX/STREX pattern");
    });

    it("handles this.member atomic variable", () => {
      const typeRegistry = new Map([
        ["Motor_count", { baseType: "u32", isAtomic: true }],
      ]);
      const generateAtomicRMW = vi.fn().mockReturnValue("atomic result");
      const generateAssignmentTarget = vi.fn().mockReturnValue("Motor_count");
      const deps = createMockDeps({
        typeRegistry,
        generateAtomicRMW,
        generateAssignmentTarget,
        currentScope: "Motor",
      });
      const ctx = createMockContext({
        identifiers: ["count"],
        isSimpleIdentifier: false,
        isSimpleThisAccess: true,
      });

      const result = getHandler()!(ctx, deps);

      expect(generateAtomicRMW).toHaveBeenCalledWith("Motor_count", "+=", "1", {
        baseType: "u32",
        isAtomic: true,
      });
      expect(result).toBe("atomic result");
    });

    it("handles global.member atomic variable", () => {
      const typeRegistry = new Map([
        ["globalCounter", { baseType: "u32", isAtomic: true }],
      ]);
      const generateAtomicRMW = vi.fn().mockReturnValue("global atomic result");
      const generateAssignmentTarget = vi.fn().mockReturnValue("globalCounter");
      const deps = createMockDeps({
        typeRegistry,
        generateAtomicRMW,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["globalCounter"],
        isSimpleIdentifier: false,
        isSimpleGlobalAccess: true,
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("global atomic result");
    });

    it("handles subtract operation", () => {
      const typeRegistry = new Map([
        ["counter", { baseType: "u32", isAtomic: true }],
      ]);
      const generateAtomicRMW = vi.fn().mockReturnValue("atomic sub");
      const generateAssignmentTarget = vi.fn().mockReturnValue("counter");
      const deps = createMockDeps({
        typeRegistry,
        generateAtomicRMW,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        cnextOp: "-<-",
        cOp: "-=",
      });

      getHandler()!(ctx, deps);

      expect(generateAtomicRMW).toHaveBeenCalledWith(
        "counter",
        "-=",
        "1",
        expect.anything(),
      );
    });
  });

  describe("handleOverflowClamp (OVERFLOW_CLAMP)", () => {
    const getHandler = () =>
      specialHandlers.find(
        ([kind]) => kind === AssignmentKind.OVERFLOW_CLAMP,
      )?.[1];

    it("generates clamp add helper for u8", () => {
      const typeRegistry = new Map([
        ["saturated", { baseType: "u8", overflowBehavior: "clamp" }],
      ]);
      const markClampOpUsed = vi.fn();
      const generateAssignmentTarget = vi.fn().mockReturnValue("saturated");
      const deps = createMockDeps({
        typeRegistry,
        markClampOpUsed,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["saturated"],
        generatedValue: "200",
      });

      const result = getHandler()!(ctx, deps);

      expect(markClampOpUsed).toHaveBeenCalledWith("add", "u8");
      expect(result).toBe("saturated = cnx_clamp_add_u8(saturated, 200);");
    });

    it("generates clamp sub helper for u16", () => {
      const typeRegistry = new Map([
        ["value", { baseType: "u16", overflowBehavior: "clamp" }],
      ]);
      const markClampOpUsed = vi.fn();
      const generateAssignmentTarget = vi.fn().mockReturnValue("value");
      const deps = createMockDeps({
        typeRegistry,
        markClampOpUsed,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["value"],
        cnextOp: "-<-",
        cOp: "-=",
        generatedValue: "100",
      });

      const result = getHandler()!(ctx, deps);

      expect(markClampOpUsed).toHaveBeenCalledWith("sub", "u16");
      expect(result).toBe("value = cnx_clamp_sub_u16(value, 100);");
    });

    it("generates clamp mul helper for u32", () => {
      const typeRegistry = new Map([
        ["result", { baseType: "u32", overflowBehavior: "clamp" }],
      ]);
      const markClampOpUsed = vi.fn();
      const generateAssignmentTarget = vi.fn().mockReturnValue("result");
      const deps = createMockDeps({
        typeRegistry,
        markClampOpUsed,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["result"],
        cnextOp: "*<-",
        cOp: "*=",
        generatedValue: "2",
      });

      const result = getHandler()!(ctx, deps);

      expect(markClampOpUsed).toHaveBeenCalledWith("mul", "u32");
      expect(result).toBe("result = cnx_clamp_mul_u32(result, 2);");
    });

    it("uses native arithmetic for float types", () => {
      const typeRegistry = new Map([
        ["f", { baseType: "f32", overflowBehavior: "clamp" }],
      ]);
      const markClampOpUsed = vi.fn();
      const generateAssignmentTarget = vi.fn().mockReturnValue("f");
      const deps = createMockDeps({
        typeRegistry,
        markClampOpUsed,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["f"],
        generatedValue: "1000.0",
      });

      const result = getHandler()!(ctx, deps);

      expect(markClampOpUsed).not.toHaveBeenCalled();
      expect(result).toBe("f += 1000.0;");
    });

    it("uses native arithmetic for f64 type", () => {
      const typeRegistry = new Map([
        ["d", { baseType: "f64", overflowBehavior: "clamp" }],
      ]);
      const generateAssignmentTarget = vi.fn().mockReturnValue("d");
      const deps = createMockDeps({
        typeRegistry,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["d"],
        cOp: "-=",
        generatedValue: "0.5",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("d -= 0.5;");
    });

    it("falls back to native for unsupported operators", () => {
      const typeRegistry = new Map([
        ["value", { baseType: "u32", overflowBehavior: "clamp" }],
      ]);
      const markClampOpUsed = vi.fn();
      const generateAssignmentTarget = vi.fn().mockReturnValue("value");
      const deps = createMockDeps({
        typeRegistry,
        markClampOpUsed,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["value"],
        cnextOp: "/<-",
        cOp: "/=",
        generatedValue: "2",
      });

      const result = getHandler()!(ctx, deps);

      expect(markClampOpUsed).not.toHaveBeenCalled();
      expect(result).toBe("value /= 2;");
    });

    it("handles this.member with clamp", () => {
      const typeRegistry = new Map([
        ["Motor_speed", { baseType: "u8", overflowBehavior: "clamp" }],
      ]);
      const markClampOpUsed = vi.fn();
      const generateAssignmentTarget = vi.fn().mockReturnValue("Motor_speed");
      const deps = createMockDeps({
        typeRegistry,
        markClampOpUsed,
        generateAssignmentTarget,
        currentScope: "Motor",
      });
      const ctx = createMockContext({
        identifiers: ["speed"],
        isSimpleIdentifier: false,
        isSimpleThisAccess: true,
        generatedValue: "10",
      });

      const result = getHandler()!(ctx, deps);

      expect(markClampOpUsed).toHaveBeenCalledWith("add", "u8");
      expect(result).toBe("Motor_speed = cnx_clamp_add_u8(Motor_speed, 10);");
    });

    it("handles global.member with clamp", () => {
      const typeRegistry = new Map([
        ["globalValue", { baseType: "i16", overflowBehavior: "clamp" }],
      ]);
      const markClampOpUsed = vi.fn();
      const generateAssignmentTarget = vi.fn().mockReturnValue("globalValue");
      const deps = createMockDeps({
        typeRegistry,
        markClampOpUsed,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["globalValue"],
        isSimpleIdentifier: false,
        isSimpleGlobalAccess: true,
        generatedValue: "50",
      });

      const result = getHandler()!(ctx, deps);

      expect(markClampOpUsed).toHaveBeenCalledWith("add", "i16");
      expect(result).toBe("globalValue = cnx_clamp_add_i16(globalValue, 50);");
    });
  });
});
