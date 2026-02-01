/**
 * Unit tests for StringHandlers.
 * Tests the string assignment handler functions.
 */

import { describe, expect, it, vi } from "vitest";
import stringHandlers from "../StringHandlers";
import AssignmentKind from "../../AssignmentKind";
import IAssignmentContext from "../../IAssignmentContext";
import IHandlerDeps from "../IHandlerDeps";

/**
 * Create mock dependencies for testing.
 * Uses type casting to allow partial mocks for testing.
 */
function createMockDeps(overrides: Record<string, unknown> = {}): IHandlerDeps {
  const base = {
    typeRegistry: new Map(),
    symbols: {
      structFields: new Map(),
      structFieldDimensions: new Map(),
      registerMemberAccess: new Map(),
      registerBaseAddresses: new Map(),
      registerMemberOffsets: new Map(),
    },
    currentScope: undefined,
    generateAssignmentTarget: vi.fn().mockReturnValue("target"),
    generateExpression: vi.fn().mockReturnValue("0"),
    markNeedsString: vi.fn(),
    isKnownScope: vi.fn().mockReturnValue(false),
    validateCrossScopeVisibility: vi.fn(),
    analyzeMemberChainForBitAccess: vi.fn().mockReturnValue({
      isBitAccess: false,
    }),
    tryEvaluateConstant: vi.fn().mockReturnValue(undefined),
    ...overrides,
  };
  return base as unknown as IHandlerDeps;
}

/**
 * Create mock context for testing
 */
function createMockContext(
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  return {
    identifiers: ["testVar"],
    subscripts: [],
    isCompound: false,
    cnextOp: "<-",
    cOp: "=",
    generatedValue: '"hello"',
    targetCtx: {} as never,
    ...overrides,
  } as IAssignmentContext;
}

describe("StringHandlers", () => {
  describe("handler registration", () => {
    it("registers all expected string assignment kinds", () => {
      const kinds = stringHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.STRING_SIMPLE);
      expect(kinds).toContain(AssignmentKind.STRING_THIS_MEMBER);
      expect(kinds).toContain(AssignmentKind.STRING_GLOBAL);
      expect(kinds).toContain(AssignmentKind.STRING_STRUCT_FIELD);
      expect(kinds).toContain(AssignmentKind.STRING_ARRAY_ELEMENT);
      expect(kinds).toContain(AssignmentKind.STRING_STRUCT_ARRAY_ELEMENT);
    });

    it("uses same handler for STRING_SIMPLE and STRING_GLOBAL", () => {
      const simpleHandler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_SIMPLE,
      )?.[1];
      const globalHandler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_GLOBAL,
      )?.[1];

      expect(simpleHandler).toBe(globalHandler);
    });
  });

  describe("handleSimpleStringAssignment (STRING_SIMPLE)", () => {
    it("generates strncpy with null terminator", () => {
      const typeRegistry = new Map([
        ["testVar", { stringCapacity: 32, baseType: "string" }],
      ]);
      const deps = createMockDeps({ typeRegistry });
      const ctx = createMockContext();

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_SIMPLE,
      )?.[1];
      const result = handler!(ctx, deps);

      expect(result).toContain("strncpy");
      expect(result).toContain("target");
      expect(result).toContain("32");
      expect(deps.markNeedsString).toHaveBeenCalled();
    });

    it("throws on compound assignment", () => {
      const typeRegistry = new Map([
        ["testVar", { stringCapacity: 32, baseType: "string" }],
      ]);
      const deps = createMockDeps({ typeRegistry });
      const ctx = createMockContext({ isCompound: true, cnextOp: "+<-" });

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_SIMPLE,
      )?.[1];

      expect(() => handler!(ctx, deps)).toThrow(
        "Compound operators not supported for string assignment",
      );
    });
  });

  describe("handleStringThisMember (STRING_THIS_MEMBER)", () => {
    it("generates strncpy for scoped member", () => {
      const typeRegistry = new Map([
        ["TestScope_memberName", { stringCapacity: 64, baseType: "string" }],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        currentScope: "TestScope",
      });
      const ctx = createMockContext({ identifiers: ["memberName"] });

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_THIS_MEMBER,
      )?.[1];
      const result = handler!(ctx, deps);

      expect(result).toContain("strncpy");
      expect(result).toContain("64");
      expect(deps.markNeedsString).toHaveBeenCalled();
    });

    it("throws when used outside scope", () => {
      const deps = createMockDeps({ currentScope: undefined });
      const ctx = createMockContext();

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_THIS_MEMBER,
      )?.[1];

      expect(() => handler!(ctx, deps)).toThrow(
        "'this' can only be used inside a scope",
      );
    });
  });

  describe("handleStringStructField (STRING_STRUCT_FIELD)", () => {
    it("generates strncpy for struct field", () => {
      const typeRegistry = new Map([
        ["person", { baseType: "Person", stringCapacity: undefined }],
      ]);
      const structFields = new Map([
        ["Person", new Map([["name", "string<50>"]])],
      ]);
      const deps = createMockDeps({
        typeRegistry,
        symbols: {
          structFields,
          structFieldDimensions: new Map(),
          registerMemberAccess: new Map(),
          registerBaseAddresses: new Map(),
          registerMemberOffsets: new Map(),
        },
      });
      const ctx = createMockContext({ identifiers: ["person", "name"] });

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_STRUCT_FIELD,
      )?.[1];
      const result = handler!(ctx, deps);

      expect(result).toContain("strncpy");
      expect(result).toContain("person");
      expect(result).toContain("name");
      expect(deps.markNeedsString).toHaveBeenCalled();
    });
  });

  describe("handleStringArrayElement (STRING_ARRAY_ELEMENT)", () => {
    it("generates strncpy for array element", () => {
      const typeRegistry = new Map([
        ["names", { stringCapacity: 20, baseType: "string" }],
      ]);
      const deps = createMockDeps({ typeRegistry });
      const ctx = createMockContext({
        identifiers: ["names"],
        subscripts: [{} as never],
      });

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_ARRAY_ELEMENT,
      )?.[1];
      const result = handler!(ctx, deps);

      expect(result).toContain("strncpy");
      expect(result).toContain("names");
      expect(result).toContain("20");
      expect(deps.markNeedsString).toHaveBeenCalled();
    });
  });

  describe("handleStringStructArrayElement (STRING_STRUCT_ARRAY_ELEMENT)", () => {
    it("generates strncpy for struct field array element", () => {
      const typeRegistry = new Map([
        ["config", { baseType: "Config", stringCapacity: undefined }],
      ]);
      const structFieldDimensions = new Map([
        ["Config", new Map([["items", [10, 33]]])], // 10 items, capacity 32+1
      ]);
      const deps = createMockDeps({
        typeRegistry,
        symbols: {
          structFields: new Map(),
          structFieldDimensions,
          registerMemberAccess: new Map(),
          registerBaseAddresses: new Map(),
          registerMemberOffsets: new Map(),
        },
      });
      const ctx = createMockContext({
        identifiers: ["config", "items"],
        subscripts: [{} as never],
      });

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_STRUCT_ARRAY_ELEMENT,
      )?.[1];
      const result = handler!(ctx, deps);

      expect(result).toContain("strncpy");
      expect(result).toContain("config");
      expect(result).toContain("items");
      // Capacity should be 33 - 1 = 32
      expect(result).toContain("32");
      expect(deps.markNeedsString).toHaveBeenCalled();
    });
  });
});
