/**
 * Unit tests for SpecialHandlers.
 * Tests atomic RMW and overflow clamp handler functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import specialHandlers from "../SpecialHandlers";
import AssignmentKind from "../../AssignmentKind";
import IAssignmentContext from "../../IAssignmentContext";
import CodeGenState from "../../../../../state/CodeGenState";
import type CodeGenerator from "../../../CodeGenerator";

/**
 * Set up mock generator with needed methods.
 */
function setupMockGenerator(overrides: Record<string, unknown> = {}): void {
  CodeGenState.generator = {
    generateAssignmentTarget: vi.fn().mockReturnValue("target"),
    generateExpression: vi
      .fn()
      .mockImplementation((ctx) => ctx?.mockValue ?? "0"),
    generateAtomicRMW: vi.fn().mockReturnValue("atomic_rmw_result"),
    ...overrides,
  } as unknown as CodeGenerator;
}

/**
 * Set up mock symbols.
 */
function setupMockSymbols(overrides: Record<string, unknown> = {}): void {
  CodeGenState.symbols = {
    structFields: new Map(),
    structFieldDimensions: new Map(),
    bitmapFields: new Map(),
    registerMemberAccess: new Map(),
    registerBaseAddresses: new Map(),
    registerMemberOffsets: new Map(),
    registerMemberTypes: new Map(),
    ...overrides,
  } as any;
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
  beforeEach(() => {
    CodeGenState.reset();
    setupMockGenerator();
    setupMockSymbols();
  });

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
      CodeGenState.typeRegistry = new Map([
        ["counter", { baseType: "u32", isAtomic: true }],
      ]) as any;
      const generateAtomicRMW = vi.fn().mockReturnValue("LDREX/STREX pattern");
      const generateAssignmentTarget = vi.fn().mockReturnValue("counter");
      setupMockGenerator({
        generateAtomicRMW,
        generateAssignmentTarget,
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(generateAtomicRMW).toHaveBeenCalledWith("counter", "+=", "1", {
        baseType: "u32",
        isAtomic: true,
      });
      expect(result).toBe("LDREX/STREX pattern");
    });

    it("handles this.member atomic variable", () => {
      CodeGenState.currentScope = "Motor";
      CodeGenState.typeRegistry = new Map([
        ["Motor_count", { baseType: "u32", isAtomic: true }],
      ]) as any;
      const generateAtomicRMW = vi.fn().mockReturnValue("atomic result");
      const generateAssignmentTarget = vi.fn().mockReturnValue("Motor_count");
      setupMockGenerator({
        generateAtomicRMW,
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["count"],
        isSimpleIdentifier: false,
        isSimpleThisAccess: true,
      });

      const result = getHandler()!(ctx);

      expect(generateAtomicRMW).toHaveBeenCalledWith("Motor_count", "+=", "1", {
        baseType: "u32",
        isAtomic: true,
      });
      expect(result).toBe("atomic result");
    });

    it("handles global.member atomic variable", () => {
      CodeGenState.typeRegistry = new Map([
        ["globalCounter", { baseType: "u32", isAtomic: true }],
      ]) as any;
      const generateAtomicRMW = vi.fn().mockReturnValue("global atomic result");
      const generateAssignmentTarget = vi.fn().mockReturnValue("globalCounter");
      setupMockGenerator({
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
      CodeGenState.typeRegistry = new Map([
        ["counter", { baseType: "u32", isAtomic: true }],
      ]) as any;
      const generateAtomicRMW = vi.fn().mockReturnValue("atomic sub");
      const generateAssignmentTarget = vi.fn().mockReturnValue("counter");
      setupMockGenerator({
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
      );
    });
  });

  describe("handleOverflowClamp (OVERFLOW_CLAMP)", () => {
    const getHandler = () =>
      specialHandlers.find(
        ([kind]) => kind === AssignmentKind.OVERFLOW_CLAMP,
      )?.[1];

    it("generates clamp add helper for u8", () => {
      CodeGenState.typeRegistry = new Map([
        ["saturated", { baseType: "u8", overflowBehavior: "clamp" }],
      ]) as any;
      const generateAssignmentTarget = vi.fn().mockReturnValue("saturated");
      setupMockGenerator({
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["saturated"],
        generatedValue: "200",
      });

      const result = getHandler()!(ctx);

      expect(CodeGenState.usedClampOps.has("add_u8")).toBe(true);
      expect(result).toBe("saturated = cnx_clamp_add_u8(saturated, 200);");
    });

    it("generates clamp sub helper for u16", () => {
      CodeGenState.typeRegistry = new Map([
        ["value", { baseType: "u16", overflowBehavior: "clamp" }],
      ]) as any;
      const generateAssignmentTarget = vi.fn().mockReturnValue("value");
      setupMockGenerator({
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["value"],
        cnextOp: "-<-",
        cOp: "-=",
        generatedValue: "100",
      });

      const result = getHandler()!(ctx);

      expect(CodeGenState.usedClampOps.has("sub_u16")).toBe(true);
      expect(result).toBe("value = cnx_clamp_sub_u16(value, 100);");
    });

    it("generates clamp mul helper for u32", () => {
      CodeGenState.typeRegistry = new Map([
        ["result", { baseType: "u32", overflowBehavior: "clamp" }],
      ]) as any;
      const generateAssignmentTarget = vi.fn().mockReturnValue("result");
      setupMockGenerator({
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["result"],
        cnextOp: "*<-",
        cOp: "*=",
        generatedValue: "2",
      });

      const result = getHandler()!(ctx);

      expect(CodeGenState.usedClampOps.has("mul_u32")).toBe(true);
      expect(result).toBe("result = cnx_clamp_mul_u32(result, 2);");
    });

    it("uses native arithmetic for float types", () => {
      CodeGenState.typeRegistry = new Map([
        ["f", { baseType: "f32", overflowBehavior: "clamp" }],
      ]) as any;
      const generateAssignmentTarget = vi.fn().mockReturnValue("f");
      setupMockGenerator({
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["f"],
        generatedValue: "1000.0",
      });

      const result = getHandler()!(ctx);

      expect(CodeGenState.usedClampOps.size).toBe(0);
      expect(result).toBe("f += 1000.0;");
    });

    it("uses native arithmetic for f64 type", () => {
      CodeGenState.typeRegistry = new Map([
        ["d", { baseType: "f64", overflowBehavior: "clamp" }],
      ]) as any;
      const generateAssignmentTarget = vi.fn().mockReturnValue("d");
      setupMockGenerator({
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
      CodeGenState.typeRegistry = new Map([
        ["value", { baseType: "u32", overflowBehavior: "clamp" }],
      ]) as any;
      const generateAssignmentTarget = vi.fn().mockReturnValue("value");
      setupMockGenerator({
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["value"],
        cnextOp: "/<-",
        cOp: "/=",
        generatedValue: "2",
      });

      const result = getHandler()!(ctx);

      expect(CodeGenState.usedClampOps.size).toBe(0);
      expect(result).toBe("value /= 2;");
    });

    it("handles this.member with clamp", () => {
      CodeGenState.currentScope = "Motor";
      CodeGenState.typeRegistry = new Map([
        ["Motor_speed", { baseType: "u8", overflowBehavior: "clamp" }],
      ]) as any;
      const generateAssignmentTarget = vi.fn().mockReturnValue("Motor_speed");
      setupMockGenerator({
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["speed"],
        isSimpleIdentifier: false,
        isSimpleThisAccess: true,
        generatedValue: "10",
      });

      const result = getHandler()!(ctx);

      expect(CodeGenState.usedClampOps.has("add_u8")).toBe(true);
      expect(result).toBe("Motor_speed = cnx_clamp_add_u8(Motor_speed, 10);");
    });

    it("handles global.member with clamp", () => {
      CodeGenState.typeRegistry = new Map([
        ["globalValue", { baseType: "i16", overflowBehavior: "clamp" }],
      ]) as any;
      const generateAssignmentTarget = vi.fn().mockReturnValue("globalValue");
      setupMockGenerator({
        generateAssignmentTarget,
      });
      const ctx = createMockContext({
        identifiers: ["globalValue"],
        isSimpleIdentifier: false,
        isSimpleGlobalAccess: true,
        generatedValue: "50",
      });

      const result = getHandler()!(ctx);

      expect(CodeGenState.usedClampOps.has("add_i16")).toBe(true);
      expect(result).toBe("globalValue = cnx_clamp_add_i16(globalValue, 50);");
    });
  });
});
