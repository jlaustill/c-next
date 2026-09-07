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

  describe("validateIncludeNotImplementationFile", () => {
    it("allows header file includes", () => {
      setupState();
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          '#include "file.h"',
          1,
        ),
      ).not.toThrow();
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          "#include <file.hpp>",
          1,
        ),
      ).not.toThrow();
    });

    it("rejects .c file includes", () => {
      setupState();
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          '#include "impl.c"',
          5,
        ),
      ).toThrow("E0503");
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          '#include "impl.c"',
          5,
        ),
      ).toThrow("impl.c");
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          '#include "impl.c"',
          5,
        ),
      ).toThrow("Line 5");
    });

    it.each([
      ["rejects .cpp file includes", '#include "impl.cpp"'],
      ["rejects .cc file includes", "#include <impl.cc>"],
      ["rejects .cxx file includes", '#include "impl.cxx"'],
      ["rejects .c++ file includes", '#include "impl.c++"'],
    ])("%s", (_label, source) => {
      setupState();
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(source, 1),
      ).toThrow("E0503");
    });

    it("is case-insensitive for extensions", () => {
      setupState();
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          '#include "impl.C"',
          1,
        ),
      ).toThrow("E0503");
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          '#include "impl.CPP"',
          1,
        ),
      ).toThrow("E0503");
    });

    it("handles malformed includes gracefully", () => {
      setupState();
      // No path extracted - should not throw
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile("#include", 1),
      ).not.toThrow();
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile('#include ""', 1),
      ).not.toThrow();
    });

    it("handles angle bracket includes", () => {
      setupState();
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          "#include <system.h>",
          1,
        ),
      ).not.toThrow();
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          "#include <impl.c>",
          1,
        ),
      ).toThrow("E0503");
    });
  });

  describe("validateIncludeNoCnxAlternative", () => {
    it("skips .cnx includes", () => {
      setupState();
      const fileExists = vi.fn(() => true);
      expect(() =>
        TypeValidator.validateIncludeNoCnxAlternative(
          '#include "file.cnx"',
          1,
          "/src/main.cnx",
          [],
          fileExists,
        ),
      ).not.toThrow();
      expect(fileExists).not.toHaveBeenCalled();
    });

    it("skips non-header files", () => {
      setupState();
      const fileExists = vi.fn(() => true);
      expect(() =>
        TypeValidator.validateIncludeNoCnxAlternative(
          '#include "file.txt"',
          1,
          "/src/main.cnx",
          [],
          fileExists,
        ),
      ).not.toThrow();
      expect(fileExists).not.toHaveBeenCalled();
    });

    it("throws E0504 when .cnx alternative exists for quoted include", () => {
      setupState();
      const fileExists = vi.fn(() => true);
      expect(() =>
        TypeValidator.validateIncludeNoCnxAlternative(
          '#include "utils.h"',
          10,
          "/src/main.cnx",
          [],
          fileExists,
        ),
      ).toThrow("E0504");
      expect(() =>
        TypeValidator.validateIncludeNoCnxAlternative(
          '#include "utils.h"',
          10,
          "/src/main.cnx",
          [],
          fileExists,
        ),
      ).toThrow("utils.cnx");
    });

    it("does not throw when .cnx alternative does not exist", () => {
      setupState();
      const fileExists = vi.fn(() => false);
      expect(() =>
        TypeValidator.validateIncludeNoCnxAlternative(
          '#include "utils.h"',
          1,
          "/src/main.cnx",
          [],
          fileExists,
        ),
      ).not.toThrow();
    });

    it("throws E0504 when .cnx alternative exists for angle bracket include", () => {
      setupState();
      const fileExists = vi.fn(() => true);
      expect(() =>
        TypeValidator.validateIncludeNoCnxAlternative(
          "#include <lib/utils.hpp>",
          5,
          "/src/main.cnx",
          ["/include"],
          fileExists,
        ),
      ).toThrow("E0504");
    });

    it("searches through all include paths for angle includes", () => {
      setupState();
      const fileExists = vi.fn((path: string) => path.includes("/lib2/"));
      expect(() =>
        TypeValidator.validateIncludeNoCnxAlternative(
          "#include <utils.h>",
          1,
          "/src/main.cnx",
          ["/lib1", "/lib2", "/lib3"],
          fileExists,
        ),
      ).toThrow("E0504");
      expect(fileExists).toHaveBeenCalledTimes(2); // Stopped at /lib2
    });

    it("handles quoted include without sourcePath", () => {
      setupState();
      const fileExists = vi.fn(() => true);
      // No source path - cannot resolve relative include
      expect(() =>
        TypeValidator.validateIncludeNoCnxAlternative(
          '#include "utils.h"',
          1,
          null,
          [],
          fileExists,
        ),
      ).not.toThrow();
    });

    it("handles malformed includes", () => {
      setupState();
      const fileExists = vi.fn(() => true);
      expect(() =>
        TypeValidator.validateIncludeNoCnxAlternative(
          "#include",
          1,
          "/src/main.cnx",
          [],
          fileExists,
        ),
      ).not.toThrow();
    });
  });

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
