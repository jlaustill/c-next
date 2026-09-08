/**
 * Comprehensive unit tests for TypeValidator
 * Tests all validation methods for 100% coverage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createMockSymbols from "../../../__tests__/codeGenSymbolsHelpers";
import CodeGenState from "../../../state/CodeGenState";
import type ICodeGenSymbols from "../../../types/ICodeGenSymbols";
import type ICallbackTypeInfo from "../../../types/ICallbackTypeInfo";
import type TParameterInfo from "../../../types/TParameterInfo";
import type TTypeInfo from "../../../types/TTypeInfo";
import TypeValidator from "../TypeValidator";

// ========================================================================
// Test Helpers - Mock Symbols
// ========================================================================
// ========================================================================
// Test Helpers - Setup State
// ========================================================================

interface SetupStateOptions {
  symbols?: ICodeGenSymbols;
  typeRegistry?: Map<string, TTypeInfo>;
  callbackTypes?: Map<string, ICallbackTypeInfo>;
  knownFunctions?: Set<string>;
  currentScopePath?: string | null;
  scopeMembers?: Map<string, Set<string>>;
  currentParameters?: Map<string, TParameterInfo>;
  localVariables?: Set<string>;
}

function setupState(options: SetupStateOptions = {}): void {
  CodeGenState.reset();
  if (options.symbols) {
    CodeGenState.symbols = options.symbols;
  } else {
    CodeGenState.symbols = createMockSymbols();
  }
  if (options.typeRegistry) {
    for (const [k, v] of options.typeRegistry) {
      CodeGenState.setVariableTypeInfo(k, v);
    }
  }
  if (options.callbackTypes) {
    for (const [k, v] of options.callbackTypes) {
      CodeGenState.callbackTypes.set(k, v);
    }
  }
  if (options.knownFunctions) {
    CodeGenState.knownFunctions = options.knownFunctions;
  }
  if (options.currentScopePath !== undefined) {
    CodeGenState.setCurrentScopeByPath(options.currentScopePath);
  }
  if (options.scopeMembers) {
    for (const [scope, members] of options.scopeMembers) {
      CodeGenState.setScopeMembers(scope, members);
    }
  }
  if (options.currentParameters) {
    CodeGenState.currentParameters = options.currentParameters;
  }
  if (options.localVariables) {
    CodeGenState.localVariables = options.localVariables;
  }
}

// ========================================================================
// Test Helpers - Mock Parser Contexts
// ========================================================================

// ANTLR pattern: method() returns array, method(i) returns element at index i

// #1322: `createMockExpression` went with the bitmap-literal describe, its
// only caller.

// #1322: `createMockStatement` and `createMockBlock` built statements for the
// suites above, which moved to pass 2.1 with the rules they tested. The switch
// mock builders -- `createMockSwitchStatement`, `createMockCaseLabel`,
// `createMockDefaultCase`, `createMockSwitchCase` -- went the same way.

// ========================================================================
// Tests - Include Validation (ADR-010)
// ========================================================================

describe("TypeValidator", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================================================
  // Tests - Include Validation (ADR-010) -- relocated to pass 2.1 (#1322)
  // ========================================================================

  // The `validateIncludeNotImplementationFile` and
  // `validateIncludeNoCnxAlternative` describes stood here, 20 cases pinned to
  // two throws that reported `1:0`. They move to
  // `1-Analyze/__tests__/IncludeDirectiveAnalyzer.test.ts`, where they parse a
  // real directive instead of being handed its text and a line NUMBER -- which
  // is what made the position defect invisible to them.

  // ========================================================================
  // Tests - Bitmap Field Validation (ADR-034)
  // ========================================================================

  // #1322: the `validateBitmapFieldLiteral` describe stood here and is deleted
  // with the method. ADR-034's literal-overflow rule is E0881 in pass 2.1,
  // covered by `1-Analyze/__tests__/BitmapAccessAnalyzer.test.ts` and the
  // `tests/adr-034/` fixtures.

  // ========================================================================
  // Tests - Array Bounds Validation (ADR-036)
  // ========================================================================

  // #1322: the `callbackSignaturesMatch` and `validateCallbackAssignment`
  // describes stood here and are deleted with the methods. ADR-029's rules are
  // E0879/E0880 in pass 2.1, covered by
  // `1-Analyze/__tests__/CallbackAssignmentAnalyzer.test.ts` and the
  // `tests/adr-029/` fixtures. Deleted rather than emptied: a test that calls
  // a method and asserts nothing is the shape of a guard that cannot fail.

  describe("resolveBareIdentifier - outside scope coverage", () => {
    it("returns null for enum identifier when outside scope", () => {
      const symbols = createMockSymbols({ knownEnums: new Set(["State"]) });
      setupState({ symbols, currentScopePath: "" });
      const result = TypeValidator.resolveBareIdentifier(
        "State",
        false,
        () => false,
      );
      expect(result).toBeNull();
    });

    it("returns null for struct identifier when outside scope", () => {
      setupState({ currentScopePath: "" });
      const result = TypeValidator.resolveBareIdentifier(
        "Point",
        false,
        () => true,
      );
      expect(result).toBeNull();
    });

    it("returns null for register identifier when outside scope", () => {
      const symbols = createMockSymbols({ knownRegisters: new Set(["GPIO"]) });
      setupState({ symbols, currentScopePath: "" });
      const result = TypeValidator.resolveBareIdentifier(
        "GPIO",
        false,
        () => false,
      );
      expect(result).toBeNull();
    });
  });

  // ========================================================================
  // Integer Assignment Validation (ADR-024)
  // ========================================================================

  // #1322: the `validateIntegerAssignment` suite that stood here is gone with the method. ADR-024's
  // rules are E0868/E0869 in pass 2.1, covered by
  // `1-Analyze/__tests__/IntegerConversionAnalyzer.test.ts` against real source
  // rather than a text API.
});
