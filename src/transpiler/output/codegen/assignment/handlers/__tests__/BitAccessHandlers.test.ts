/**
 * Unit tests for BitAccessHandlers.
 * Tests integer bit access assignment handler functions.
 */

import { describe, expect, it, vi } from "vitest";
import bitAccessHandlers from "../BitAccessHandlers";
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
    identifiers: ["flags"],
    subscripts: [{ mockValue: "3" } as never],
    isCompound: false,
    cnextOp: "<-",
    cOp: "=",
    generatedValue: "true",
    targetCtx: {} as never,
    hasThis: false,
    hasGlobal: false,
    hasMemberAccess: false,
    hasArrayAccess: true,
    postfixOpsCount: 1,
    memberAccessDepth: 0,
    subscriptDepth: 1,
    isSimpleIdentifier: false,
    isSimpleThisAccess: false,
    isSimpleGlobalAccess: false,
    ...overrides,
  } as IAssignmentContext;
}

describe("BitAccessHandlers", () => {
  describe("handler registration", () => {
    it("registers all expected bit access kinds", () => {
      const kinds = bitAccessHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.INTEGER_BIT);
      expect(kinds).toContain(AssignmentKind.INTEGER_BIT_RANGE);
      expect(kinds).toContain(AssignmentKind.STRUCT_MEMBER_BIT);
      expect(kinds).toContain(AssignmentKind.ARRAY_ELEMENT_BIT);
      expect(kinds).toContain(AssignmentKind.STRUCT_CHAIN_BIT_RANGE);
    });

    it("exports exactly 5 handlers", () => {
      expect(bitAccessHandlers.length).toBe(5);
    });
  });

  describe("handleIntegerBit (INTEGER_BIT)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.INTEGER_BIT,
      )?.[1];

    it("generates single bit read-modify-write", () => {
      const typeRegistry = new Map([["flags", { baseType: "u32" }]]);
      const deps = createMockDeps({
        typeRegistry,
        generateExpression: vi.fn().mockReturnValue("3"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("flags =");
      expect(result).toContain("& ~(1 << 3)");
      expect(result).toContain("1 << 3");
    });

    it("uses 1ULL for 64-bit types", () => {
      const typeRegistry = new Map([["flags", { baseType: "u64" }]]);
      const deps = createMockDeps({
        typeRegistry,
        generateExpression: vi.fn().mockReturnValue("32"),
      });
      const ctx = createMockContext({
        subscripts: [{ mockValue: "32" } as never],
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("1ULL << 32");
    });

    it("uses 1ULL for signed 64-bit types", () => {
      const typeRegistry = new Map([["flags", { baseType: "i64" }]]);
      const deps = createMockDeps({
        typeRegistry,
        generateExpression: vi.fn().mockReturnValue("bit"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx, deps);

      // i64 uses 1ULL for the mask and cast for the value
      expect(result).toContain("1ULL << bit");
    });

    it("converts true to 1", () => {
      const typeRegistry = new Map([["flags", { baseType: "u8" }]]);
      const deps = createMockDeps({
        typeRegistry,
        generateExpression: vi.fn().mockReturnValue("0"),
      });
      const ctx = createMockContext({
        generatedValue: "true",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("| (1 << 0)");
    });

    it("converts false to 0", () => {
      const typeRegistry = new Map([["flags", { baseType: "u8" }]]);
      const deps = createMockDeps({
        typeRegistry,
        generateExpression: vi.fn().mockReturnValue("0"),
      });
      const ctx = createMockContext({
        generatedValue: "false",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("| (0 << 0)");
    });

    it("delegates to float bit write for float types", () => {
      const typeRegistry = new Map([["f", { baseType: "f32" }]]);
      const generateFloatBitWrite = vi
        .fn()
        .mockReturnValue("float_bit_write_result");
      const deps = createMockDeps({
        typeRegistry,
        generateFloatBitWrite,
        generateExpression: vi.fn().mockReturnValue("3"),
      });
      const ctx = createMockContext({
        identifiers: ["f"],
      });

      const result = getHandler()!(ctx, deps);

      expect(generateFloatBitWrite).toHaveBeenCalled();
      expect(result).toBe("float_bit_write_result");
    });

    it("throws on compound assignment", () => {
      const deps = createMockDeps();
      const ctx = createMockContext({
        isCompound: true,
        cnextOp: "+<-",
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Compound assignment operators not supported for bit field access",
      );
    });
  });

  describe("handleIntegerBitRange (INTEGER_BIT_RANGE)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.INTEGER_BIT_RANGE,
      )?.[1];

    it("generates bit range read-modify-write", () => {
      const typeRegistry = new Map([["flags", { baseType: "u32" }]]);
      const deps = createMockDeps({
        typeRegistry,
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("4"),
      });
      const ctx = createMockContext({
        subscripts: [{ mockValue: "0" } as never, { mockValue: "4" } as never],
        generatedValue: "5",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("flags =");
      expect(result).toContain("& ~(");
      expect(result).toContain("<< 0");
    });

    it("uses correct mask for bit range", () => {
      const typeRegistry = new Map([["data", { baseType: "u16" }]]);
      const deps = createMockDeps({
        typeRegistry,
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("4")
          .mockReturnValueOnce("8"),
      });
      const ctx = createMockContext({
        identifiers: ["data"],
        subscripts: [{ mockValue: "4" } as never, { mockValue: "8" } as never],
        generatedValue: "value",
      });

      const result = getHandler()!(ctx, deps);

      // For constant width, BitUtils generates hex mask
      expect(result).toContain("0xFFU");
      expect(result).toContain("<< 4");
    });

    it("uses ULL suffix for 64-bit bit range mask", () => {
      const typeRegistry = new Map([["flags", { baseType: "u64" }]]);
      const deps = createMockDeps({
        typeRegistry,
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("32")
          .mockReturnValueOnce("16"),
      });
      const ctx = createMockContext({
        subscripts: [
          { mockValue: "32" } as never,
          { mockValue: "16" } as never,
        ],
        generatedValue: "value",
      });

      const result = getHandler()!(ctx, deps);

      // 64-bit type uses ULL suffix on the hex mask
      expect(result).toContain("0xFFFFULL");
    });

    it("delegates to float bit write for float types", () => {
      const typeRegistry = new Map([["f", { baseType: "f32" }]]);
      const generateFloatBitWrite = vi
        .fn()
        .mockReturnValue("float_range_write_result");
      const deps = createMockDeps({
        typeRegistry,
        generateFloatBitWrite,
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
      });
      const ctx = createMockContext({
        identifiers: ["f"],
        subscripts: [{ mockValue: "0" } as never, { mockValue: "8" } as never],
      });

      const result = getHandler()!(ctx, deps);

      expect(generateFloatBitWrite).toHaveBeenCalledWith(
        "f",
        expect.anything(),
        "0",
        "8",
        "true",
      );
      expect(result).toBe("float_range_write_result");
    });

    it("throws on compound assignment", () => {
      const deps = createMockDeps();
      const ctx = createMockContext({
        isCompound: true,
        cnextOp: "+<-",
        subscripts: [{ mockValue: "0" } as never, { mockValue: "8" } as never],
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Compound assignment operators not supported for bit field access",
      );
    });
  });

  describe("handleStructMemberBit (STRUCT_MEMBER_BIT)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.STRUCT_MEMBER_BIT,
      )?.[1];

    it("generates struct member bit assignment", () => {
      const deps = createMockDeps({
        generateAssignmentTarget: vi.fn().mockReturnValue("item.byte"),
        generateExpression: vi.fn().mockReturnValue("7"),
      });
      const ctx = createMockContext({
        identifiers: ["item", "byte"],
        subscripts: [{ mockValue: "7" } as never],
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("item.byte =");
      expect(result).toContain("& ~(1 << 7)");
      expect(result).toContain("1 << 7");
    });

    it("throws on compound assignment", () => {
      const deps = createMockDeps();
      const ctx = createMockContext({
        isCompound: true,
        cnextOp: "+<-",
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Compound assignment operators not supported for bit field access",
      );
    });
  });

  describe("handleArrayElementBit (ARRAY_ELEMENT_BIT)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.ARRAY_ELEMENT_BIT,
      )?.[1];

    it("generates array element bit assignment for 1D array", () => {
      const typeRegistry = new Map([
        ["arr", { baseType: "u32", arrayDimensions: [10] }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("i")
          .mockReturnValueOnce("BIT"),
      });
      const ctx = createMockContext({
        identifiers: ["arr"],
        subscripts: [
          { mockValue: "i" } as never,
          { mockValue: "BIT" } as never,
        ],
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("arr[i] =");
      expect(result).toContain("& ~(1 << BIT)");
    });

    it("generates array element bit assignment for 2D array", () => {
      const typeRegistry = new Map([
        ["matrix", { baseType: "u16", arrayDimensions: [10, 10] }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("i")
          .mockReturnValueOnce("j")
          .mockReturnValueOnce("FIELD_BIT"),
      });
      const ctx = createMockContext({
        identifiers: ["matrix"],
        subscripts: [
          { mockValue: "i" } as never,
          { mockValue: "j" } as never,
          { mockValue: "FIELD_BIT" } as never,
        ],
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("matrix[i][j] =");
      expect(result).toContain("& ~(1 << FIELD_BIT)");
    });

    it("uses 1ULL for 64-bit array element", () => {
      const typeRegistry = new Map([
        ["arr", { baseType: "u64", arrayDimensions: [5] }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("40"),
      });
      const ctx = createMockContext({
        identifiers: ["arr"],
        subscripts: [{ mockValue: "0" } as never, { mockValue: "40" } as never],
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("1ULL << 40");
    });

    it("throws when variable is not an array", () => {
      const typeRegistry = new Map([["notArray", { baseType: "u32" }]]);
      const deps = createMockDeps({
        typeRegistry,
      });
      const ctx = createMockContext({
        identifiers: ["notArray"],
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "notArray is not an array",
      );
    });

    it("throws on compound assignment", () => {
      const typeRegistry = new Map([
        ["arr", { baseType: "u32", arrayDimensions: [10] }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
      });
      const ctx = createMockContext({
        isCompound: true,
        cnextOp: "+<-",
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Compound assignment operators not supported for bit field access",
      );
    });
  });

  describe("handleStructChainBitRange (STRUCT_CHAIN_BIT_RANGE)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.STRUCT_CHAIN_BIT_RANGE,
      )?.[1];

    it("generates bit range write through struct chain", () => {
      const deps = createMockDeps({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0") // array index
          .mockReturnValueOnce("0") // bit range start
          .mockReturnValueOnce("4"), // bit range width
      });

      // Create mock postfixOps for devices[0].control[0, 4]
      const mockPostfixOps = [
        {
          IDENTIFIER: () => null,
          expression: () => [{ mockValue: "0" }],
        },
        {
          IDENTIFIER: () => ({ getText: () => "control" }),
          expression: () => [],
        },
        {
          IDENTIFIER: () => null,
          expression: () => [{ mockValue: "0" }, { mockValue: "4" }],
        },
      ];

      const ctx = createMockContext({
        identifiers: ["devices", "control"],
        subscripts: [
          { mockValue: "0" } as never,
          { mockValue: "0" } as never,
          { mockValue: "4" } as never,
        ],
        postfixOps: mockPostfixOps as never,
        generatedValue: "15",
        hasMemberAccess: true,
        hasArrayAccess: true,
        lastSubscriptExprCount: 2,
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toContain("devices[0].control =");
      expect(result).toContain("& ~(");
      expect(result).toContain("<< 0");
      expect(result).toContain("15");
    });

    it("throws on compound assignment", () => {
      const deps = createMockDeps();
      const mockPostfixOps = [
        {
          IDENTIFIER: () => null,
          expression: () => [{ mockValue: "0" }, { mockValue: "4" }],
        },
      ];
      const ctx = createMockContext({
        isCompound: true,
        cnextOp: "+<-",
        postfixOps: mockPostfixOps as never,
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Compound assignment operators not supported for bit field access",
      );
    });
  });
});
