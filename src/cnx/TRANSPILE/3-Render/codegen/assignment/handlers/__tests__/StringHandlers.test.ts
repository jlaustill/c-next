/**
 * Unit tests for StringHandlers.
 * Tests the string assignment handler functions.
 */

import { beforeEach, describe, expect, it } from "vitest";
import stringHandlers from "../StringHandlers";
import AssignmentKind from "../../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../../2-Plan/types/IAssignmentContext";
import TranspileState from "../../../../../TranspileState";
import HandlerTestUtils from "./handlerTestUtils";

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

  const ctx = {
    identifiers,
    ...HandlerTestUtils.subscriptsOf([]),
    isCompound: false,
    cnextOp: "<-",
    cOp: "=",
    generatedValue: '"hello"',
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
    floatBits: null,
    valueExpressionType: () => null,
    valueIntegerType: () => null,
    valueHasFloatingOperand: () => false,
    bitmapField: null,
    atomic: null,
    foldValue: () =>
      HandlerTestUtils.planner().tryEvaluateConstant(null as never),
    postfixOps: [],
    resolvedTarget,
    resolvedBaseIdentifier,
    // #1452 box 4: a handler reaches 2.3's per-file state through the context
    // it is handed, so the mock context carries the same instance the test
    // set its facts up on.
    state,
    // #1731 review: 2.2's decision is the case's input
    plannedStringCapacity: null,
    plannedStringParts: null,
    plannedWholeArray: null,
    ...overrides,
  } as IAssignmentContext;
  // #1668 (C7): what the target writes, as the binder would bind it
  return {
    ...ctx,
    target: overrides.target ?? HandlerTestUtils.targetOf(state, ctx),
  };
}

// #1450: five `expect(state.needsString).toBe(true)` assertions stood
// here, one per handler. The handlers no longer raise it -- `needsString` is
// over-determined, raised by the effect channel, by `generateType` and by type
// registration, so six more raisers in the handlers changed nothing. What these
// tests are FOR is the emitted copy, and that is untouched.
let state = new TranspileState();

function copyHandler() {
  return stringHandlers.find(
    ([kind]) => kind === AssignmentKind.STRING_COPY,
  )?.[1];
}

describe("StringHandlers", () => {
  beforeEach(() => {
    state = new TranspileState();
    HandlerTestUtils.setupMockGenerator(state);
    HandlerTestUtils.setupMockSymbols(state);
  });

  it("registers the one string kind", () => {
    expect(stringHandlers.map(([kind]) => kind)).toEqual([
      AssignmentKind.STRING_COPY,
    ]);
  });

  describe("STRING_COPY", () => {
    it("copies into a variable, sized by its declared capacity", () => {
      HandlerTestUtils.declareTypes(state, [
        ["testVar", { stringCapacity: 32, baseType: "string", isString: true }],
      ]);

      expect(
        copyHandler()!(
          createMockContext({
            isSimpleIdentifier: true,
            plannedStringCapacity: 32,
          }),
        ),
      ).toBe('cnx_string_copy(target, "hello", 32U);');
    });

    // #1731: the target is the renderer's, not re-spelled from the chain's
    // names -- `person.name` on a pointer parameter is `person->name`, and
    // `parr[1].name` is not `parr.name[1]`
    it("copies into a field through the rendered target", () => {
      HandlerTestUtils.declareTypes(state, [
        ["person", { baseType: "Person" }],
      ]);
      const ctx = createMockContext({
        identifiers: ["person", "name"],
        plannedStringCapacity: 50,
      });

      const result = copyHandler()!(ctx);

      expect(result).toBe('cnx_string_copy(target, "hello", 50U);');
      expect(result).not.toContain("person");
    });

    it("copies into an element, terminated like any string", () => {
      HandlerTestUtils.declareTypes(state, [
        ["config", { baseType: "Config" }],
      ]);
      const ctx = createMockContext({
        identifiers: ["config", "items"],
        ...HandlerTestUtils.subscriptsOf([{} as never]),
        plannedStringCapacity: 32,
      });

      expect(copyHandler()!(ctx)).toBe(
        'cnx_string_copy(target, "hello", 32U);',
      );
    });

    // #2207: one call, safe when the source is the target, and it reaches a
    // side-effecting target once (#1731 review)
    it("copies from a string through cnx_string_copy", () => {
      const ctx = createMockContext({
        isSimpleIdentifier: true,
        targetIndexHasSideEffect: true,
        generatedValue: "names[j]",
        plannedStringCapacity: 8,
      });

      expect(copyHandler()!(ctx)).toBe(
        "cnx_string_copy(target, names[j], 8U);",
      );
    });

    // #1322: compound assignment on a string is E0857 in pass 2.1, so the
    // pipeline halts before this handler runs. Covered by
    // `1-Analyze/__tests__/CompoundAssignmentAnalyzer.test.ts` plus
    // `tests/compound-assign/` and `tests/string-assignment/`.
  });
});
