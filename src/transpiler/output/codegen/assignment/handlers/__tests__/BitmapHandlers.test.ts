/**
 * Unit tests for BitmapHandlers.
 * Tests bitmap field assignment handler functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock TypeValidator before imports
vi.mock("../../../TypeValidator", () => ({
  default: {
    validateBitmapFieldLiteral: vi.fn(),
  },
}));

import bitmapHandlers from "../BitmapHandlers";
import AssignmentKind from "../../AssignmentKind";
import IAssignmentContext from "../../IAssignmentContext";
import CodeGenState from "../../../../../state/CodeGenState";
import type CodeGenerator from "../../../CodeGenerator";
import TypeValidator from "../../../TypeValidator";

/**
 * Set up mock generator with needed methods.
 */
function setupMockGenerator(overrides: Record<string, unknown> = {}): void {
  CodeGenState.generator = {
    generateAssignmentTarget: vi.fn().mockReturnValue("target"),
    generateExpression: vi
      .fn()
      .mockImplementation((ctx) => ctx?.mockValue ?? "0"),
    validateBitmapFieldLiteral: vi.fn(),
    validateCrossScopeVisibility: vi.fn(),
    getMemberTypeInfo: vi.fn().mockReturnValue(null),
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
    structFieldArrays: new Map(),
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
    identifiers: ["flags", "Running"],
    subscripts: [],
    isCompound: false,
    cnextOp: "<-",
    cOp: "=",
    generatedValue: "true",
    targetCtx: {} as never,
    valueCtx: {} as never,
    hasThis: false,
    hasGlobal: false,
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

describe("BitmapHandlers", () => {
  beforeEach(() => {
    CodeGenState.reset();
    setupMockGenerator();
    setupMockSymbols();
  });

  describe("handler registration", () => {
    it("registers all expected bitmap assignment kinds", () => {
      const kinds = bitmapHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.BITMAP_FIELD_SINGLE_BIT);
      expect(kinds).toContain(AssignmentKind.BITMAP_FIELD_MULTI_BIT);
      expect(kinds).toContain(AssignmentKind.BITMAP_ARRAY_ELEMENT_FIELD);
      expect(kinds).toContain(AssignmentKind.STRUCT_MEMBER_BITMAP_FIELD);
      expect(kinds).toContain(AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD);
      expect(kinds).toContain(
        AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD,
      );
    });

    it("exports exactly 6 handlers", () => {
      expect(bitmapHandlers.length).toBe(6);
    });
  });

  describe("handleBitmapFieldSingleBit (BITMAP_FIELD_SINGLE_BIT)", () => {
    const getHandler = () =>
      bitmapHandlers.find(
        ([kind]) => kind === AssignmentKind.BITMAP_FIELD_SINGLE_BIT,
      )?.[1];

    it("generates single-bit read-modify-write", () => {
      CodeGenState.typeRegistry = new Map([
        ["flags", { bitmapTypeName: "StatusFlags", baseType: "u8" }],
      ]) as any;
      setupMockSymbols({
        bitmapFields: new Map([
          ["StatusFlags", new Map([["Running", { offset: 0, width: 1 }]])],
        ]),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(result).toContain("flags =");
      expect(result).toContain("& ~(1 << 0)");
      expect(result).toContain("<< 0");
    });

    it("generates single-bit write with correct offset", () => {
      CodeGenState.typeRegistry = new Map([
        ["flags", { bitmapTypeName: "StatusFlags", baseType: "u8" }],
      ]) as any;
      setupMockSymbols({
        bitmapFields: new Map([
          ["StatusFlags", new Map([["Active", { offset: 3, width: 1 }]])],
        ]),
      });
      const ctx = createMockContext({
        identifiers: ["flags", "Active"],
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("<< 3");
    });

    it("throws on unknown bitmap field", () => {
      CodeGenState.typeRegistry = new Map([
        ["flags", { bitmapTypeName: "StatusFlags", baseType: "u8" }],
      ]) as any;
      setupMockSymbols({
        bitmapFields: new Map([["StatusFlags", new Map()]]),
      });
      const ctx = createMockContext({
        identifiers: ["flags", "Unknown"],
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "Unknown bitmap field 'Unknown' on type 'StatusFlags'",
      );
    });

    it("throws on compound assignment", () => {
      CodeGenState.typeRegistry = new Map([
        ["flags", { bitmapTypeName: "StatusFlags", baseType: "u8" }],
      ]) as any;
      setupMockSymbols({
        bitmapFields: new Map([
          ["StatusFlags", new Map([["Running", { offset: 0, width: 1 }]])],
        ]),
      });
      const ctx = createMockContext({
        isCompound: true,
        cnextOp: "+<-",
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "Compound assignment operators not supported for bitmap field access",
      );
    });

    it("validates bitmap field literal", () => {
      CodeGenState.typeRegistry = new Map([
        ["flags", { bitmapTypeName: "StatusFlags", baseType: "u8" }],
      ]) as any;
      setupMockSymbols({
        bitmapFields: new Map([
          ["StatusFlags", new Map([["Running", { offset: 0, width: 1 }]])],
        ]),
      });
      const ctx = createMockContext();
      vi.mocked(TypeValidator.validateBitmapFieldLiteral).mockClear();

      getHandler()!(ctx);

      expect(TypeValidator.validateBitmapFieldLiteral).toHaveBeenCalledWith(
        ctx.valueCtx,
        1,
        "Running",
      );
    });
  });

  describe("handleBitmapFieldMultiBit (BITMAP_FIELD_MULTI_BIT)", () => {
    const getHandler = () =>
      bitmapHandlers.find(
        ([kind]) => kind === AssignmentKind.BITMAP_FIELD_MULTI_BIT,
      )?.[1];

    it("generates multi-bit read-modify-write with mask", () => {
      CodeGenState.typeRegistry = new Map([
        ["flags", { bitmapTypeName: "StatusFlags", baseType: "u8" }],
      ]) as any;
      setupMockSymbols({
        bitmapFields: new Map([
          ["StatusFlags", new Map([["Mode", { offset: 4, width: 3 }]])],
        ]),
      });
      const ctx = createMockContext({
        identifiers: ["flags", "Mode"],
        generatedValue: "3",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("flags =");
      expect(result).toContain("& ~(0x7 << 4)");
      expect(result).toContain("(3 & 0x7)");
      expect(result).toContain("<< 4");
    });

    it("generates correct mask for 2-bit field", () => {
      CodeGenState.typeRegistry = new Map([
        ["config", { bitmapTypeName: "Config", baseType: "u8" }],
      ]) as any;
      setupMockSymbols({
        bitmapFields: new Map([
          ["Config", new Map([["Priority", { offset: 0, width: 2 }]])],
        ]),
      });
      const ctx = createMockContext({
        identifiers: ["config", "Priority"],
        generatedValue: "2",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("0x3");
    });
  });

  describe("handleBitmapArrayElementField (BITMAP_ARRAY_ELEMENT_FIELD)", () => {
    const getHandler = () =>
      bitmapHandlers.find(
        ([kind]) => kind === AssignmentKind.BITMAP_ARRAY_ELEMENT_FIELD,
      )?.[1];

    it("generates array element bitmap field assignment", () => {
      CodeGenState.typeRegistry = new Map([
        ["flagsArray", { bitmapTypeName: "StatusFlags", baseType: "u8" }],
      ]) as any;
      setupMockGenerator({
        generateExpression: vi.fn().mockReturnValue("i"),
      });
      setupMockSymbols({
        bitmapFields: new Map([
          ["StatusFlags", new Map([["Active", { offset: 0, width: 1 }]])],
        ]),
      });
      const ctx = createMockContext({
        identifiers: ["flagsArray", "Active"],
        subscripts: [{ mockValue: "i" } as never],
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("flagsArray[i] =");
      expect(result).toContain("& ~(1 << 0)");
    });
  });

  describe("handleStructMemberBitmapField (STRUCT_MEMBER_BITMAP_FIELD)", () => {
    const getHandler = () =>
      bitmapHandlers.find(
        ([kind]) => kind === AssignmentKind.STRUCT_MEMBER_BITMAP_FIELD,
      )?.[1];

    it("generates struct member bitmap field assignment", () => {
      CodeGenState.typeRegistry = new Map([
        ["device", { baseType: "Device" }],
      ]) as any;
      setupMockSymbols({
        bitmapFields: new Map([
          ["StatusFlags", new Map([["Active", { offset: 2, width: 1 }]])],
        ]),
        // structFields maps struct type -> field name -> field type
        structFields: new Map([
          ["Device", new Map([["flags", "StatusFlags"]])],
        ]),
      });
      const ctx = createMockContext({
        identifiers: ["device", "flags", "Active"],
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("device.flags =");
      expect(result).toContain("<< 2");
    });
  });

  describe("handleRegisterMemberBitmapField (REGISTER_MEMBER_BITMAP_FIELD)", () => {
    const getHandler = () =>
      bitmapHandlers.find(
        ([kind]) => kind === AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD,
      )?.[1];

    it("generates register member bitmap field assignment", () => {
      setupMockSymbols({
        bitmapFields: new Map([
          ["MotorCtrl", new Map([["Running", { offset: 0, width: 1 }]])],
        ]),
        registerMemberTypes: new Map([["MOTOR_CTRL", "MotorCtrl"]]),
      });
      const ctx = createMockContext({
        identifiers: ["MOTOR", "CTRL", "Running"],
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("MOTOR_CTRL =");
      expect(result).toContain("& ~(1 << 0)");
    });
  });

  describe("handleScopedRegisterMemberBitmapField (SCOPED_REGISTER_MEMBER_BITMAP_FIELD)", () => {
    const getHandler = () =>
      bitmapHandlers.find(
        ([kind]) => kind === AssignmentKind.SCOPED_REGISTER_MEMBER_BITMAP_FIELD,
      )?.[1];

    it("generates this-prefixed scoped register bitmap field", () => {
      CodeGenState.currentScope = "Motor";
      setupMockSymbols({
        bitmapFields: new Map([
          ["ICR1Bits", new Map([["LED", { offset: 6, width: 2 }]])],
        ]),
        registerMemberTypes: new Map([["Motor_GPIO7_ICR1", "ICR1Bits"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "ICR1", "LED"],
        hasThis: true,
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("Motor_GPIO7_ICR1 =");
      expect(result).toContain("<< 6");
    });

    it("generates scope-prefixed register bitmap field", () => {
      const validateCrossScopeVisibility = vi.fn();
      setupMockGenerator({
        validateCrossScopeVisibility,
      });
      setupMockSymbols({
        bitmapFields: new Map([
          ["ICR1Bits", new Map([["LED", { offset: 6, width: 2 }]])],
        ]),
        registerMemberTypes: new Map([["Motor_GPIO7_ICR1", "ICR1Bits"]]),
      });
      const ctx = createMockContext({
        identifiers: ["Motor", "GPIO7", "ICR1", "LED"],
        hasThis: false,
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("Motor_GPIO7_ICR1 =");
      expect(validateCrossScopeVisibility).toHaveBeenCalledWith(
        "Motor",
        "GPIO7",
      );
    });

    it("throws when 'this' used outside scope", () => {
      CodeGenState.currentScope = null;
      const ctx = createMockContext({
        identifiers: ["GPIO7", "ICR1", "LED"],
        hasThis: true,
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "'this' can only be used inside a scope",
      );
    });

    it("generates write-only pattern for wo register", () => {
      CodeGenState.currentScope = "Motor";
      setupMockSymbols({
        bitmapFields: new Map([
          ["SetBits", new Map([["LED", { offset: 0, width: 1 }]])],
        ]),
        registerMemberTypes: new Map([["Motor_GPIO7_SET", "SetBits"]]),
        registerMemberAccess: new Map([["Motor_GPIO7_SET", "wo"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "SET", "LED"],
        hasThis: true,
      });

      const result = getHandler()!(ctx);

      // Write-only should not use RMW pattern
      expect(result).not.toContain("& ~");
      expect(result).toContain("Motor_GPIO7_SET =");
    });

    it("generates write-only pattern for w1s register", () => {
      CodeGenState.currentScope = "Motor";
      setupMockSymbols({
        bitmapFields: new Map([
          ["SetBits", new Map([["LED", { offset: 3, width: 1 }]])],
        ]),
        registerMemberTypes: new Map([["Motor_GPIO7_SET", "SetBits"]]),
        registerMemberAccess: new Map([["Motor_GPIO7_SET", "w1s"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "SET", "LED"],
        hasThis: true,
      });

      const result = getHandler()!(ctx);

      expect(result).not.toContain("& ~");
      expect(result).toContain("<< 3");
    });

    it("generates write-only pattern for w1c register", () => {
      CodeGenState.currentScope = "Motor";
      setupMockSymbols({
        bitmapFields: new Map([
          ["ClearBits", new Map([["LED", { offset: 5, width: 1 }]])],
        ]),
        registerMemberTypes: new Map([["Motor_GPIO7_CLR", "ClearBits"]]),
        registerMemberAccess: new Map([["Motor_GPIO7_CLR", "w1c"]]),
      });
      const ctx = createMockContext({
        identifiers: ["GPIO7", "CLR", "LED"],
        hasThis: true,
      });

      const result = getHandler()!(ctx);

      expect(result).not.toContain("& ~");
      expect(result).toContain("<< 5");
    });
  });
});
