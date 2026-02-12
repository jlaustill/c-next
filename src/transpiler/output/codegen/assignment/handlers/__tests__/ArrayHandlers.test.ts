/**
 * Unit tests for ArrayHandlers.
 * Tests array assignment handler functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock TypeValidator before imports (use vi.hoisted for hoisted mock reference)
const { mockCheckArrayBounds } = vi.hoisted(() => ({
  mockCheckArrayBounds: vi.fn(),
}));

vi.mock("../../../TypeValidator", () => ({
  default: {
    checkArrayBounds: mockCheckArrayBounds,
  },
}));

import arrayHandlers from "../ArrayHandlers";
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
  const identifiers = overrides.identifiers ?? ["arr"];
  const resolvedTarget = overrides.resolvedTarget ?? `${identifiers[0]}[i]`;
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? identifiers[0];

  return {
    identifiers,
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
    resolvedTarget,
    resolvedBaseIdentifier,
    ...overrides,
  } as IAssignmentContext;
}

describe("ArrayHandlers", () => {
  beforeEach(() => {
    CodeGenState.reset();
    HandlerTestUtils.setupMockGenerator();
    HandlerTestUtils.setupMockSymbols();
  });

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
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi.fn().mockReturnValue("i"),
      });
      const ctx = createMockContext();

      const result = getHandler()!(ctx);

      expect(result).toBe("arr[i] = value;");
    });

    it("handles compound assignment", () => {
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi.fn().mockReturnValue("0"),
      });
      const ctx = createMockContext({
        isCompound: true,
        cnextOp: "+<-",
        cOp: "+=",
        resolvedTarget: "arr[0]",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("arr[0] += value;");
    });

    it("uses correct identifier", () => {
      HandlerTestUtils.setupMockGenerator({
        generateExpression: vi.fn().mockReturnValue("idx"),
      });
      const ctx = createMockContext({
        identifiers: ["buffer"],
        resolvedTarget: "buffer[idx]",
        resolvedBaseIdentifier: "buffer",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("buffer[idx] = value;");
    });
  });

  describe("handleMultiDimArrayElement (MULTI_DIM_ARRAY_ELEMENT)", () => {
    const getHandler = () =>
      arrayHandlers.find(
        ([kind]) => kind === AssignmentKind.MULTI_DIM_ARRAY_ELEMENT,
      )?.[1];

    it("generates multi-dimensional array access", () => {
      HandlerTestUtils.setupMockGenerator({
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
        resolvedTarget: "matrix[i][j]",
        resolvedBaseIdentifier: "matrix",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("matrix[i][j] = value;");
    });

    it("handles 3D array access", () => {
      HandlerTestUtils.setupMockGenerator({
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
        resolvedTarget: "cube[x][y][z]",
        resolvedBaseIdentifier: "cube",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("cube[x][y][z] = value;");
    });

    it("performs bounds checking when type info available", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["matrix", { arrayDimensions: [10, 10], baseType: "i32" }],
      ]);
      mockCheckArrayBounds.mockClear();
      HandlerTestUtils.setupMockGenerator({
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

      getHandler()!(ctx);

      expect(mockCheckArrayBounds).toHaveBeenCalledWith(
        "matrix",
        [10, 10],
        ctx.subscripts,
        10,
        expect.any(Function), // tryEvaluateConstant callback
      );
    });

    it("handles compound assignment", () => {
      HandlerTestUtils.setupMockGenerator({
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
        resolvedTarget: "grid[0][1]",
        resolvedBaseIdentifier: "grid",
      });

      const result = getHandler()!(ctx);

      expect(result).toBe("grid[0][1] -= value;");
    });
  });

  describe("handleArraySlice (ARRAY_SLICE)", () => {
    const getHandler = () =>
      arrayHandlers.find(([kind]) => kind === AssignmentKind.ARRAY_SLICE)?.[1];

    it("generates memcpy for valid slice assignment", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator({
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

      const result = getHandler()!(ctx);

      expect(result).toBe("memcpy(&buffer[0], &source, 10);");
      expect(CodeGenState.needsString).toBe(true);
    });

    it("generates memcpy for string slice", () => {
      HandlerTestUtils.setupMockTypeRegistry([
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
      HandlerTestUtils.setupMockGenerator({
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

      const result = getHandler()!(ctx);

      expect(result).toBe("memcpy(&str[5], &data, 10);");
    });

    it("throws on compound assignment", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator({
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

      expect(() => getHandler()!(ctx)).toThrow(
        "Compound assignment operators not supported for slice assignment",
      );
    });

    it("throws on multi-dimensional array", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["matrix", { arrayDimensions: [10, 10], baseType: "u8" }],
      ]);
      const ctx = createMockContext({
        identifiers: ["matrix"],
        subscripts: [
          { mockValue: "0", start: { line: 5 } } as never,
          { mockValue: "10", start: { line: 5 } } as never,
        ],
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "Slice assignment is only valid on one-dimensional arrays",
      );
    });

    it("throws on non-constant offset", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator({
        tryEvaluateConstant: vi.fn().mockReturnValue(undefined),
      });
      const ctx = createMockContext({
        subscripts: [
          { mockValue: "i", start: { line: 3 } } as never,
          { mockValue: "10", start: { line: 3 } } as never,
        ],
      });

      expect(() => getHandler()!(ctx)).toThrow(
        "Slice assignment offset must be a compile-time constant",
      );
    });

    it("throws on non-constant length", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator({
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

      expect(() => getHandler()!(ctx)).toThrow(
        "Slice assignment length must be a compile-time constant",
      );
    });

    it("throws on out of bounds access", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["buffer", { arrayDimensions: [50], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator({
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

      expect(() => getHandler()!(ctx)).toThrow(
        "Slice assignment out of bounds",
      );
    });

    it("throws on negative offset", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator({
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

      expect(() => getHandler()!(ctx)).toThrow(
        "Slice assignment offset cannot be negative",
      );
    });

    it("throws on zero length", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator({
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

      expect(() => getHandler()!(ctx)).toThrow(
        "Slice assignment length must be positive",
      );
    });

    it("throws on negative length", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["buffer", { arrayDimensions: [100], baseType: "u8" }],
      ]);
      HandlerTestUtils.setupMockGenerator({
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

      expect(() => getHandler()!(ctx)).toThrow(
        "Slice assignment length must be positive",
      );
    });

    it("throws when buffer size cannot be determined", () => {
      HandlerTestUtils.setupMockTypeRegistry([["unknown", { baseType: "u8" }]]);
      HandlerTestUtils.setupMockGenerator({
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

      expect(() => getHandler()!(ctx)).toThrow("Cannot determine buffer size");
    });
  });
});
