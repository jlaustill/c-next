/**
 * Comprehensive unit tests for TypeValidator
 * Tests all validation methods for 100% coverage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createMockSymbols from "../../../__tests__/codeGenSymbolsHelpers";
import * as Parser from "../../../logic/parser/grammar/CNextParser";
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

function createMockExpression(text: string): Parser.ExpressionContext {
  return {
    getText: () => text,
    ternaryExpression: () => ({
      orExpression: () => [],
    }),
  } as unknown as Parser.ExpressionContext;
}

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

  describe("validateBitmapFieldLiteral", () => {
    it("allows values within field width", () => {
      setupState();
      const expr = createMockExpression("7");
      expect(() =>
        TypeValidator.validateBitmapFieldLiteral(expr, 3, "flags"),
      ).not.toThrow();
    });

    it("throws for decimal values exceeding field width", () => {
      setupState();
      const expr = createMockExpression("8");
      expect(() =>
        TypeValidator.validateBitmapFieldLiteral(expr, 3, "flags"),
      ).toThrow("Value 8 exceeds 3-bit field 'flags' maximum of 7");
    });

    it("validates hex literals", () => {
      setupState();
      const expr = createMockExpression("0xFF");
      expect(() =>
        TypeValidator.validateBitmapFieldLiteral(expr, 8, "byte"),
      ).not.toThrow();
      const exprBad = createMockExpression("0x100");
      expect(() =>
        TypeValidator.validateBitmapFieldLiteral(exprBad, 8, "byte"),
      ).toThrow("Value 256 exceeds 8-bit field 'byte' maximum of 255");
    });

    it("validates binary literals", () => {
      setupState();
      const expr = createMockExpression("0b1111");
      expect(() =>
        TypeValidator.validateBitmapFieldLiteral(expr, 4, "nibble"),
      ).not.toThrow();
      const exprBad = createMockExpression("0b10000");
      expect(() =>
        TypeValidator.validateBitmapFieldLiteral(exprBad, 4, "nibble"),
      ).toThrow("Value 16 exceeds 4-bit field 'nibble' maximum of 15");
    });

    it("skips validation for non-literal expressions", () => {
      setupState();
      const expr = createMockExpression("someVariable");
      expect(() =>
        TypeValidator.validateBitmapFieldLiteral(expr, 1, "bit"),
      ).not.toThrow();
    });
  });

  // ========================================================================
  // Tests - Array Bounds Validation (ADR-036)
  // ========================================================================

  describe("checkArrayBounds", () => {
    const arrayType = (dims: number[]): TTypeInfo => ({
      baseType: "u8",
      bitWidth: 8,
      isArray: true,
      isConst: false,
      arrayDimensions: dims,
    });
    const withArray = (name: string, dims: number[]): void =>
      setupState({ typeRegistry: new Map([[name, arrayType(dims)]]) });

    it("allows valid constant indices", () => {
      withArray("arr", [10]);
      const indexExprs = [createMockExpression("0")];
      const tryEval = vi.fn(() => 0);
      expect(() =>
        TypeValidator.checkArrayBounds("arr", indexExprs, 1, tryEval),
      ).not.toThrow();
    });

    it("throws for negative indices", () => {
      withArray("arr", [10]);
      const indexExprs = [createMockExpression("-1")];
      const tryEval = vi.fn(() => -1);
      expect(() =>
        TypeValidator.checkArrayBounds("arr", indexExprs, 5, tryEval),
      ).toThrow("Array index out of bounds: -1 is negative for 'arr'");
    });

    it("throws for index >= dimension", () => {
      withArray("arr", [10]);
      const indexExprs = [createMockExpression("10")];
      const tryEval = vi.fn(() => 10);
      expect(() =>
        TypeValidator.checkArrayBounds("arr", indexExprs, 3, tryEval),
      ).toThrow("Array index out of bounds: 10 >= 10 for 'arr' dimension 1");
    });

    it("checks all dimensions for multi-dimensional arrays", () => {
      withArray("matrix", [3, 4]);
      const indexExprs = [createMockExpression("0"), createMockExpression("5")];
      let callIdx = 0;
      const tryEval = vi.fn(() => (callIdx++ === 0 ? 0 : 5));
      expect(() =>
        TypeValidator.checkArrayBounds("matrix", indexExprs, 1, tryEval),
      ).toThrow("Array index out of bounds: 5 >= 4 for 'matrix' dimension 2");
    });

    it("skips non-constant indices", () => {
      withArray("arr", [10]);
      const indexExprs = [createMockExpression("i")];
      const tryEval = vi.fn(() => undefined);
      expect(() =>
        TypeValidator.checkArrayBounds("arr", indexExprs, 1, tryEval),
      ).not.toThrow();
    });

    it("skips upper bound check for unsized dimensions (Issue #547)", () => {
      // UNRESOLVED_DIMENSION: size unknown, cannot validate -- not a bound of 0
      withArray("unsized", [0]);
      const indexExprs = [createMockExpression("100")];
      const tryEval = vi.fn(() => 100);
      expect(() =>
        TypeValidator.checkArrayBounds("unsized", indexExprs, 1, tryEval),
      ).not.toThrow();
    });

    it("skips a variable that has no array dimensions (#1360 unified guard)", () => {
      setupState({
        typeRegistry: new Map([
          [
            "flags",
            { baseType: "u8", bitWidth: 8, isArray: false, isConst: false },
          ],
        ]),
      });
      const indexExprs = [createMockExpression("99")];
      const tryEval = vi.fn(() => 99);
      expect(() =>
        TypeValidator.checkArrayBounds("flags", indexExprs, 1, tryEval),
      ).not.toThrow();
    });

    it("validates against the offset dimension, not dimension 0 (#1360)", () => {
      // The read path walks a postfix chain one subscript at a time, so it
      // reports its depth instead of slicing. Index 5 at offset 1 must be
      // judged against dimension 2 (size 4), not dimension 1 (size 3).
      withArray("grid", [3, 4]);
      const indexExprs = [createMockExpression("5")];
      const tryEval = vi.fn(() => 5);
      expect(() =>
        TypeValidator.checkArrayBounds("grid", indexExprs, 1, tryEval, 1),
      ).toThrow("Array index out of bounds: 5 >= 4 for 'grid' dimension 2");
    });

    it("allows an index at the offset dimension that is in range (#1360)", () => {
      // Negative control for the offset test above: 3 is out of range for
      // dimension 1 (size 3) but in range for dimension 2 (size 4), so an
      // offset that was ignored would make this throw.
      withArray("grid", [3, 4]);
      const indexExprs = [createMockExpression("3")];
      const tryEval = vi.fn(() => 3);
      expect(() =>
        TypeValidator.checkArrayBounds("grid", indexExprs, 1, tryEval, 1),
      ).not.toThrow();
    });
  });

  // ========================================================================
  // Tests - Callback Assignment Validation (ADR-029)
  // ========================================================================

  describe("callbackSignaturesMatch", () => {
    it("returns true for matching signatures", () => {
      setupState();
      const a: ICallbackTypeInfo = {
        functionName: "handler",
        returnType: "void",
        parameters: [
          {
            name: "x",
            type: "int",
            isConst: false,
            isPointer: false,
            isStruct: false,
            isArray: false,
            arrayDims: "",
          },
        ],
        typedefName: "handler_fp",
      };
      const b: ICallbackTypeInfo = {
        functionName: "other",
        returnType: "void",
        parameters: [
          {
            name: "y",
            type: "int",
            isConst: false,
            isPointer: false,
            isStruct: false,
            isArray: false,
            arrayDims: "",
          },
        ],
        typedefName: "other_fp",
      };
      expect(TypeValidator.callbackSignaturesMatch(a, b)).toBe(true);
    });

    it("returns false for different return types", () => {
      setupState();
      const a: ICallbackTypeInfo = {
        functionName: "a",
        returnType: "void",
        parameters: [],
        typedefName: "a_fp",
      };
      const b: ICallbackTypeInfo = {
        functionName: "b",
        returnType: "int",
        parameters: [],
        typedefName: "b_fp",
      };
      expect(TypeValidator.callbackSignaturesMatch(a, b)).toBe(false);
    });

    it("returns false for different parameter counts", () => {
      setupState();
      const a: ICallbackTypeInfo = {
        functionName: "a",
        returnType: "void",
        parameters: [
          {
            name: "x",
            type: "int",
            isConst: false,
            isPointer: false,
            isStruct: false,
            isArray: false,
            arrayDims: "",
          },
        ],
        typedefName: "a_fp",
      };
      const b: ICallbackTypeInfo = {
        functionName: "b",
        returnType: "void",
        parameters: [],
        typedefName: "b_fp",
      };
      expect(TypeValidator.callbackSignaturesMatch(a, b)).toBe(false);
    });

    /**
     * A single-parameter callback signature, with one field overridden.
     *
     * The three cases below differ by exactly one parameter field each. Spelled
     * out in full they were ~90 lines of near-identical object literals, where
     * the one field that mattered was easy to miss.
     */
    const callbackWithParameter = (
      name: string,
      overrides: Partial<ICallbackTypeInfo["parameters"][number]>,
    ): ICallbackTypeInfo => ({
      functionName: name,
      returnType: "void",
      parameters: [
        {
          name: "x",
          type: "int",
          isConst: false,
          isPointer: false,
          isStruct: false,
          isArray: false,
          arrayDims: "",
          ...overrides,
        },
      ],
      typedefName: `${name}_fp`,
    });

    it.each([
      ["parameter types", { type: "int" }, { type: "float" }],
      ["const-ness", { isConst: true }, { isConst: false }],
      ["pointer-ness", { isPointer: true }, { isPointer: false }],
    ])("returns false for different %s", (_label, left, right) => {
      setupState();
      expect(
        TypeValidator.callbackSignaturesMatch(
          callbackWithParameter("a", left),
          callbackWithParameter("b", right),
        ),
      ).toBe(false);
    });

    it("returns false for different array-ness", () => {
      setupState();
      const a: ICallbackTypeInfo = {
        functionName: "a",
        returnType: "void",
        parameters: [
          {
            name: "x",
            type: "int",
            isConst: false,
            isPointer: false,
            isStruct: false,
            isArray: true,
            arrayDims: "[10]",
          },
        ],
        typedefName: "a_fp",
      };
      const b: ICallbackTypeInfo = {
        functionName: "b",
        returnType: "void",
        parameters: [
          {
            name: "x",
            type: "int",
            isConst: false,
            isPointer: false,
            isStruct: false,
            isArray: false,
            arrayDims: "",
          },
        ],
        typedefName: "b_fp",
      };
      expect(TypeValidator.callbackSignaturesMatch(a, b)).toBe(false);
    });
  });

  describe("validateCallbackAssignment", () => {
    it("skips validation for non-function values", () => {
      setupState({ knownFunctions: new Set(["handler"]) });
      const expr = createMockExpression("notAFunction");
      expect(() =>
        TypeValidator.validateCallbackAssignment(
          "Handler",
          expr,
          "callback",
          () => false,
        ),
      ).not.toThrow();
    });

    it("skips validation when callback types are not found", () => {
      setupState({ knownFunctions: new Set(["handler"]) });
      const expr = createMockExpression("handler");
      expect(() =>
        TypeValidator.validateCallbackAssignment(
          "Handler",
          expr,
          "callback",
          () => false,
        ),
      ).not.toThrow();
    });

    it("throws for signature mismatch", () => {
      const callbackTypes = new Map<string, ICallbackTypeInfo>([
        [
          "Handler",
          {
            functionName: "Handler",
            returnType: "void",
            parameters: [],
            typedefName: "Handler_fp",
          },
        ],
        [
          "wrongFunc",
          {
            functionName: "wrongFunc",
            returnType: "int",
            parameters: [],
            typedefName: "wrongFunc_fp",
          },
        ],
      ]);
      setupState({
        knownFunctions: new Set(["wrongFunc"]),
        callbackTypes,
      });
      const expr = createMockExpression("wrongFunc");
      expect(() =>
        TypeValidator.validateCallbackAssignment(
          "Handler",
          expr,
          "callback",
          () => false,
        ),
      ).toThrow(
        "Function 'wrongFunc' signature does not match callback type 'Handler'",
      );
    });

    it("throws for nominal typing violation", () => {
      const callbackTypes = new Map<string, ICallbackTypeInfo>([
        [
          "TypeA",
          {
            functionName: "TypeA",
            returnType: "void",
            parameters: [],
            typedefName: "TypeA_fp",
          },
        ],
        [
          "TypeB",
          {
            functionName: "TypeB",
            returnType: "void",
            parameters: [],
            typedefName: "TypeB_fp",
          },
        ],
      ]);
      setupState({
        knownFunctions: new Set(["TypeB"]),
        callbackTypes,
      });
      const expr = createMockExpression("TypeB");
      // TypeB is used as a field type, so nominal typing applies
      expect(() =>
        TypeValidator.validateCallbackAssignment(
          "TypeA",
          expr,
          "handler",
          () => true,
        ),
      ).toThrow("nominal typing");
    });

    it("allows assignment when signatures match and no nominal typing violation", () => {
      const callbackTypes = new Map<string, ICallbackTypeInfo>([
        [
          "Handler",
          {
            functionName: "Handler",
            returnType: "void",
            parameters: [],
            typedefName: "Handler_fp",
          },
        ],
        [
          "myHandler",
          {
            functionName: "myHandler",
            returnType: "void",
            parameters: [],
            typedefName: "myHandler_fp",
          },
        ],
      ]);
      setupState({
        knownFunctions: new Set(["myHandler"]),
        callbackTypes,
      });
      const expr = createMockExpression("myHandler");
      expect(() =>
        TypeValidator.validateCallbackAssignment(
          "Handler",
          expr,
          "callback",
          () => false,
        ),
      ).not.toThrow();
    });
  });

  // ========================================================================
  // Tests - Const Assignment Validation (ADR-013)
  // ========================================================================

  describe("checkConstAssignment", () => {
    it("returns null for mutable variables", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "x",
          { baseType: "u32", bitWidth: 32, isArray: false, isConst: false },
        ],
      ]);
      setupState({ typeRegistry });
      expect(TypeValidator.checkConstAssignment("x")).toBeNull();
    });

    it("returns error for const variables", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        ["x", { baseType: "u32", bitWidth: 32, isArray: false, isConst: true }],
      ]);
      setupState({ typeRegistry });
      expect(TypeValidator.checkConstAssignment("x")).toContain(
        "cannot assign to const variable 'x'",
      );
    });

    it("returns error for const parameters", () => {
      const currentParameters = new Map<string, TParameterInfo>([
        [
          "param",
          {
            name: "param",
            baseType: "u32",
            isArray: false,
            isStruct: false,
            isConst: true,
            isCallback: false,
            isString: false,
          },
        ],
      ]);
      setupState({ currentParameters });
      expect(TypeValidator.checkConstAssignment("param")).toContain(
        "cannot assign to const parameter 'param'",
      );
    });

    it("uses resolveIdentifier for scoped names", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "Scope__x",
          { baseType: "u32", bitWidth: 32, isArray: false, isConst: true },
        ],
      ]);
      setupState({
        typeRegistry,
        currentScopePath: "Scope",
        scopeMembers: new Map([["Scope", new Set(["x"])]]),
      });
      expect(TypeValidator.checkConstAssignment("x")).toContain(
        "cannot assign to const variable",
      );
    });
  });

  describe("isConstValue", () => {
    it("returns true for const parameters", () => {
      const currentParameters = new Map<string, TParameterInfo>([
        [
          "param",
          {
            name: "param",
            baseType: "u32",
            isArray: false,
            isStruct: false,
            isConst: true,
            isCallback: false,
            isString: false,
          },
        ],
      ]);
      setupState({ currentParameters });
      expect(TypeValidator.isConstValue("param")).toBe(true);
    });

    it("returns true for const variables", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        ["x", { baseType: "u32", bitWidth: 32, isArray: false, isConst: true }],
      ]);
      setupState({ typeRegistry });
      expect(TypeValidator.isConstValue("x")).toBe(true);
    });

    it("returns false for mutable variables", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "x",
          { baseType: "u32", bitWidth: 32, isArray: false, isConst: false },
        ],
      ]);
      setupState({ typeRegistry });
      expect(TypeValidator.isConstValue("x")).toBe(false);
    });

    it("returns false for unknown identifiers", () => {
      setupState();
      expect(TypeValidator.isConstValue("unknown")).toBe(false);
    });
  });

  // ========================================================================
  // Tests - Scope Identifier Validation (ADR-016)
  // ========================================================================

  // ========================================================================
  // Tests - Critical Section Validation (ADR-050)
  // ========================================================================

  // #1322: `validateNoEarlyExits` is gone. E0853 is authored in pass 2.1,
  // where a tree walk reaches every statement the grammar can nest inside a
  // `critical` block -- including `switch`, which the recursion these tests
  // drove did not descend into, so a `return` in a switch case compiled
  // clean. Covered by `1-Analyze/__tests__/CriticalSectionAnalyzer.test.ts`
  // and `tests/adr-050/`.

  // ========================================================================
  // Tests - Switch Statement Validation (ADR-025)
  // ========================================================================

  // #1322: the `validateSwitchStatement`, `validateEnumExhaustiveness`,
  // `getDefaultCount` and `getCaseLabelValue` suites that stood here are gone
  // with the methods. ADR-025's rules are E0711-E0714 in pass 2.1, covered by
  // `1-Analyze/__tests__/SwitchStatementAnalyzer.test.ts` -- which drives real
  // source instead of hand-built `CaseLabelContext` mocks, so the case-label
  // normalization is asserted against the grammar rather than against a mock
  // that could disagree with it.

  // ========================================================================
  // Tests - Ternary Validation (ADR-022)
  // ========================================================================

  // #1322: ADR-022's nested-ternary rule is E0710 in pass 2.1, asked of the
  // parse tree. What it replaced was a substring test on the branch's source
  // text, which rejected a legal ternary whose branch was a string literal
  // containing `?` and `:`. Covered by
  // `1-Analyze/__tests__/NestedTernaryAnalyzer.test.ts`.

  // #1322: the condition suites that stood here -- `validateConditionIsBoolean`,
  // `validateConditionNoFunctionCall`, `validateTernaryCondition`,
  // `validateTernaryConditionNoFunctionCall` and the nested-unary helper they
  // shared -- are gone with the methods. ADR-022's controlling-expression rule
  // is E0701/E0702 in pass 2.1, covered by
  // `1-Analyze/__tests__/ControllingExpressionAnalyzer.test.ts`.

  // ========================================================================
  // Tests - Do-While Validation (ADR-027)
  // ========================================================================

  // ========================================================================
  // Tests - Function Call in Condition Validation (Issue #254)
  // ========================================================================

  // ========================================================================
  // Tests - Shift Amount Validation (MISRA C:2012 Rule 12.2)
  // ========================================================================

  // ========================================================================
  // Tests - resolveBareIdentifier coverage for outside-scope cases
  // ========================================================================

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
