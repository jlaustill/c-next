import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AssignmentValidator from "../AssignmentValidator.js";
import TypeValidator from "../../TypeValidator.js";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser.js";
import CodeGenState from "../../../../state/CodeGenState.js";

/**
 * Create a mock assignment target context by parsing a minimal assignment statement.
 */
function parseAssignment(target: string) {
  const source = `void test() { ${target} <- 0; }`;
  const { tree } = CNextSourceParser.parse(source);
  const decl = tree.declaration(0);
  const func = decl!.functionDeclaration();
  const block = func!.block();
  const stmt = block!.statement(0)!;
  const assignStmt = stmt.assignmentStatement()!;
  return {
    target: assignStmt.assignmentTarget(),
    expression: assignStmt.expression(),
  };
}

/**
 * Default callbacks for testing.
 */
const defaultCallbacks = {
  getExpressionType: () => null,
  tryEvaluateConstant: () => undefined,
  isCallbackTypeUsedAsFieldType: () => false,
};

/**
 * Helper to set up CodeGenState.symbols with minimal fields.
 */
function setupSymbols(
  overrides: {
    registerMemberAccess?: Map<string, string>;
  } = {},
): void {
  CodeGenState.symbols = {
    knownScopes: new Set(),
    knownStructs: new Set(),
    knownRegisters: new Set(),
    knownEnums: new Set(),
    knownBitmaps: new Set(),
    knownVariables: new Set(),
    scopeMembers: new Map(),
    scopeMemberVisibility: new Map(),
    structFields: new Map(),
    structFieldArrays: new Map(),
    structFieldDimensions: new Map(),
    enumMembers: new Map(),
    bitmapFields: new Map(),
    bitmapBackingType: new Map(),
    bitmapBitWidth: new Map(),
    scopedRegisters: new Map(),
    registerMemberAccess: overrides.registerMemberAccess ?? new Map(),
    registerMemberTypes: new Map(),
    registerBaseAddresses: new Map(),
    registerMemberOffsets: new Map(),
    registerMemberCTypes: new Map(),
    scopeVariableUsage: new Map(),
    scopePrivateConstValues: new Map(),
    functionReturnTypes: new Map(),
    getSingleFunctionForVariable: () => null,
    opaqueTypes: new Set(),
  };
}

describe("AssignmentValidator", () => {
  beforeEach(() => {
    vi.spyOn(TypeValidator, "validateCallbackAssignment").mockImplementation(
      () => {},
    );
    CodeGenState.reset();
    setupSymbols();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // #1322: four cases here asserted the delegation to
  // `TypeValidator.validateIntegerAssignment` and its propagated throw, and a
  // spy in `beforeEach` stubbed it. Gone with the method; ADR-024's rules are
  // E0868/E0869 in pass 2.1. Deleted rather than emptied.
  describe("validate() - simple identifier", () => {
    it("should invalidate float shadow on assignment", () => {
      CodeGenState.floatShadowCurrent.add("__bits_myFloat");
      const { target, expression } = parseAssignment("myFloat");

      AssignmentValidator.validate(
        target,
        expression,
        false,
        1,
        defaultCallbacks,
      );

      expect(CodeGenState.floatShadowCurrent.has("__bits_myFloat")).toBe(false);
    });

    // #1322: the enum-assignment test that stood here asserted a delegation to
    // `EnumAssignmentValidator`, which is deleted. ADR-017's assignment rule is
    // E0428 in pass 2.1 and is covered by
    // `1-Analyze/__tests__/EnumTypeSafetyAnalyzer.test.ts`. Keeping the test
    // with the assertion removed would have left a case that runs `validate`
    // and checks nothing.
  });

  describe("validate() - member access", () => {
    it("should validate callback assignment for callback field", () => {
      CodeGenState.setVariableTypeInfo("handler", {
        baseType: "Handler",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });
      CodeGenState.callbackFieldTypes.set("Handler.onEvent", "EventCallback");
      // Mark Handler as a known struct
      if (CodeGenState.symbols) {
        (CodeGenState.symbols.knownStructs as Set<string>).add("Handler");
      }

      const { target, expression } = parseAssignment("handler.onEvent");

      AssignmentValidator.validate(
        target,
        expression,
        false,
        1,
        defaultCallbacks,
      );

      expect(TypeValidator.validateCallbackAssignment).toHaveBeenCalledWith(
        "EventCallback",
        expression,
        "onEvent",
        expect.any(Function),
      );
    });
  });
});
