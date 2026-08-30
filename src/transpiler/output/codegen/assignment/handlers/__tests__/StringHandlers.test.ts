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
import AssignmentClassifier from "../../AssignmentClassifier";

/**
 * Create mock context for testing
 */
function createMockContext(
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  // Default resolved values based on first identifier
  const identifiers = overrides.identifiers ?? ["testVar"];
  const resolvedTarget = overrides.resolvedTarget ?? identifiers[0];
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? identifiers[0];

  return {
    identifiers,
    subscripts: [],
    isCompound: false,
    cnextOp: "<-",
    cOp: "=",
    generatedValue: '"hello"',
    targetCtx: {} as never,
    resolvedTarget,
    resolvedBaseIdentifier,
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
      CodeGenState.setCurrentScopeByPath("TestScope");
      HandlerTestUtils.setupMockTypeRegistry([
        ["TestScope__memberName", { stringCapacity: 64, baseType: "string" }],
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

    it("classifier and handler key the same map at depth two", () => {
      // #1357 review: the depth-2 guard in SpecialHandlers.test.ts covers 1 of
      // the 11 converted sites. Restoring the leaf join at another one --
      // AssignmentClassifier.ts:591 -- leaves all 6713 unit tests green, because
      // the encoder-level test calls ScopeUtils directly and never imports the
      // mutated file. So a site-level re-inline is invisible until a test drives
      // the SITE.
      //
      // This one guards the PAIR rather than one site, which is what the comment
      // deleted from StringHandlers.ts:105 used to record: the classifier decides
      // to route here by hitting the type registry, and the handler then hits it
      // again and dereferences with `!`. Key them differently and the classifier
      // routes a member the handler cannot find, so the `!` throws at generation
      // time. They agree at depth one whichever encoder each uses, so only depth
      // two can tell a shared decision from a coincidence.
      CodeGenState.setCurrentScopeByPath("Outer.Inner");
      HandlerTestUtils.setupMockTypeRegistry([
        [
          "Outer__Inner__memberName",
          { stringCapacity: 48, baseType: "string", isString: true },
        ],
      ]);
      // The shared factory leaves these undefined -- every other test here calls
      // a handler directly, which is reached only AFTER classification, so none
      // of them needed the flags that classification reads.
      const ctx = createMockContext({
        identifiers: ["memberName"],
        hasThis: true,
        isSimpleThisAccess: true,
      });

      // Half one: the classifier must recognize it through the whole chain.
      expect(AssignmentClassifier.classify(ctx)).toBe(
        AssignmentKind.STRING_THIS_MEMBER,
      );

      // Half two: the handler must find the same entry, not throw on `!`.
      const handler = stringHandlers.find(
        ([kind]) => kind === AssignmentKind.STRING_THIS_MEMBER,
      )?.[1];

      expect(handler!(ctx)).toContain("48");
    });

    it("throws when used outside scope", () => {
      CodeGenState.setCurrentScopeByPath(null);
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
