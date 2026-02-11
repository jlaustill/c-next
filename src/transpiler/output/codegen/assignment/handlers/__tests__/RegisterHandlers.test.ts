/**
 * Unit tests for RegisterHandlers.
 * Tests register bit assignment handler functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import registerHandlers from "../RegisterHandlers";
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
  return {
    identifiers: ["GPIO7", "DR_SET"],
    subscripts: [{ mockValue: "LED_BIT" } as never],
    isCompound: false,
    cnextOp: "<-",
    cOp: "=",
    generatedValue: "true",
    targetCtx: {} as never,
    hasThis: false,
    hasGlobal: false,
    hasMemberAccess: true,
    hasArrayAccess: true,
    postfixOpsCount: 2,
    memberAccessDepth: 1,
    subscriptDepth: 1,
    isSimpleIdentifier: false,
    isSimpleThisAccess: false,
    isSimpleGlobalAccess: false,
    ...overrides,
  } as IAssignmentContext;
}

describe("RegisterHandlers", () => {
  beforeEach(() => {
    CodeGenState.reset();
    HandlerTestUtils.setupMockGenerator();
    HandlerTestUtils.setupMockSymbols();
  });

  describe("handler registration", () => {
    it("registers all expected register assignment kinds", () => {
      const kinds = registerHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.REGISTER_BIT);
      expect(kinds).toContain(AssignmentKind.REGISTER_BIT_RANGE);
      expect(kinds).toContain(AssignmentKind.SCOPED_REGISTER_BIT);
      expect(kinds).toContain(AssignmentKind.SCOPED_REGISTER_BIT_RANGE);
    });

    it("exports exactly 4 handlers", () => {
      expect(registerHandlers.length).toBe(4);
    });
  });

  describe("handleRegisterBit (REGISTER_BIT)", () => {
    const getHandler = () =>
      registerHandlers.find(
        ([kind]) => kind === AssignmentKind.REGISTER_BIT,
      )?.[1];

    it("generates read-modify-write for read-write register", () => {
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(result).toContain("GPIO7_DR_SET");
      expect(result).toContain("& ~(1 <<");
      expect(result).toContain("LED_BIT");
    });

    it("generates simple write for write-only register", () => {
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      HandlerTestUtils.setupMockSymbols({
        registerMemberAccess: new Map([["GPIO7_DR_SET", "wo"]]),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(result).toBe("GPIO7_DR_SET = (1 << LED_BIT);");
    });

    it("throws on write-only register with false value", () => {
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      HandlerTestUtils.setupMockSymbols({
        registerMemberAccess: new Map([["GPIO7_DR_SET", "wo"]]),
      });
      const ctx = createMockContext({ generatedValue: "false" });

      expect(() => getHandler()!(ctx)).toThrow(
        "Cannot assign false to write-only register bit",
      );
    });

    it("throws on write-only register with 0 value", () => {
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi.fn().mockReturnValue("0"),
      });
      HandlerTestUtils.setupMockSymbols({
        registerMemberAccess: new Map([["GPIO7_DR_SET", "w1s"]]),
      });
      const ctx = createMockContext({ generatedValue: "0" });

      expect(() => getHandler()!(ctx)).toThrow(
        "Cannot assign false to write-only register bit",
      );
    });

    it("throws on compound assignment", () => {
      const ctx = createMockContext({ isCompound: true, cnextOp: "+<-" });

      expect(() => getHandler()!(ctx)).toThrow(
        "Compound assignment operators not supported for bit field access",
      );
    });

    it("handles scoped register prefix correctly", () => {
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi.fn().mockReturnValue("5"),
      });
      HandlerTestUtils.setupMockSymbols({
        knownScopes: new Set(["Motor"]),
      });
      const ctx = createMockContext({
        identifiers: ["Motor", "GPIO7", "DR_SET"],
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("Motor_GPIO7_DR_SET");
    });
  });

  describe("handleRegisterBitRange (REGISTER_BIT_RANGE)", () => {
    const getHandler = () =>
      registerHandlers.find(
        ([kind]) => kind === AssignmentKind.REGISTER_BIT_RANGE,
      )?.[1];

    it("generates read-modify-write for bit range", () => {
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
      });
      const ctx = createMockContext({
        subscripts: [{ mockValue: "0" } as never, { mockValue: "8" } as never],
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("GPIO7_DR_SET");
      expect(result).toContain("& ~(");
      expect(result).toContain("<< 0");
    });

    it("generates simple write for write-only bit range", () => {
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
      });
      HandlerTestUtils.setupMockSymbols({
        registerMemberAccess: new Map([["GPIO7_DR_SET", "wo"]]),
      });
      const ctx = createMockContext({
        subscripts: [{ mockValue: "0" } as never, { mockValue: "8" } as never],
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("GPIO7_DR_SET =");
      expect(result).toContain("value");
      expect(result).not.toContain("& ~");
    });

    it("throws on write-only bit range with 0 value", () => {
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
      });
      HandlerTestUtils.setupMockSymbols({
        registerMemberAccess: new Map([["GPIO7_DR_SET", "w1c"]]),
      });
      const ctx = createMockContext({
        subscripts: [{ mockValue: "0" } as never, { mockValue: "8" } as never],
        generatedValue: "0",
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "Cannot assign 0 to write-only register bits",
      );
    });

    it("generates MMIO optimization for byte-aligned access", () => {
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(8),
      });
      HandlerTestUtils.setupMockSymbols({
        registerMemberAccess: new Map([["GPIO7_DR_SET", "wo"]]),
        registerBaseAddresses: new Map([["GPIO7", "0x40000000"]]),
        registerMemberOffsets: new Map([["GPIO7_DR_SET", "0x04"]]),
      });
      const ctx = createMockContext({
        subscripts: [{ mockValue: "0" } as never, { mockValue: "8" } as never],
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("volatile uint8_t*");
      expect(result).toContain("0x40000000");
      expect(result).toContain("0x04");
    });

    it("generates MMIO with byte offset for non-zero start", () => {
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("8")
          .mockReturnValueOnce("16"),
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(8)
          .mockReturnValueOnce(16),
      });
      HandlerTestUtils.setupMockSymbols({
        registerMemberAccess: new Map([["GPIO7_DR_SET", "wo"]]),
        registerBaseAddresses: new Map([["GPIO7", "0x40000000"]]),
        registerMemberOffsets: new Map([["GPIO7_DR_SET", "0x04"]]),
      });
      const ctx = createMockContext({
        subscripts: [{ mockValue: "8" } as never, { mockValue: "16" } as never],
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("volatile uint16_t*");
      expect(result).toContain("0x04 + 1");
    });

    it("throws on compound assignment", () => {
      const ctx = createMockContext({
        isCompound: true,
        cnextOp: "+<-",
        subscripts: [{ mockValue: "0" } as never, { mockValue: "8" } as never],
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "Compound assignment operators not supported for bit field access",
      );
    });
  });

  describe("handleScopedRegisterBit (SCOPED_REGISTER_BIT)", () => {
    const getHandler = () =>
      registerHandlers.find(
        ([kind]) => kind === AssignmentKind.SCOPED_REGISTER_BIT,
      )?.[1];

    it("generates read-modify-write for scoped register bit", () => {
      CodeGenState.currentScope = "Motor";
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        hasThis: true,
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("Motor_GPIO7_DR_SET");
      expect(result).toContain("& ~(1 <<");
    });

    it("generates simple write for write-only scoped register", () => {
      CodeGenState.currentScope = "Motor";
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      HandlerTestUtils.setupMockSymbols({
        registerMemberAccess: new Map([["Motor_GPIO7_DR_SET", "wo"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        hasThis: true,
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("Motor_GPIO7_DR_SET = (1 << LED_BIT);");
    });

    it("throws when used outside scope", () => {
      CodeGenState.currentScope = null;
      const ctx = createMockContext({ hasThis: true });

      expect(() => getHandler()!(ctx)).toThrow(
        "'this' can only be used inside a scope",
      );
    });

    it("throws on compound assignment", () => {
      CodeGenState.currentScope = "Motor";
      const ctx = createMockContext({ isCompound: true, cnextOp: "+<-" });

      expect(() => getHandler()!(ctx)).toThrow(
        "Compound assignment operators not supported for bit field access",
      );
    });

    it("throws on write-only register with false value", () => {
      CodeGenState.currentScope = "Motor";
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi.fn().mockReturnValue("LED_BIT"),
      });
      HandlerTestUtils.setupMockSymbols({
        registerMemberAccess: new Map([["Motor_GPIO7_DR_SET", "w1s"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "DR_SET"],
        hasThis: true,
        generatedValue: "false",
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "Cannot assign false to write-only register bit",
      );
    });
  });

  describe("handleScopedRegisterBitRange (SCOPED_REGISTER_BIT_RANGE)", () => {
    const getHandler = () =>
      registerHandlers.find(
        ([kind]) => kind === AssignmentKind.SCOPED_REGISTER_BIT_RANGE,
      )?.[1];

    it("generates read-modify-write for scoped register bit range", () => {
      CodeGenState.currentScope = "Motor";
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("6")
          .mockReturnValueOnce("2"),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "ICR1"],
        subscripts: [{ mockValue: "6" } as never, { mockValue: "2" } as never],
        hasThis: true,
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("Motor_GPIO7_ICR1");
      expect(result).toContain("& ~(");
      expect(result).toContain("<< 6");
    });

    it("generates simple write for write-only scoped register bit range", () => {
      CodeGenState.currentScope = "Motor";
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("6")
          .mockReturnValueOnce("2"),
      });
      HandlerTestUtils.setupMockSymbols({
        registerMemberAccess: new Map([["Motor_GPIO7_ICR1", "wo"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "ICR1"],
        subscripts: [{ mockValue: "6" } as never, { mockValue: "2" } as never],
        hasThis: true,
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("Motor_GPIO7_ICR1 =");
      expect(result).not.toContain("& ~");
    });

    it("generates MMIO optimization for byte-aligned scoped access", () => {
      CodeGenState.currentScope = "Motor";
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("32"),
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(32),
      });
      HandlerTestUtils.setupMockSymbols({
        registerMemberAccess: new Map([["Motor_GPIO7_ICR1", "wo"]]),
        registerBaseAddresses: new Map([["Motor_GPIO7", "0x40000000"]]),
        registerMemberOffsets: new Map([["Motor_GPIO7_ICR1", "0x08"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "ICR1"],
        subscripts: [{ mockValue: "0" } as never, { mockValue: "32" } as never],
        hasThis: true,
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("volatile uint32_t*");
      expect(result).toContain("0x40000000");
    });

    it("throws when used outside scope", () => {
      CodeGenState.currentScope = null;
      const ctx = createMockContext({
        subscripts: [{ mockValue: "6" } as never, { mockValue: "2" } as never],
        hasThis: true,
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "'this' can only be used inside a scope",
      );
    });

    it("throws on compound assignment", () => {
      CodeGenState.currentScope = "Motor";
      const ctx = createMockContext({
        isCompound: true,
        cnextOp: "+<-",
        subscripts: [{ mockValue: "6" } as never, { mockValue: "2" } as never],
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "Compound assignment operators not supported for bit field access",
      );
    });

    it("throws on write-only bit range with 0 value", () => {
      CodeGenState.currentScope = "Motor";
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("6")
          .mockReturnValueOnce("2"),
      });
      HandlerTestUtils.setupMockSymbols({
        registerMemberAccess: new Map([["Motor_GPIO7_ICR1", "w1c"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "ICR1"],
        subscripts: [{ mockValue: "6" } as never, { mockValue: "2" } as never],
        hasThis: true,
        generatedValue: "0",
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "Cannot assign 0 to write-only register bits",
      );
    });
  });
});
