/**
 * Unit tests for ArrayHandlers.
 * Tests array assignment handler functions.
 */

import { describe, expect, it, vi } from "vitest";
import arrayHandlers from "../ArrayHandlers";
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
    identifiers: ["arr"],
    subscripts: [{ mockValue: "i", start: { line: 1 } } as never],
    isCompound: false,
    cnextOp: "<-",
    cOp: "=",
    generatedValue: "value",
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

describe("ArrayHandlers", () => {
  describe("handler registration", () => {
    it("registers all expected array assignment kinds", () => {
      const kinds = arrayHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.ARRAY_ELEMENT);
      expect(kinds).toContain(AssignmentKind.MULTI_DIM_ARRAY_ELEMENT);
      expect(kinds).toContain(AssignmentKind.ARRAY_SLICE);
    });

    it("exports exactly 3 handlers", () => {
      expect(arrayHandlers.length).toBe(3);
    });
  });

  describe("handleArrayElement (ARRAY_ELEMENT)", () => {
    const getHandler = () =>
      arrayHandlers.find(
        ([kind]) => kind === AssignmentKind.ARRAY_ELEMENT,
      )?.[1];

    it("generates simple array element assignment", () => {
      const deps = createMockDeps({
        generateExpression: vi.fn().mockReturnValue("i"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("arr[i] = value;");
    });

    it("handles compound assignment", () => {
      const deps = createMockDeps({
        generateExpression: vi.fn().mockReturnValue("0"),
      });
      const ctx = createMockContext({
        isCompound: true,
        cnextOp: "+<-",
        cOp: "+=",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("arr[0] += value;");
    });

    it("uses correct identifier", () => {
      const deps = createMockDeps({
        generateExpression: vi.fn().mockReturnValue("idx"),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("buffer[idx] = value;");
    });
  });

  describe("handleMultiDimArrayElement (MULTI_DIM_ARRAY_ELEMENT)", () => {
    const getHandler = () =>
      arrayHandlers.find(
        ([kind]) => kind === AssignmentKind.MULTI_DIM_ARRAY_ELEMENT,
      )?.[1];

    it("generates multi-dimensional array access", () => {
      const deps = createMockDeps({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("i")
          .mockReturnValueOnce("j"),
      });
      const ctx = createMockContext({
        identifiers: ["matrix"],
        subscripts: [
          { mockValue: "i", start: { line: 1 } } as never,
          { mockValue: "j", start: { line: 1 } } as never,
        ],
        subscriptDepth: 2,
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("matrix[i][j] = value;");
    });

    it("handles 3D array access", () => {
      const deps = createMockDeps({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("x")
          .mockReturnValueOnce("y")
          .mockReturnValueOnce("z"),
      });
      const ctx = createMockContext({
        identifiers: ["cube"],
        subscripts: [
          { mockValue: "x", start: { line: 1 } } as never,
          { mockValue: "y", start: { line: 1 } } as never,
          { mockValue: "z", start: { line: 1 } } as never,
        ],
        subscriptDepth: 3,
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("cube[x][y][z] = value;");
    });

    it("performs bounds checking when type info available", () => {
      const typeRegistry = new Map([
        ["matrix", { arrayDimensions: [10, 10], baseType: "i32" }],
      ]);
      const checkArrayBounds = vi.fn();
      const deps = createMockDeps({
        typeRegistry,
        checkArrayBounds,
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("5")
          .mockReturnValueOnce("3"),
      });
      const ctx = createMockContext({
        identifiers: ["matrix"],
        subscripts: [
          { mockValue: "5", start: { line: 10 } } as never,
          { mockValue: "3", start: { line: 10 } } as never,
        ],
      });

      getHandler()!(ctx, deps);

      expect(checkArrayBounds).toHaveBeenCalledWith(
        "matrix",
        [10, 10],
        ctx.subscripts,
        10,
      );
    });

    it("handles compound assignment", () => {
      const deps = createMockDeps({
        generateExpression: vi
          .fn()
          .mockReturnValueOnce("0")
          .mockReturnValueOnce("1"),
      });
      const ctx = createMockContext({
        identifiers: ["grid"],
        subscripts: [
          { mockValue: "0", start: { line: 1 } } as never,
          { mockValue: "1", start: { line: 1 } } as never,
        ],
        isCompound: true,
        cOp: "-=",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("grid[0][1] -= value;");
    });
  });

  describe("handleArraySlice (ARRAY_SLICE)", () => {
    const getHandler = () =>
      arrayHandlers.find(([kind]) => kind === AssignmentKind.ARRAY_SLICE)?.[1];

    it("generates memcpy for valid slice assignment", () => {
      const typeRegistry = new Map([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      const markNeedsString = vi.fn();
      const deps = createMockDeps({
        typeRegistry,
        markNeedsString,
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(10),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        subscripts: [
          { mockValue: "0", start: { line: 1 } } as never,
          { mockValue: "10", start: { line: 1 } } as never,
        ],
        generatedValue: "source",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("memcpy(&buffer[0], &source, 10);");
      expect(markNeedsString).toHaveBeenCalled();
    });

    it("generates memcpy for string slice", () => {
      const typeRegistry = new Map([
        [
          "str",
          {
            isString: true,
            stringCapacity: 32,
            isArray: false,
            baseType: "string",
          },
        ],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(5)
          .mockReturnValueOnce(10),
      });
      const ctx = createMockContext({
        identifiers: ["str"],
        subscripts: [
          { mockValue: "5", start: { line: 1 } } as never,
          { mockValue: "10", start: { line: 1 } } as never,
        ],
        generatedValue: "data",
      });

      const result = getHandler()!(ctx, deps);

      expect(result).toBe("memcpy(&str[5], &data, 10);");
    });

    it("throws on compound assignment", () => {
      const typeRegistry = new Map([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(10),
      });
      const ctx = createMockContext({
        isCompound: true,
        cnextOp: "+<-",
        subscripts: [
          { mockValue: "0", start: { line: 1 } } as never,
          { mockValue: "10", start: { line: 1 } } as never,
        ],
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Compound assignment operators not supported for slice assignment",
      );
    });

    it("throws on multi-dimensional array", () => {
      const typeRegistry = new Map([
        ["matrix", { arrayDimensions: [10, 10], baseType: "u8" }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
      });
      const ctx = createMockContext({
        identifiers: ["matrix"],
        subscripts: [
          { mockValue: "0", start: { line: 5 } } as never,
          { mockValue: "10", start: { line: 5 } } as never,
        ],
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Slice assignment is only valid on one-dimensional arrays",
      );
    });

    it("throws on non-constant offset", () => {
      const typeRegistry = new Map([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        tryEvaluateConstant: vi.fn().mockReturnValue(undefined),
      });
      const ctx = createMockContext({
        subscripts: [
          { mockValue: "i", start: { line: 3 } } as never,
          { mockValue: "10", start: { line: 3 } } as never,
        ],
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Slice assignment offset must be a compile-time constant",
      );
    });

    it("throws on non-constant length", () => {
      const typeRegistry = new Map([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(undefined),
      });
      const ctx = createMockContext({
        subscripts: [
          { mockValue: "0", start: { line: 3 } } as never,
          { mockValue: "len", start: { line: 3 } } as never,
        ],
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Slice assignment length must be a compile-time constant",
      );
    });

    it("throws on out of bounds access", () => {
      const typeRegistry = new Map([
        ["buffer", { arrayDimensions: [50], baseType: "u8" }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(40)
          .mockReturnValueOnce(20),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        subscripts: [
          { mockValue: "40", start: { line: 7 } } as never,
          { mockValue: "20", start: { line: 7 } } as never,
        ],
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Slice assignment out of bounds",
      );
    });

    it("throws on negative offset", () => {
      const typeRegistry = new Map([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(-1)
          .mockReturnValueOnce(10),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        subscripts: [
          { mockValue: "-1", start: { line: 2 } } as never,
          { mockValue: "10", start: { line: 2 } } as never,
        ],
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Slice assignment offset cannot be negative",
      );
    });

    it("throws on zero length", () => {
      const typeRegistry = new Map([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(0),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        subscripts: [
          { mockValue: "0", start: { line: 2 } } as never,
          { mockValue: "0", start: { line: 2 } } as never,
        ],
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Slice assignment length must be positive",
      );
    });

    it("throws on negative length", () => {
      const typeRegistry = new Map([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(-5),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        subscripts: [
          { mockValue: "0", start: { line: 2 } } as never,
          { mockValue: "-5", start: { line: 2 } } as never,
        ],
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Slice assignment length must be positive",
      );
    });

    it("throws when buffer size cannot be determined", () => {
      const typeRegistry = new Map([["unknown", { baseType: "u8" }]]);
      const deps = createMockDeps({
        typeRegistry,
        tryEvaluateConstant: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(10),
      });
      const ctx = createMockContext({
        identifiers: ["unknown"],
        subscripts: [
          { mockValue: "0", start: { line: 2 } } as never,
          { mockValue: "10", start: { line: 2 } } as never,
        ],
      });

      expect(() => getHandler()!(ctx, deps)).toThrow(
        "Cannot determine buffer size",
      );
    });
  });
});
