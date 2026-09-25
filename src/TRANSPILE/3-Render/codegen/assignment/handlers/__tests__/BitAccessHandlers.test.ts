/**
 * Unit tests for BitAccessHandlers.
 * Tests integer bit access assignment handler functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import bitAccessHandlers from "../BitAccessHandlers";
import AssignmentKind from "../../../../../../transpiler/types/AssignmentKind";
import IAssignmentContext from "../../../../../../transpiler/types/IAssignmentContext";
import TranspileState from "../../../../../TranspileState";
import HandlerTestUtils from "./handlerTestUtils";

/**
 * Create mock context for testing.
 */
function createMockContext(
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  // Default resolved values based on first identifier
  const identifiers = overrides.identifiers ?? ["flags"];
  const resolvedTarget = overrides.resolvedTarget ?? `${identifiers[0]}[3]`;
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? identifiers[0];

  return {
    identifiers,
    ...HandlerTestUtils.subscriptsOf([{ mockValue: "3" } as never]),
    isCompound: false,
    cnextOp: "<-",
    cOp: "=",
    generatedValue: "true",
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
    hasGlobal: false,
    hasMemberAccess: false,
    hasArrayAccess: true,
    postfixOpsCount: 1,
    memberAccessDepth: 0,
    subscriptDepth: 1,
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

let state = new TranspileState();

describe("BitAccessHandlers", () => {
  beforeEach(() => {
    state = new TranspileState();
    HandlerTestUtils.setupMockGenerator(state);
    HandlerTestUtils.setupMockSymbols(state);
  });

  describe("handler registration", () => {
    it("registers all expected bit access kinds", () => {
      const kinds = bitAccessHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.INTEGER_BIT);
      expect(kinds).toContain(AssignmentKind.INTEGER_BIT_RANGE);
      expect(kinds).toContain(AssignmentKind.ARRAY_ELEMENT_BIT);
      expect(kinds).toContain(AssignmentKind.STRUCT_CHAIN_BIT_RANGE);
    });

    it("exports exactly 5 handlers", () => {
      // Issue #1115: THIS_BIT / THIS_BIT_RANGE retired -- `this.` bit access now
      // classifies as INTEGER_BIT / INTEGER_BIT_RANGE, which these handlers serve.
      expect(bitAccessHandlers).toHaveLength(4);
    });
  });

  describe("handleIntegerBit (INTEGER_BIT)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.INTEGER_BIT,
      )?.[1];

    it("generates single bit read-modify-write", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["flags", { baseType: "u32" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("3"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(result).toContain("flags =");
      expect(result).toContain("& ~(1U << 3)");
      expect(result).toContain("1U << 3");
    });

    it("uses 1ULL for 64-bit types", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["flags", { baseType: "u64" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("32"),
      });
      const ctx = createMockContext({
        ...HandlerTestUtils.subscriptsOf([{ mockValue: "32" } as never]),
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("1ULL << 32");
    });

    it("uses 1ULL for signed 64-bit types", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["flags", { baseType: "i64" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("bit"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      // i64 uses 1ULL for the mask and cast for the value
      expect(result).toContain("1ULL << bit");
    });

    it("converts true to 1", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["flags", { baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("0"),
      });
      const ctx = createMockContext({
        generatedValue: "true",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("| (1U << 0)");
    });

    it("converts false to 0", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["flags", { baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi.fn().mockReturnValue("0"),
      });
      const ctx = createMockContext({
        generatedValue: "false",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("| (0U << 0)");
    });

    it("delegates to float bit write for float types", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["f", { baseType: "f32" }],
      ]);
      const generateFloatBitWrite = vi
        .fn()
        .mockReturnValue("float_bit_write_result");
      HandlerTestUtils.setupMockGenerator(state, {
        generateFloatBitWrite,
        generateExpression: vi.fn().mockReturnValue("3"),
      });
      const ctx = createMockContext({
        identifiers: ["f"],
      });

      const result = getHandler()!(ctx);

      expect(generateFloatBitWrite).toHaveBeenCalled();
      expect(result).toBe("float_bit_write_result");
    });

    // #1322: compound assignment on a bit index, bit range, slice, bitmap field
    // or string is E0857 in pass 2.1 -- one decision where `output/` had six
    // throws with four messages, and `validateNotCompound` defined twice verbatim.
    // The pipeline halts before these handlers run. Covered by
    // `1-Analyze/__tests__/CompoundAssignmentAnalyzer.test.ts` plus
    // `tests/compound-assign/` and `tests/string-assignment/`.
  });

  describe("handleIntegerBitRange (INTEGER_BIT_RANGE)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.INTEGER_BIT_RANGE,
      )?.[1];

    it("generates bit range read-modify-write", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["flags", { baseType: "u32" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("4"),
      });
      const ctx = createMockContext({
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "4" } as never,
        ]),
        generatedValue: "5",
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("flags =");
      expect(result).toContain("& ~(");
      expect(result).toContain("<< 0");
    });

    it("uses correct mask for bit range", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["data", { baseType: "u16" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("4")
          .mockReturnValueOnce("8"),
      });
      const ctx = createMockContext({
        identifiers: ["data"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "4" } as never,
          { mockValue: "8" } as never,
        ]),
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      // For constant width, BitUtils generates hex mask
      expect(result).toContain("0xFFU");
      expect(result).toContain("<< 4");
    });

    it("uses ULL suffix for 64-bit bit range mask", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["flags", { baseType: "u64" }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("32")
          .mockReturnValueOnce("16"),
      });
      const ctx = createMockContext({
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "32" } as never,
          { mockValue: "16" } as never,
        ]),
        generatedValue: "value",
      });

      const result = getHandler()!(ctx);

      // 64-bit type uses ULL suffix on the hex mask
      expect(result).toContain("0xFFFFULL");
    });

    it("delegates to float bit write for float types", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["f", { baseType: "f32" }],
      ]);
      const generateFloatBitWrite = vi
        .fn()
        .mockReturnValue("float_range_write_result");
      HandlerTestUtils.setupMockGenerator(state, {
        generateFloatBitWrite,
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("8"),
      });
      const ctx = createMockContext({
        identifiers: ["f"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "8" } as never,
        ]),
      });

      const result = getHandler()!(ctx);

      expect(generateFloatBitWrite).toHaveBeenCalledWith(
        "f",
        expect.anything(),
        "0",
        "8",
        "true",
      );
      expect(result).toBe("float_range_write_result");
    });
  });

  describe("handleArrayElementBit (ARRAY_ELEMENT_BIT)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.ARRAY_ELEMENT_BIT,
      )?.[1];

    it("generates array element bit assignment for 1D array", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["arr", { baseType: "u32", arrayDimensions: [10] }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("i")
          .mockReturnValueOnce("BIT"),
      });
      const ctx = createMockContext({
        identifiers: ["arr"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "i" } as never,
          { mockValue: "BIT" } as never,
        ]),
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("arr[i] =");
      expect(result).toContain("& ~(1U << BIT)");
    });

    it("generates array element bit assignment for 2D array", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["matrix", { baseType: "u16", arrayDimensions: [10, 10] }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("i")
          .mockReturnValueOnce("j")
          .mockReturnValueOnce("FIELD_BIT"),
      });
      const ctx = createMockContext({
        identifiers: ["matrix"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "i" } as never,
          { mockValue: "j" } as never,
          { mockValue: "FIELD_BIT" } as never,
        ]),
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("matrix[i][j] =");
      expect(result).toContain("& ~(1U << FIELD_BIT)");
    });

    it("uses 1ULL for 64-bit array element", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["arr", { baseType: "u64", arrayDimensions: [5] }],
      ]);
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("40"),
      });
      const ctx = createMockContext({
        identifiers: ["arr"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "40" } as never,
        ]),
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("1ULL << 40");
    });

    it("throws when variable is not an array", () => {
      HandlerTestUtils.setupMockTypeRegistry(state, [
        ["notArray", { baseType: "u32" }],
      ]);
      const ctx = createMockContext({
        identifiers: ["notArray"],
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "agree on a variable's array-ness",
      );
    });
  });

  describe("handleStructChainBitRange (STRUCT_CHAIN_BIT_RANGE)", () => {
    const getHandler = () =>
      bitAccessHandlers.find(
        ([kind]) => kind === AssignmentKind.STRUCT_CHAIN_BIT_RANGE,
      )?.[1];

    it("generates bit range write through struct chain", () => {
      HandlerTestUtils.setupMockGenerator(state, {
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0") // array index
          .mockReturnValueOnce("0") // bit range start
          .mockReturnValueOnce("4"), // bit range width
      });

      // The planned chain for devices[0].control[0, 4]. #1445: each op states
      // its kind, where the node mock said it by which accessor returned null.
      // The renders still route through the mocked generator above, in the
      // same order, so the `mockReturnValueOnce` chain reads unchanged.
      const mockPostfixOps = [
        {
          kind: "subscript" as const,
          indexCount: 1,
          renderIndexes: () => [
            HandlerTestUtils.planner().generateExpression(null as never),
          ],
        },
        { kind: "member" as const, name: "control" },
        {
          kind: "subscript" as const,
          indexCount: 2,
          renderIndexes: () => [
            HandlerTestUtils.planner().generateExpression(null as never),
            HandlerTestUtils.planner().generateExpression(null as never),
          ],
        },
      ];

      const ctx = createMockContext({
        identifiers: ["devices", "control"],
        ...HandlerTestUtils.subscriptsOf([
          { mockValue: "0" } as never,
          { mockValue: "0" } as never,
          { mockValue: "4" } as never,
        ]),
        postfixOps: mockPostfixOps as never,
        generatedValue: "15",
        hasMemberAccess: true,
        hasArrayAccess: true,
        lastSubscriptExprCount: 2,
      });

      const result = getHandler()!(ctx);

      expect(result).toContain("devices[0].control =");
      expect(result).toContain("& ~(");
      expect(result).toContain("<< 0");
      expect(result).toContain("15");
    });
  });
});
