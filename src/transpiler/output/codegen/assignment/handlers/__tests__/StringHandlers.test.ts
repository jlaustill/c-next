/**
 * Unit tests for StringHandlers.
 * Tests the string assignment handler functions.
 */

import { beforeEach, describe, expect, it } from "vitest";
import stringHandlers from "../StringHandlers";
import AssignmentKind from "../../AssignmentKind";
import IAssignmentContext from "../../IAssignmentContext";
import CodeGenState from "../../../../../state/CodeGenState";
import HandlerTestUtils from "./handlerTestUtils";

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
  beforeEach(() => {
    CodeGenState.reset();
    HandlerTestUtils.setupMockGenerator();
    HandlerTestUtils.setupMockSymbols();
  });

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
      HandlerTestUtils.setupMockTypeRegistry([
        ["testVar", { stringCapacity: 32, baseType: "string" }],
      ]);
      const ctx = createMockContext();

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_SIMPLE,
      )?.[1];
      const result = handler!(ctx);

      expect(result).toContain("strncpy");
      expect(result).toContain("target");
      expect(result).toContain("32");
      expect(CodeGenState.needsString).toBe(true);
    });

    it("throws on compound assignment", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["testVar", { stringCapacity: 32, baseType: "string" }],
      ]);
      const ctx = createMockContext({ isCompound: true, cnextOp: "+<-" });

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_SIMPLE,
      )?.[1];

      expect(() => handler!(ctx)).toThrow(
        "Compound operators not supported for string assignment",
      );
    });
  });

  describe("handleStringThisMember (STRING_THIS_MEMBER)", () => {
    it("generates strncpy for scoped member", () => {
      CodeGenState.currentScope = "TestScope";
      HandlerTestUtils.setupMockTypeRegistry([
        ["TestScope_memberName", { stringCapacity: 64, baseType: "string" }],
      ]);
      const ctx = createMockContext({ identifiers: ["memberName"] });

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_THIS_MEMBER,
      )?.[1];
      const result = handler!(ctx);

      expect(result).toContain("strncpy");
      expect(result).toContain("64");
      expect(CodeGenState.needsString).toBe(true);
    });

    it("throws when used outside scope", () => {
      CodeGenState.currentScope = null;
      const ctx = createMockContext();

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_THIS_MEMBER,
      )?.[1];

      expect(() => handler!(ctx)).toThrow(
        "'this' can only be used inside a scope",
      );
    });
  });

  describe("handleStringStructField (STRING_STRUCT_FIELD)", () => {
    it("generates strncpy for struct field", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["person", { baseType: "Person" }],
      ]);
      HandlerTestUtils.setupMockSymbols({
        structFields: new Map([["Person", new Map([["name", "string<50>"]])]]),
      });
      const ctx = createMockContext({ identifiers: ["person", "name"] });

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_STRUCT_FIELD,
      )?.[1];
      const result = handler!(ctx);

      expect(result).toContain("strncpy");
      expect(result).toContain("person");
      expect(result).toContain("name");
      expect(CodeGenState.needsString).toBe(true);
    });
  });

  describe("handleStringArrayElement (STRING_ARRAY_ELEMENT)", () => {
    it("generates strncpy for array element", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["names", { stringCapacity: 20, baseType: "string" }],
      ]);
      const ctx = createMockContext({
        identifiers: ["names"],
        subscripts: [{} as never],
      });

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_ARRAY_ELEMENT,
      )?.[1];
      const result = handler!(ctx);

      expect(result).toContain("strncpy");
      expect(result).toContain("names");
      expect(result).toContain("20");
      expect(CodeGenState.needsString).toBe(true);
    });
  });

  describe("handleStringStructArrayElement (STRING_STRUCT_ARRAY_ELEMENT)", () => {
    it("generates strncpy for struct field array element", () => {
      HandlerTestUtils.setupMockTypeRegistry([
        ["config", { baseType: "Config" }],
      ]);
      HandlerTestUtils.setupMockSymbols({
        structFieldDimensions: new Map([
          ["Config", new Map([["items", [10, 33]]])], // 10 items, capacity 32+1
        ]),
      });
      const ctx = createMockContext({
        identifiers: ["config", "items"],
        subscripts: [{} as never],
      });

      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_STRUCT_ARRAY_ELEMENT,
      )?.[1];
      const result = handler!(ctx);

      expect(result).toContain("strncpy");
      expect(result).toContain("config");
      expect(result).toContain("items");
      // Capacity should be 33 - 1 = 32
      expect(result).toContain("32");
      expect(CodeGenState.needsString).toBe(true);
    });
  });
});
