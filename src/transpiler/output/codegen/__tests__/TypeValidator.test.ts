/**
 * Comprehensive unit tests for TypeValidator
 * Tests all validation methods for 100% coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import TypeValidator from "../TypeValidator";
import TypeResolver from "../TypeResolver";
import CodeGenState from "../../../state/CodeGenState";
import type ICodeGenSymbols from "../../../types/ICodeGenSymbols";
import type TTypeInfo from "../types/TTypeInfo";
import type TParameterInfo from "../types/TParameterInfo";
import type ICallbackTypeInfo from "../types/ICallbackTypeInfo";
import * as Parser from "../../../logic/parser/grammar/CNextParser";

// ========================================================================
// Test Helpers - Mock Symbols
// ========================================================================

function createMockSymbols(
  overrides?: Partial<ICodeGenSymbols>,
): ICodeGenSymbols {
  return {
    knownScopes: new Set(),
    knownRegisters: new Set(),
    knownEnums: new Set(),
    knownStructs: new Set(),
    knownBitmaps: new Set(),
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
    registerMemberAccess: new Map(),
    registerMemberTypes: new Map(),
    registerBaseAddresses: new Map(),
    registerMemberOffsets: new Map(),
    registerMemberCTypes: new Map(),
    scopeVariableUsage: new Map(),
    scopePrivateConstValues: new Map(),
    functionReturnTypes: new Map(),
    getSingleFunctionForVariable: () => null,
    hasPublicSymbols: () => false,
    ...overrides,
  } as ICodeGenSymbols;
}

// ========================================================================
// Test Helpers - Setup State
// ========================================================================

interface SetupStateOptions {
  symbols?: ICodeGenSymbols;
  typeRegistry?: Map<string, TTypeInfo>;
  callbackTypes?: Map<string, ICallbackTypeInfo>;
  knownFunctions?: Set<string>;
  currentScope?: string | null;
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
      CodeGenState.typeRegistry.set(k, v);
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
  if (options.currentScope !== undefined) {
    CodeGenState.currentScope = options.currentScope;
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
function antlrArray<T>(arr: T[]): (i?: number) => T[] | T | undefined {
  return (i?: number) => (i !== undefined ? arr[i] : arr);
}

function createMockExpression(text: string): Parser.ExpressionContext {
  return {
    getText: () => text,
    ternaryExpression: () => ({
      orExpression: () => [],
    }),
  } as unknown as Parser.ExpressionContext;
}

function createMockOrExpression(
  text: string,
  options?: {
    hasOr?: boolean; // || operator: multiple andExpression
    hasAnd?: boolean; // && operator: multiple equalityExpression
    hasEquality?: boolean; // = or != operator: multiple relationalExpression
    hasRelational?: boolean; // <, >, <=, >= operators: multiple bitwiseOrExpression
  },
): Parser.OrExpressionContext {
  const bitwiseOrExpr = {
    bitwiseXorExpression: antlrArray([]),
    getText: () => text,
  };
  // hasRelational -> multiple bitwiseOrExpression children
  const bitwiseOrExprs = options?.hasRelational
    ? [bitwiseOrExpr, bitwiseOrExpr]
    : [bitwiseOrExpr];
  const relationalExpr = {
    bitwiseOrExpression: antlrArray(bitwiseOrExprs),
    getText: () => text,
  };
  // hasEquality -> multiple relationalExpression children
  const relationalExprs = options?.hasEquality
    ? [relationalExpr, relationalExpr]
    : [relationalExpr];
  const equalityExpr = {
    relationalExpression: antlrArray(relationalExprs),
    getText: () => text,
  };
  // hasAnd -> multiple equalityExpression children (represents && operator)
  const equalityExprs = options?.hasAnd
    ? [equalityExpr, equalityExpr]
    : [equalityExpr];
  const andExpr = {
    equalityExpression: antlrArray(equalityExprs),
    getText: () => text,
  };
  // hasOr -> multiple andExpression children (represents || operator)
  const andExprs = options?.hasOr ? [andExpr, andExpr] : [andExpr];

  return {
    getText: () => text,
    andExpression: antlrArray(andExprs),
  } as unknown as Parser.OrExpressionContext;
}

function createMockBlock(
  statements: Partial<Parser.StatementContext>[] = [],
): Parser.BlockContext {
  return {
    statement: () => statements as Parser.StatementContext[],
  } as unknown as Parser.BlockContext;
}

function createMockStatement(options?: {
  hasReturn?: boolean;
  hasBlock?: Parser.BlockContext;
  hasIf?: Partial<Parser.IfStatementContext>;
  hasWhile?: Partial<Parser.WhileStatementContext>;
  hasFor?: Partial<Parser.ForStatementContext>;
  hasDoWhile?: Partial<Parser.DoWhileStatementContext>;
}): Partial<Parser.StatementContext> {
  return {
    returnStatement: () => (options?.hasReturn ? {} : null),
    block: () => options?.hasBlock ?? null,
    ifStatement: () => (options?.hasIf ? options.hasIf : null),
    whileStatement: () => (options?.hasWhile ? options.hasWhile : null),
    forStatement: () => (options?.hasFor ? options.hasFor : null),
    doWhileStatement: () => (options?.hasDoWhile ? options.hasDoWhile : null),
  } as Partial<Parser.StatementContext>;
}

function createMockSwitchStatement(options: {
  cases?: Partial<Parser.SwitchCaseContext>[];
  defaultCase?: Partial<Parser.DefaultCaseContext> | null;
}): Parser.SwitchStatementContext {
  return {
    switchCase: () => (options.cases ?? []) as Parser.SwitchCaseContext[],
    defaultCase: () =>
      (options.defaultCase as Parser.DefaultCaseContext) ?? null,
  } as unknown as Parser.SwitchStatementContext;
}

function createMockCaseLabel(options?: {
  qualifiedType?: string[];
  identifier?: string;
  intLiteral?: string;
  hexLiteral?: string;
  binaryLiteral?: string;
  charLiteral?: string;
  hasNegative?: boolean;
}): Parser.CaseLabelContext {
  return {
    qualifiedType: () =>
      options?.qualifiedType
        ? {
            IDENTIFIER: () =>
              options.qualifiedType!.map((p) => ({ getText: () => p })),
          }
        : null,
    IDENTIFIER: () =>
      options?.identifier ? { getText: () => options.identifier } : null,
    INTEGER_LITERAL: () =>
      options?.intLiteral ? { getText: () => options.intLiteral } : null,
    HEX_LITERAL: () =>
      options?.hexLiteral ? { getText: () => options.hexLiteral } : null,
    BINARY_LITERAL: () =>
      options?.binaryLiteral ? { getText: () => options.binaryLiteral } : null,
    CHAR_LITERAL: () =>
      options?.charLiteral ? { getText: () => options.charLiteral } : null,
    children: options?.hasNegative ? [{ getText: () => "-" }] : null,
  } as unknown as Parser.CaseLabelContext;
}

function createMockDefaultCase(intLiteral?: string): Parser.DefaultCaseContext {
  return {
    INTEGER_LITERAL: () => (intLiteral ? { getText: () => intLiteral } : null),
    block: () => createMockBlock([]),
  } as unknown as Parser.DefaultCaseContext;
}

function createMockSwitchCase(
  labels: Parser.CaseLabelContext[],
): Parser.SwitchCaseContext {
  return {
    caseLabel: () => labels,
    block: () => createMockBlock([]),
  } as unknown as Parser.SwitchCaseContext;
}

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

    it("rejects .cpp file includes", () => {
      setupState();
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          '#include "impl.cpp"',
          1,
        ),
      ).toThrow("E0503");
    });

    it("rejects .cc file includes", () => {
      setupState();
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          "#include <impl.cc>",
          1,
        ),
      ).toThrow("E0503");
    });

    it("rejects .cxx file includes", () => {
      setupState();
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          '#include "impl.cxx"',
          1,
        ),
      ).toThrow("E0503");
    });

    it("rejects .c++ file includes", () => {
      setupState();
      expect(() =>
        TypeValidator.validateIncludeNotImplementationFile(
          '#include "impl.c++"',
          1,
        ),
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
    it("allows valid constant indices", () => {
      setupState();
      const indexExprs = [createMockExpression("0")];
      const tryEval = vi.fn(() => 0);
      expect(() =>
        TypeValidator.checkArrayBounds("arr", [10], indexExprs, 1, tryEval),
      ).not.toThrow();
    });

    it("throws for negative indices", () => {
      setupState();
      const indexExprs = [createMockExpression("-1")];
      const tryEval = vi.fn(() => -1);
      expect(() =>
        TypeValidator.checkArrayBounds("arr", [10], indexExprs, 5, tryEval),
      ).toThrow("Array index out of bounds: -1 is negative for 'arr'");
    });

    it("throws for index >= dimension", () => {
      setupState();
      const indexExprs = [createMockExpression("10")];
      const tryEval = vi.fn(() => 10);
      expect(() =>
        TypeValidator.checkArrayBounds("arr", [10], indexExprs, 3, tryEval),
      ).toThrow("Array index out of bounds: 10 >= 10 for 'arr' dimension 1");
    });

    it("checks all dimensions for multi-dimensional arrays", () => {
      setupState();
      const indexExprs = [createMockExpression("0"), createMockExpression("5")];
      let callIdx = 0;
      const tryEval = vi.fn(() => (callIdx++ === 0 ? 0 : 5));
      expect(() =>
        TypeValidator.checkArrayBounds(
          "matrix",
          [3, 4],
          indexExprs,
          1,
          tryEval,
        ),
      ).toThrow("Array index out of bounds: 5 >= 4 for 'matrix' dimension 2");
    });

    it("skips non-constant indices", () => {
      setupState();
      const indexExprs = [createMockExpression("i")];
      const tryEval = vi.fn(() => undefined);
      expect(() =>
        TypeValidator.checkArrayBounds("arr", [10], indexExprs, 1, tryEval),
      ).not.toThrow();
    });

    it("skips upper bound check for unsized dimensions (Issue #547)", () => {
      setupState();
      const indexExprs = [createMockExpression("100")];
      const tryEval = vi.fn(() => 100);
      // Dimension 0 means unsized array
      expect(() =>
        TypeValidator.checkArrayBounds("unsized", [0], indexExprs, 1, tryEval),
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

    it("returns false for different parameter types", () => {
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
            isArray: false,
            arrayDims: "",
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
            type: "float",
            isConst: false,
            isPointer: false,
            isArray: false,
            arrayDims: "",
          },
        ],
        typedefName: "b_fp",
      };
      expect(TypeValidator.callbackSignaturesMatch(a, b)).toBe(false);
    });

    it("returns false for different const-ness", () => {
      setupState();
      const a: ICallbackTypeInfo = {
        functionName: "a",
        returnType: "void",
        parameters: [
          {
            name: "x",
            type: "int",
            isConst: true,
            isPointer: false,
            isArray: false,
            arrayDims: "",
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
            isArray: false,
            arrayDims: "",
          },
        ],
        typedefName: "b_fp",
      };
      expect(TypeValidator.callbackSignaturesMatch(a, b)).toBe(false);
    });

    it("returns false for different pointer-ness", () => {
      setupState();
      const a: ICallbackTypeInfo = {
        functionName: "a",
        returnType: "void",
        parameters: [
          {
            name: "x",
            type: "int",
            isConst: false,
            isPointer: true,
            isArray: false,
            arrayDims: "",
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
            isArray: false,
            arrayDims: "",
          },
        ],
        typedefName: "b_fp",
      };
      expect(TypeValidator.callbackSignaturesMatch(a, b)).toBe(false);
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
          "Scope_x",
          { baseType: "u32", bitWidth: 32, isArray: false, isConst: true },
        ],
      ]);
      setupState({
        typeRegistry,
        currentScope: "Scope",
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

  describe("validateBareIdentifierInScope", () => {
    it("does nothing outside a scope", () => {
      setupState({ currentScope: null });
      expect(() =>
        TypeValidator.validateBareIdentifierInScope(
          "anything",
          false,
          () => false,
        ),
      ).not.toThrow();
    });

    it("allows local variables as bare identifiers", () => {
      setupState({ currentScope: "Motor" });
      expect(() =>
        TypeValidator.validateBareIdentifierInScope(
          "localVar",
          true,
          () => false,
        ),
      ).not.toThrow();
    });

    it("throws for bare scope member access", () => {
      const scopeMembers = new Map([["Motor", new Set(["speed"])]]);
      setupState({ currentScope: "Motor", scopeMembers });
      expect(() =>
        TypeValidator.validateBareIdentifierInScope(
          "speed",
          false,
          () => false,
        ),
      ).toThrow(
        "Use 'this.speed' to access scope member 'speed' inside scope 'Motor'",
      );
    });

    it("throws for bare register access", () => {
      const symbols = createMockSymbols({ knownRegisters: new Set(["GPIO"]) });
      setupState({ symbols, currentScope: "Motor" });
      expect(() =>
        TypeValidator.validateBareIdentifierInScope("GPIO", false, () => false),
      ).toThrow(
        "Use 'global.GPIO' to access register 'GPIO' inside scope 'Motor'",
      );
    });

    it("throws for bare global function access", () => {
      setupState({
        currentScope: "Motor",
        knownFunctions: new Set(["globalFunc"]),
      });
      expect(() =>
        TypeValidator.validateBareIdentifierInScope(
          "globalFunc",
          false,
          () => false,
        ),
      ).toThrow(
        "Use 'global.globalFunc' to access global function 'globalFunc'",
      );
    });

    it("allows scope-prefixed functions", () => {
      setupState({
        currentScope: "Motor",
        knownFunctions: new Set(["Motor_helper"]),
      });
      expect(() =>
        TypeValidator.validateBareIdentifierInScope(
          "Motor_helper",
          false,
          () => false,
        ),
      ).not.toThrow();
    });

    it("throws for bare enum access", () => {
      const symbols = createMockSymbols({ knownEnums: new Set(["State"]) });
      setupState({ symbols, currentScope: "Motor" });
      expect(() =>
        TypeValidator.validateBareIdentifierInScope(
          "State",
          false,
          () => false,
        ),
      ).toThrow("Use 'global.State' to access global enum 'State'");
    });

    it("throws for bare struct access", () => {
      setupState({ currentScope: "Motor" });
      expect(() =>
        TypeValidator.validateBareIdentifierInScope("Point", false, () => true),
      ).toThrow("Use 'global.Point' to access global struct 'Point'");
    });

    it("throws for bare global variable access", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "counter",
          { baseType: "u32", bitWidth: 32, isArray: false, isConst: false },
        ],
      ]);
      setupState({ currentScope: "Motor", typeRegistry });
      expect(() =>
        TypeValidator.validateBareIdentifierInScope(
          "counter",
          false,
          () => false,
        ),
      ).toThrow("Use 'global.counter' to access global variable 'counter'");
    });

    it("allows scoped variable names (with underscore)", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "Motor_speed",
          { baseType: "u32", bitWidth: 32, isArray: false, isConst: false },
        ],
      ]);
      setupState({ currentScope: "Motor", typeRegistry });
      expect(() =>
        TypeValidator.validateBareIdentifierInScope(
          "Motor_speed",
          false,
          () => false,
        ),
      ).not.toThrow();
    });
  });

  // ========================================================================
  // Tests - Critical Section Validation (ADR-050)
  // ========================================================================

  describe("validateNoEarlyExits", () => {
    it("allows blocks without early exits", () => {
      setupState();
      const block = createMockBlock([
        createMockStatement(),
        createMockStatement(),
      ]);
      expect(() => TypeValidator.validateNoEarlyExits(block)).not.toThrow();
    });

    it("throws for return statement in critical block", () => {
      setupState();
      const block = createMockBlock([createMockStatement({ hasReturn: true })]);
      expect(() => TypeValidator.validateNoEarlyExits(block)).toThrow("E0853");
      expect(() => TypeValidator.validateNoEarlyExits(block)).toThrow(
        "Cannot use 'return' inside critical section",
      );
    });

    it("throws for return in nested block", () => {
      setupState();
      const innerBlock = createMockBlock([
        createMockStatement({ hasReturn: true }),
      ]);
      const block = createMockBlock([
        createMockStatement({ hasBlock: innerBlock }),
      ]);
      expect(() => TypeValidator.validateNoEarlyExits(block)).toThrow("E0853");
    });

    it("throws for return in if statement", () => {
      setupState();
      const ifStmt = {
        statement: () => [
          {
            returnStatement: () => ({}),
            block: () => null,
          } as Partial<Parser.StatementContext>,
        ],
      } as Partial<Parser.IfStatementContext>;
      const block = createMockBlock([createMockStatement({ hasIf: ifStmt })]);
      expect(() => TypeValidator.validateNoEarlyExits(block)).toThrow("E0853");
    });

    it("throws for return in if statement's nested block", () => {
      setupState();
      const innerBlock = createMockBlock([
        createMockStatement({ hasReturn: true }),
      ]);
      const ifStmt = {
        statement: () => [
          {
            returnStatement: () => null,
            block: () => innerBlock,
          } as Partial<Parser.StatementContext>,
        ],
      } as Partial<Parser.IfStatementContext>;
      const block = createMockBlock([createMockStatement({ hasIf: ifStmt })]);
      expect(() => TypeValidator.validateNoEarlyExits(block)).toThrow("E0853");
    });

    it("throws for return in while loop", () => {
      setupState();
      const whileStmt = {
        statement: () =>
          ({
            returnStatement: () => ({}),
            block: () => null,
          }) as unknown as Parser.StatementContext,
      } as Partial<Parser.WhileStatementContext>;
      const block = createMockBlock([
        createMockStatement({ hasWhile: whileStmt }),
      ]);
      expect(() => TypeValidator.validateNoEarlyExits(block)).toThrow("E0853");
    });

    it("throws for return in while loop's nested block", () => {
      setupState();
      const innerBlock = createMockBlock([
        createMockStatement({ hasReturn: true }),
      ]);
      const whileStmt = {
        statement: () =>
          ({
            returnStatement: () => null,
            block: () => innerBlock,
          }) as unknown as Parser.StatementContext,
      } as Partial<Parser.WhileStatementContext>;
      const block = createMockBlock([
        createMockStatement({ hasWhile: whileStmt }),
      ]);
      expect(() => TypeValidator.validateNoEarlyExits(block)).toThrow("E0853");
    });

    it("throws for return in for loop", () => {
      setupState();
      const forStmt = {
        statement: () =>
          ({
            returnStatement: () => ({}),
            block: () => null,
          }) as unknown as Parser.StatementContext,
      } as Partial<Parser.ForStatementContext>;
      const block = createMockBlock([createMockStatement({ hasFor: forStmt })]);
      expect(() => TypeValidator.validateNoEarlyExits(block)).toThrow("E0853");
    });

    it("throws for return in for loop's nested block", () => {
      setupState();
      const innerBlock = createMockBlock([
        createMockStatement({ hasReturn: true }),
      ]);
      const forStmt = {
        statement: () =>
          ({
            returnStatement: () => null,
            block: () => innerBlock,
          }) as unknown as Parser.StatementContext,
      } as Partial<Parser.ForStatementContext>;
      const block = createMockBlock([createMockStatement({ hasFor: forStmt })]);
      expect(() => TypeValidator.validateNoEarlyExits(block)).toThrow("E0853");
    });

    it("throws for return in do-while loop", () => {
      setupState();
      const innerBlock = createMockBlock([
        createMockStatement({ hasReturn: true }),
      ]);
      const doWhileStmt = {
        block: () => innerBlock,
      } as Partial<Parser.DoWhileStatementContext>;
      const block = createMockBlock([
        createMockStatement({ hasDoWhile: doWhileStmt }),
      ]);
      expect(() => TypeValidator.validateNoEarlyExits(block)).toThrow("E0853");
    });
  });

  // ========================================================================
  // Tests - Switch Statement Validation (ADR-025)
  // ========================================================================

  describe("validateSwitchStatement", () => {
    it("throws for boolean switch expression", () => {
      setupState();
      vi.spyOn(TypeResolver, "getExpressionType").mockReturnValue("bool");
      const ctx = createMockSwitchStatement({
        cases: [{} as Parser.SwitchCaseContext],
      });
      const expr = createMockExpression("flag");
      expect(() => TypeValidator.validateSwitchStatement(ctx, expr)).toThrow(
        "Cannot switch on boolean type (MISRA 16.7)",
      );
    });

    it("throws for switch with less than 2 clauses", () => {
      setupState();
      vi.spyOn(TypeResolver, "getExpressionType").mockReturnValue(null);
      const ctx = createMockSwitchStatement({
        cases: [
          createMockSwitchCase([createMockCaseLabel({ intLiteral: "1" })]),
        ],
      });
      const expr = createMockExpression("x");
      expect(() => TypeValidator.validateSwitchStatement(ctx, expr)).toThrow(
        "Switch requires at least 2 clauses (MISRA 16.6)",
      );
    });

    it("allows switch with exactly 2 cases", () => {
      setupState();
      vi.spyOn(TypeResolver, "getExpressionType").mockReturnValue(null);
      const ctx = createMockSwitchStatement({
        cases: [
          createMockSwitchCase([createMockCaseLabel({ intLiteral: "0" })]),
          createMockSwitchCase([createMockCaseLabel({ intLiteral: "1" })]),
        ],
      });
      const expr = createMockExpression("x");
      expect(() =>
        TypeValidator.validateSwitchStatement(ctx, expr),
      ).not.toThrow();
    });

    it("allows switch with 1 case + default", () => {
      setupState();
      vi.spyOn(TypeResolver, "getExpressionType").mockReturnValue(null);
      const ctx = createMockSwitchStatement({
        cases: [
          createMockSwitchCase([createMockCaseLabel({ intLiteral: "1" })]),
        ],
        defaultCase: createMockDefaultCase(),
      });
      const expr = createMockExpression("x");
      expect(() =>
        TypeValidator.validateSwitchStatement(ctx, expr),
      ).not.toThrow();
    });

    it("throws for duplicate case values", () => {
      setupState();
      vi.spyOn(TypeResolver, "getExpressionType").mockReturnValue(null);
      const ctx = createMockSwitchStatement({
        cases: [
          createMockSwitchCase([createMockCaseLabel({ intLiteral: "1" })]),
          createMockSwitchCase([createMockCaseLabel({ intLiteral: "1" })]),
        ],
      });
      const expr = createMockExpression("x");
      expect(() => TypeValidator.validateSwitchStatement(ctx, expr)).toThrow(
        "Duplicate case value '1'",
      );
    });

    it("throws for duplicate hex and integer case values (normalized)", () => {
      setupState();
      vi.spyOn(TypeResolver, "getExpressionType").mockReturnValue(null);
      const ctx = createMockSwitchStatement({
        cases: [
          createMockSwitchCase([createMockCaseLabel({ intLiteral: "255" })]),
          createMockSwitchCase([createMockCaseLabel({ hexLiteral: "0xFF" })]),
        ],
      });
      const expr = createMockExpression("x");
      expect(() => TypeValidator.validateSwitchStatement(ctx, expr)).toThrow(
        "Duplicate case value '255'",
      );
    });
  });

  describe("validateEnumExhaustiveness", () => {
    it("throws for non-exhaustive enum switch without default", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
        enumMembers: new Map([
          [
            "State",
            new Map([
              ["IDLE", 0],
              ["RUNNING", 1],
              ["STOPPED", 2],
            ]),
          ],
        ]),
      });
      setupState({ symbols });
      vi.spyOn(TypeResolver, "getExpressionType").mockReturnValue("State");
      const ctx = createMockSwitchStatement({
        cases: [
          createMockSwitchCase([createMockCaseLabel({ identifier: "IDLE" })]),
          createMockSwitchCase([
            createMockCaseLabel({ identifier: "RUNNING" }),
          ]),
        ],
      });
      const expr = createMockExpression("state");
      expect(() => TypeValidator.validateSwitchStatement(ctx, expr)).toThrow(
        "Non-exhaustive switch on State: covers 2 of 3 variants, missing 1",
      );
    });

    it("allows exhaustive enum switch", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
        enumMembers: new Map([
          [
            "State",
            new Map([
              ["A", 0],
              ["B", 1],
            ]),
          ],
        ]),
      });
      setupState({ symbols });
      vi.spyOn(TypeResolver, "getExpressionType").mockReturnValue("State");
      const ctx = createMockSwitchStatement({
        cases: [
          createMockSwitchCase([createMockCaseLabel({ identifier: "A" })]),
          createMockSwitchCase([createMockCaseLabel({ identifier: "B" })]),
        ],
      });
      const expr = createMockExpression("state");
      expect(() =>
        TypeValidator.validateSwitchStatement(ctx, expr),
      ).not.toThrow();
    });

    it("allows non-exhaustive enum switch with plain default", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
        enumMembers: new Map([
          [
            "State",
            new Map([
              ["A", 0],
              ["B", 1],
              ["C", 2],
            ]),
          ],
        ]),
      });
      setupState({ symbols });
      vi.spyOn(TypeResolver, "getExpressionType").mockReturnValue("State");
      const ctx = createMockSwitchStatement({
        cases: [
          createMockSwitchCase([createMockCaseLabel({ identifier: "A" })]),
        ],
        defaultCase: createMockDefaultCase(),
      });
      const expr = createMockExpression("state");
      expect(() =>
        TypeValidator.validateSwitchStatement(ctx, expr),
      ).not.toThrow();
    });

    it("validates default(n) count matches remaining variants", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
        enumMembers: new Map([
          [
            "State",
            new Map([
              ["A", 0],
              ["B", 1],
              ["C", 2],
            ]),
          ],
        ]),
      });
      setupState({ symbols });
      vi.spyOn(TypeResolver, "getExpressionType").mockReturnValue("State");
      const ctx = createMockSwitchStatement({
        cases: [
          createMockSwitchCase([createMockCaseLabel({ identifier: "A" })]),
        ],
        defaultCase: createMockDefaultCase("2"), // default(2) - correct!
      });
      const expr = createMockExpression("state");
      expect(() =>
        TypeValidator.validateSwitchStatement(ctx, expr),
      ).not.toThrow();
    });

    it("throws when default(n) count is wrong", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
        enumMembers: new Map([
          [
            "State",
            new Map([
              ["A", 0],
              ["B", 1],
              ["C", 2],
            ]),
          ],
        ]),
      });
      setupState({ symbols });
      vi.spyOn(TypeResolver, "getExpressionType").mockReturnValue("State");
      const ctx = createMockSwitchStatement({
        cases: [
          createMockSwitchCase([createMockCaseLabel({ identifier: "A" })]),
        ],
        defaultCase: createMockDefaultCase("1"), // Wrong! Should be 2
      });
      const expr = createMockExpression("state");
      expect(() => TypeValidator.validateSwitchStatement(ctx, expr)).toThrow(
        "switch covers 2 of 3 State variants (1 explicit + default(1)). Expected 3",
      );
    });

    it("counts || alternatives correctly", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["State"]),
        enumMembers: new Map([
          [
            "State",
            new Map([
              ["A", 0],
              ["B", 1],
              ["C", 2],
            ]),
          ],
        ]),
      });
      setupState({ symbols });
      vi.spyOn(TypeResolver, "getExpressionType").mockReturnValue("State");
      // Case with 2 labels: A || B
      const ctx = createMockSwitchStatement({
        cases: [
          createMockSwitchCase([
            createMockCaseLabel({ identifier: "A" }),
            createMockCaseLabel({ identifier: "B" }),
          ]),
          createMockSwitchCase([createMockCaseLabel({ identifier: "C" })]),
        ],
      });
      const expr = createMockExpression("state");
      expect(() =>
        TypeValidator.validateSwitchStatement(ctx, expr),
      ).not.toThrow();
    });
  });

  describe("getDefaultCount", () => {
    it("returns number for default(n)", () => {
      setupState();
      const ctx = createMockDefaultCase("5");
      expect(TypeValidator.getDefaultCount(ctx)).toBe(5);
    });

    it("returns null for plain default", () => {
      setupState();
      const ctx = createMockDefaultCase();
      expect(TypeValidator.getDefaultCount(ctx)).toBeNull();
    });
  });

  describe("getCaseLabelValue", () => {
    it("returns qualified type as dot-joined string", () => {
      setupState();
      const ctx = createMockCaseLabel({ qualifiedType: ["State", "IDLE"] });
      expect(TypeValidator.getCaseLabelValue(ctx)).toBe("State.IDLE");
    });

    it("returns identifier", () => {
      setupState();
      const ctx = createMockCaseLabel({ identifier: "MAX_VALUE" });
      expect(TypeValidator.getCaseLabelValue(ctx)).toBe("MAX_VALUE");
    });

    it("returns integer literal", () => {
      setupState();
      const ctx = createMockCaseLabel({ intLiteral: "42" });
      expect(TypeValidator.getCaseLabelValue(ctx)).toBe("42");
    });

    it("returns negative integer literal", () => {
      setupState();
      const ctx = createMockCaseLabel({ intLiteral: "5", hasNegative: true });
      expect(TypeValidator.getCaseLabelValue(ctx)).toBe("-5");
    });

    it("normalizes hex to decimal", () => {
      setupState();
      const ctx = createMockCaseLabel({ hexLiteral: "0xFF" });
      expect(TypeValidator.getCaseLabelValue(ctx)).toBe("255");
    });

    it("handles negative hex", () => {
      setupState();
      const ctx = createMockCaseLabel({
        hexLiteral: "0x10",
        hasNegative: true,
      });
      expect(TypeValidator.getCaseLabelValue(ctx)).toBe("-16");
    });

    it("normalizes binary to decimal", () => {
      setupState();
      const ctx = createMockCaseLabel({ binaryLiteral: "0b1010" });
      expect(TypeValidator.getCaseLabelValue(ctx)).toBe("10");
    });

    it("returns char literal as-is", () => {
      setupState();
      const ctx = createMockCaseLabel({ charLiteral: "'A'" });
      expect(TypeValidator.getCaseLabelValue(ctx)).toBe("'A'");
    });

    it("returns empty string for unknown label type", () => {
      setupState();
      const ctx = createMockCaseLabel();
      expect(TypeValidator.getCaseLabelValue(ctx)).toBe("");
    });
  });

  // ========================================================================
  // Tests - Ternary Validation (ADR-022)
  // ========================================================================

  describe("validateTernaryCondition", () => {
    it("allows conditions with || operator", () => {
      setupState();
      const ctx = createMockOrExpression("a || b", { hasOr: true });
      expect(() => TypeValidator.validateTernaryCondition(ctx)).not.toThrow();
    });

    it("allows conditions with && operator", () => {
      setupState();
      const ctx = createMockOrExpression("a && b", { hasAnd: true });
      expect(() => TypeValidator.validateTernaryCondition(ctx)).not.toThrow();
    });

    it("allows conditions with = operator", () => {
      setupState();
      const ctx = createMockOrExpression("a = b", { hasEquality: true });
      expect(() => TypeValidator.validateTernaryCondition(ctx)).not.toThrow();
    });

    it("allows conditions with relational operators", () => {
      setupState();
      const ctx = createMockOrExpression("a < b", { hasRelational: true });
      expect(() => TypeValidator.validateTernaryCondition(ctx)).not.toThrow();
    });

    it("throws for bare value condition", () => {
      setupState();
      const ctx = createMockOrExpression("flag");
      expect(() => TypeValidator.validateTernaryCondition(ctx)).toThrow(
        "Ternary condition must be a boolean expression",
      );
    });

    it("throws when no andExpression", () => {
      setupState();
      const ctx = {
        getText: () => "bad",
        andExpression: antlrArray([]),
      } as unknown as Parser.OrExpressionContext;
      expect(() => TypeValidator.validateTernaryCondition(ctx)).toThrow(
        "Ternary condition must be a boolean expression",
      );
    });

    it("throws when no equalityExpression", () => {
      setupState();
      const andExpr = { equalityExpression: antlrArray([]) };
      const ctx = {
        getText: () => "bad",
        andExpression: antlrArray([andExpr]),
      } as unknown as Parser.OrExpressionContext;
      expect(() => TypeValidator.validateTernaryCondition(ctx)).toThrow(
        "Ternary condition must be a boolean expression",
      );
    });

    it("throws when no relationalExpression", () => {
      setupState();
      const equalityExpr = { relationalExpression: antlrArray([]) };
      const andExpr = { equalityExpression: antlrArray([equalityExpr]) };
      const ctx = {
        getText: () => "bad",
        andExpression: antlrArray([andExpr]),
      } as unknown as Parser.OrExpressionContext;
      expect(() => TypeValidator.validateTernaryCondition(ctx)).toThrow(
        "Ternary condition must be a boolean expression",
      );
    });
  });

  describe("validateNoNestedTernary", () => {
    it("allows non-ternary expressions", () => {
      setupState();
      const ctx = createMockOrExpression("x + 1");
      expect(() =>
        TypeValidator.validateNoNestedTernary(ctx, "true branch"),
      ).not.toThrow();
    });

    it("throws for nested ternary", () => {
      setupState();
      const ctx = createMockOrExpression("a ? b : c");
      expect(() =>
        TypeValidator.validateNoNestedTernary(ctx, "true branch"),
      ).toThrow("Nested ternary not allowed in true branch");
    });
  });

  // ========================================================================
  // Tests - Do-While Validation (ADR-027)
  // ========================================================================

  describe("validateDoWhileCondition", () => {
    function createFullDoWhileExpression(
      text: string,
      options?: {
        hasOr?: boolean;
        hasAnd?: boolean;
        hasEquality?: boolean;
        hasRelational?: boolean;
      },
    ): Parser.ExpressionContext {
      const bitwiseOrExpr = {
        bitwiseXorExpression: antlrArray([]),
        getText: () => text,
      };
      const bitwiseOrExprs = options?.hasRelational
        ? [bitwiseOrExpr, bitwiseOrExpr]
        : [bitwiseOrExpr];
      const relationalExpr = {
        bitwiseOrExpression: antlrArray(bitwiseOrExprs),
        getText: () => text,
      };
      const relationalExprs = options?.hasEquality
        ? [relationalExpr, relationalExpr]
        : [relationalExpr];
      const equalityExpr = {
        relationalExpression: antlrArray(relationalExprs),
        getText: () => text,
      };
      const equalityExprs = options?.hasAnd
        ? [equalityExpr, equalityExpr]
        : [equalityExpr];
      const andExpr = {
        equalityExpression: antlrArray(equalityExprs),
        getText: () => text,
      };
      const andExprs = options?.hasOr ? [andExpr, andExpr] : [andExpr];
      const orExpr = {
        getText: () => text,
        andExpression: antlrArray(andExprs),
      };

      return {
        getText: () => text,
        ternaryExpression: () => ({
          orExpression: antlrArray([orExpr]),
        }),
      } as unknown as Parser.ExpressionContext;
    }

    it("allows conditions with comparison operators", () => {
      setupState();
      const ctx = createFullDoWhileExpression("x < 10", {
        hasRelational: true,
      });
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).not.toThrow();
    });

    it("allows conditions with equality operators", () => {
      setupState();
      const ctx = createFullDoWhileExpression("x = 0", { hasEquality: true });
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).not.toThrow();
    });

    it("allows conditions with && operator", () => {
      setupState();
      const ctx = createFullDoWhileExpression("a && b", { hasAnd: true });
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).not.toThrow();
    });

    it("allows conditions with || operator", () => {
      setupState();
      const ctx = createFullDoWhileExpression("a || b", { hasOr: true });
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).not.toThrow();
    });

    it("throws for bare value condition", () => {
      setupState();
      const ctx = createFullDoWhileExpression("count");
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).toThrow(
        "E0701",
      );
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).toThrow(
        "do-while condition must be a boolean expression",
      );
    });

    it("throws for ternary in do-while condition", () => {
      setupState();
      const ctx = {
        getText: () => "a ? b : c",
        ternaryExpression: () => ({
          orExpression: () => [{}, {}], // Multiple orExpressions = ternary
        }),
      } as unknown as Parser.ExpressionContext;
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).toThrow(
        "E0701",
      );
    });

    it("allows boolean literals", () => {
      setupState();
      // Create full mock expression tree where getText returns "true"
      const bitwiseOrExpr = {
        bitwiseXorExpression: antlrArray([]),
        getText: () => "true",
      };
      const relationalExpr = {
        bitwiseOrExpression: antlrArray([bitwiseOrExpr]),
        getText: () => "true",
      };
      const equalityExpr = {
        relationalExpression: antlrArray([relationalExpr]),
        getText: () => "true",
      };
      const andExpr = {
        equalityExpression: antlrArray([equalityExpr]),
        getText: () => "true",
      };
      const orExpr = {
        getText: () => "true",
        andExpression: antlrArray([andExpr]),
      };
      const ctx = {
        getText: () => "true",
        ternaryExpression: () => ({
          orExpression: antlrArray([orExpr]),
        }),
      } as unknown as Parser.ExpressionContext;
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).not.toThrow();
    });

    it("allows negation expressions", () => {
      setupState();
      const bitwiseOrExpr = {
        bitwiseXorExpression: antlrArray([]),
        getText: () => "!flag",
      };
      const relationalExpr = {
        bitwiseOrExpression: antlrArray([bitwiseOrExpr]),
        getText: () => "!flag",
      };
      const equalityExpr = {
        relationalExpression: antlrArray([relationalExpr]),
        getText: () => "!flag",
      };
      const andExpr = {
        equalityExpression: antlrArray([equalityExpr]),
        getText: () => "!flag",
      };
      const orExpr = {
        getText: () => "!flag",
        andExpression: antlrArray([andExpr]),
      };
      const ctx = {
        getText: () => "!flag",
        ternaryExpression: () => ({
          orExpression: antlrArray([orExpr]),
        }),
      } as unknown as Parser.ExpressionContext;
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).not.toThrow();
    });

    it("allows bool type variables", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "isReady",
          { baseType: "bool", bitWidth: 8, isArray: false, isConst: false },
        ],
      ]);
      setupState({ typeRegistry });
      const bitwiseOrExpr = {
        bitwiseXorExpression: antlrArray([]),
        getText: () => "isReady",
      };
      const relationalExpr = {
        bitwiseOrExpression: antlrArray([bitwiseOrExpr]),
        getText: () => "isReady",
      };
      const equalityExpr = {
        relationalExpression: antlrArray([relationalExpr]),
        getText: () => "isReady",
      };
      const andExpr = {
        equalityExpression: antlrArray([equalityExpr]),
        getText: () => "isReady",
      };
      const orExpr = {
        getText: () => "isReady",
        andExpression: antlrArray([andExpr]),
      };
      const ctx = {
        getText: () => "isReady",
        ternaryExpression: () => ({
          orExpression: antlrArray([orExpr]),
        }),
      } as unknown as Parser.ExpressionContext;
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).not.toThrow();
    });

    it("shows help message in error", () => {
      setupState();
      const ctx = createFullDoWhileExpression("count");
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).toThrow(
        "help: use explicit comparison: count > 0 or count != 0",
      );
    });

    it("throws when no andExpression", () => {
      setupState();
      const orExpr = {
        getText: () => "bad",
        andExpression: antlrArray([]),
      };
      const ctx = {
        getText: () => "bad",
        ternaryExpression: () => ({
          orExpression: antlrArray([orExpr]),
        }),
      } as unknown as Parser.ExpressionContext;
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).toThrow(
        "E0701",
      );
    });

    it("throws when no equalityExpression", () => {
      setupState();
      const andExpr = {
        equalityExpression: antlrArray([]),
      };
      const orExpr = {
        getText: () => "bad",
        andExpression: antlrArray([andExpr]),
      };
      const ctx = {
        getText: () => "bad",
        ternaryExpression: () => ({
          orExpression: antlrArray([orExpr]),
        }),
      } as unknown as Parser.ExpressionContext;
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).toThrow(
        "E0701",
      );
    });

    it("throws when no relationalExpression", () => {
      setupState();
      const equalityExpr = {
        relationalExpression: antlrArray([]),
      };
      const andExpr = {
        equalityExpression: antlrArray([equalityExpr]),
      };
      const orExpr = {
        getText: () => "bad",
        andExpression: antlrArray([andExpr]),
      };
      const ctx = {
        getText: () => "bad",
        ternaryExpression: () => ({
          orExpression: antlrArray([orExpr]),
        }),
      } as unknown as Parser.ExpressionContext;
      expect(() => TypeValidator.validateDoWhileCondition(ctx)).toThrow(
        "E0701",
      );
    });
  });

  // ========================================================================
  // Tests - Function Call in Condition Validation (Issue #254)
  // ========================================================================

  describe("validateConditionNoFunctionCall", () => {
    function createExpressionWithFunctionCall(
      text: string,
      hasFunctionCall: boolean,
    ): Parser.ExpressionContext {
      const postfixOp = hasFunctionCall
        ? [{ argumentList: () => ({}), getText: () => "()" }]
        : [];
      const postfixExpr = {
        postfixOp: () => postfixOp,
        primaryExpression: () => ({}),
      };
      const unaryExpr = {
        postfixExpression: () => postfixExpr,
        unaryExpression: () => null,
      };
      const multExpr = { unaryExpression: () => [unaryExpr] };
      const addExpr = { multiplicativeExpression: () => [multExpr] };
      const shiftExpr = { additiveExpression: () => [addExpr] };
      const bandExpr = { shiftExpression: () => [shiftExpr] };
      const bxorExpr = { bitwiseAndExpression: () => [bandExpr] };
      const borExpr = { bitwiseXorExpression: () => [bxorExpr] };
      const relExpr = { bitwiseOrExpression: () => [borExpr] };
      const eqExpr = { relationalExpression: () => [relExpr] };
      const andExpr = { equalityExpression: () => [eqExpr] };
      const orExpr = { andExpression: () => [andExpr] };

      return {
        getText: () => text,
        ternaryExpression: () => ({
          orExpression: () => [orExpr],
        }),
      } as unknown as Parser.ExpressionContext;
    }

    it("allows conditions without function calls", () => {
      setupState();
      const ctx = createExpressionWithFunctionCall("x > 0", false);
      expect(() =>
        TypeValidator.validateConditionNoFunctionCall(ctx, "if"),
      ).not.toThrow();
    });

    it("throws for conditions with function calls", () => {
      setupState();
      const ctx = createExpressionWithFunctionCall("isReady()", true);
      expect(() =>
        TypeValidator.validateConditionNoFunctionCall(ctx, "if"),
      ).toThrow("E0702");
      expect(() =>
        TypeValidator.validateConditionNoFunctionCall(ctx, "if"),
      ).toThrow("Function call in 'if' condition is not allowed");
      expect(() =>
        TypeValidator.validateConditionNoFunctionCall(ctx, "if"),
      ).toThrow("MISRA C:2012 Rule 13.5");
    });

    it("returns when ternaryExpression is null", () => {
      setupState();
      const ctx = {
        getText: () => "x",
        ternaryExpression: () => null,
      } as unknown as Parser.ExpressionContext;
      expect(() =>
        TypeValidator.validateConditionNoFunctionCall(ctx, "if"),
      ).not.toThrow();
    });
  });

  describe("validateTernaryConditionNoFunctionCall", () => {
    function createOrExprWithFunctionCall(
      text: string,
      hasFunctionCall: boolean,
    ): Parser.OrExpressionContext {
      const postfixOp = hasFunctionCall
        ? [{ argumentList: () => ({}), getText: () => "()" }]
        : [];
      const postfixExpr = {
        postfixOp: () => postfixOp,
        primaryExpression: () => ({}),
      };
      const unaryExpr = {
        postfixExpression: () => postfixExpr,
        unaryExpression: () => null,
      };
      const multExpr = { unaryExpression: () => [unaryExpr] };
      const addExpr = { multiplicativeExpression: () => [multExpr] };
      const shiftExpr = { additiveExpression: () => [addExpr] };
      const bandExpr = { shiftExpression: () => [shiftExpr] };
      const bxorExpr = { bitwiseAndExpression: () => [bandExpr] };
      const borExpr = { bitwiseXorExpression: () => [bxorExpr] };
      const relExpr = { bitwiseOrExpression: () => [borExpr] };
      const eqExpr = { relationalExpression: () => [relExpr] };
      const andExpr = { equalityExpression: () => [eqExpr] };

      return {
        getText: () => text,
        andExpression: () => [andExpr],
      } as unknown as Parser.OrExpressionContext;
    }

    it("allows ternary conditions without function calls", () => {
      setupState();
      const ctx = createOrExprWithFunctionCall("x > 0", false);
      expect(() =>
        TypeValidator.validateTernaryConditionNoFunctionCall(ctx),
      ).not.toThrow();
    });

    it("throws for ternary conditions with function calls", () => {
      setupState();
      const ctx = createOrExprWithFunctionCall("check()", true);
      expect(() =>
        TypeValidator.validateTernaryConditionNoFunctionCall(ctx),
      ).toThrow("E0702");
      expect(() =>
        TypeValidator.validateTernaryConditionNoFunctionCall(ctx),
      ).toThrow("ternary");
    });
  });

  describe("hasPostfixFunctionCallInUnary - nested unary", () => {
    it("handles nested unary operators (Issue #366)", () => {
      setupState();
      // Create nested unary: !!isReady()
      const innerPostfixOp = [
        { argumentList: () => ({}), getText: () => "()" },
      ];
      const innerPostfixExpr = {
        postfixOp: () => innerPostfixOp,
        primaryExpression: () => ({}),
      };
      const innerUnaryExpr = {
        postfixExpression: () => innerPostfixExpr,
        unaryExpression: () => null,
      };
      const middleUnaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => innerUnaryExpr,
      };
      const outerUnaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => middleUnaryExpr,
      };
      const multExpr = { unaryExpression: () => [outerUnaryExpr] };
      const addExpr = { multiplicativeExpression: () => [multExpr] };
      const shiftExpr = { additiveExpression: () => [addExpr] };
      const bandExpr = { shiftExpression: () => [shiftExpr] };
      const bxorExpr = { bitwiseAndExpression: () => [bandExpr] };
      const borExpr = { bitwiseXorExpression: () => [bxorExpr] };
      const relExpr = { bitwiseOrExpression: () => [borExpr] };
      const eqExpr = { relationalExpression: () => [relExpr] };
      const andExpr = { equalityExpression: () => [eqExpr] };

      const ctx = {
        getText: () => "!!isReady()",
        andExpression: () => [andExpr],
      } as unknown as Parser.OrExpressionContext;

      expect(() =>
        TypeValidator.validateTernaryConditionNoFunctionCall(ctx),
      ).toThrow("E0702");
    });
  });

  // ========================================================================
  // Tests - Shift Amount Validation (MISRA C:2012 Rule 12.2)
  // ========================================================================

  describe("validateShiftAmount", () => {
    function createShiftExpression(
      leftType: string,
      shiftAmount: string,
      op: string,
    ): {
      leftType: string;
      rightExpr: Parser.AdditiveExpressionContext;
      op: string;
      ctx: Parser.ShiftExpressionContext;
    } {
      const literal = {
        getText: () => shiftAmount,
      };
      const primaryExpr = {
        literal: () => literal,
      };
      const postfixExpr = {
        primaryExpression: () => primaryExpr,
        postfixOp: () => [],
      };
      const unaryExpr = {
        postfixExpression: () => postfixExpr,
        unaryExpression: () => null,
        getText: () => shiftAmount,
      };
      const multExpr = {
        unaryExpression: () => [unaryExpr],
      };
      const addExpr = {
        multiplicativeExpression: () => [multExpr],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => `x ${op} ${shiftAmount}`,
      } as unknown as Parser.ShiftExpressionContext;

      return { leftType, rightExpr: addExpr, op, ctx };
    }

    it("allows valid shift amounts", () => {
      setupState();
      const { leftType, rightExpr, op, ctx } = createShiftExpression(
        "u8",
        "7",
        "<<",
      );
      expect(() =>
        TypeValidator.validateShiftAmount(leftType, rightExpr, op, ctx),
      ).not.toThrow();
    });

    it("throws for shift amount >= type width", () => {
      setupState();
      const { leftType, rightExpr, op, ctx } = createShiftExpression(
        "u8",
        "8",
        "<<",
      );
      expect(() =>
        TypeValidator.validateShiftAmount(leftType, rightExpr, op, ctx),
      ).toThrow("Shift amount (8) exceeds type width (8 bits)");
      expect(() =>
        TypeValidator.validateShiftAmount(leftType, rightExpr, op, ctx),
      ).toThrow("MISRA C:2012 Rule 12.2");
    });

    it("throws for negative shift amounts", () => {
      setupState();
      // Create expression with negative value
      const literal = { getText: () => "5" };
      const primaryExpr = { literal: () => literal };
      const postfixExpr = {
        primaryExpression: () => primaryExpr,
        postfixOp: () => [],
      };
      const unaryExpr = {
        postfixExpression: () => postfixExpr,
        unaryExpression: () => null,
        getText: () => "-5",
      };
      const multExpr = { unaryExpression: () => [unaryExpr] };
      const addExpr = {
        multiplicativeExpression: () => [multExpr],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => "x << -5",
      } as unknown as Parser.ShiftExpressionContext;

      expect(() =>
        TypeValidator.validateShiftAmount("u32", addExpr, "<<", ctx),
      ).toThrow("Negative shift amount (-5) is undefined behavior");
    });

    it("validates different type widths", () => {
      setupState();

      // u16 - max shift is 15
      const shift15 = createShiftExpression("u16", "15", ">>");
      expect(() =>
        TypeValidator.validateShiftAmount(
          shift15.leftType,
          shift15.rightExpr,
          shift15.op,
          shift15.ctx,
        ),
      ).not.toThrow();

      const shift16 = createShiftExpression("u16", "16", ">>");
      expect(() =>
        TypeValidator.validateShiftAmount(
          shift16.leftType,
          shift16.rightExpr,
          shift16.op,
          shift16.ctx,
        ),
      ).toThrow("Shift amount (16) exceeds type width (16 bits)");

      // u32 - max shift is 31
      const shift31 = createShiftExpression("u32", "31", "<<");
      expect(() =>
        TypeValidator.validateShiftAmount(
          shift31.leftType,
          shift31.rightExpr,
          shift31.op,
          shift31.ctx,
        ),
      ).not.toThrow();

      const shift32 = createShiftExpression("u32", "32", "<<");
      expect(() =>
        TypeValidator.validateShiftAmount(
          shift32.leftType,
          shift32.rightExpr,
          shift32.op,
          shift32.ctx,
        ),
      ).toThrow("Shift amount (32) exceeds type width (32 bits)");

      // u64 - max shift is 63
      const shift63 = createShiftExpression("u64", "63", "<<");
      expect(() =>
        TypeValidator.validateShiftAmount(
          shift63.leftType,
          shift63.rightExpr,
          shift63.op,
          shift63.ctx,
        ),
      ).not.toThrow();

      const shift64 = createShiftExpression("u64", "64", "<<");
      expect(() =>
        TypeValidator.validateShiftAmount(
          shift64.leftType,
          shift64.rightExpr,
          shift64.op,
          shift64.ctx,
        ),
      ).toThrow("Shift amount (64) exceeds type width (64 bits)");
    });

    it("handles signed types", () => {
      setupState();
      const { leftType, rightExpr, op, ctx } = createShiftExpression(
        "i8",
        "8",
        "<<",
      );
      expect(() =>
        TypeValidator.validateShiftAmount(leftType, rightExpr, op, ctx),
      ).toThrow("Shift amount (8) exceeds type width (8 bits)");
    });

    it("skips validation for unknown types", () => {
      setupState();
      const { leftType, rightExpr, op, ctx } = createShiftExpression(
        "CustomType",
        "100",
        "<<",
      );
      expect(() =>
        TypeValidator.validateShiftAmount(leftType, rightExpr, op, ctx),
      ).not.toThrow();
    });

    it("skips validation for non-constant shift amounts", () => {
      setupState();
      // Create expression without literal
      const primaryExpr = { literal: () => null };
      const postfixExpr = {
        primaryExpression: () => primaryExpr,
        postfixOp: () => [],
      };
      const unaryExpr = {
        postfixExpression: () => postfixExpr,
        unaryExpression: () => null,
        getText: () => "n",
      };
      const multExpr = { unaryExpression: () => [unaryExpr] };
      const addExpr = {
        multiplicativeExpression: () => [multExpr],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => "x << n",
      } as unknown as Parser.ShiftExpressionContext;

      expect(() =>
        TypeValidator.validateShiftAmount("u8", addExpr, "<<", ctx),
      ).not.toThrow();
    });

    it("handles hex shift amounts", () => {
      setupState();
      const { leftType, rightExpr, op, ctx } = createShiftExpression(
        "u8",
        "0x08",
        "<<",
      );
      expect(() =>
        TypeValidator.validateShiftAmount(leftType, rightExpr, op, ctx),
      ).toThrow("Shift amount (8) exceeds type width (8 bits)");
    });

    it("handles binary shift amounts", () => {
      setupState();
      const { leftType, rightExpr, op, ctx } = createShiftExpression(
        "u8",
        "0b1000",
        "<<",
      );
      expect(() =>
        TypeValidator.validateShiftAmount(leftType, rightExpr, op, ctx),
      ).toThrow("Shift amount (8) exceeds type width (8 bits)");
    });

    it("handles complex multiplicative expressions gracefully", () => {
      setupState();
      // Create expression with multiple multiplicative terms
      const multExpr1 = { unaryExpression: () => [] };
      const multExpr2 = { unaryExpression: () => [] };
      const addExpr = {
        multiplicativeExpression: () => [multExpr1, multExpr2],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => "x << (a * b)",
      } as unknown as Parser.ShiftExpressionContext;

      expect(() =>
        TypeValidator.validateShiftAmount("u8", addExpr, "<<", ctx),
      ).not.toThrow();
    });

    it("handles nested unary expressions", () => {
      setupState();
      // Create nested unary: -(-5) = 5
      const innerLiteral = { getText: () => "5" };
      const innerPrimaryExpr = { literal: () => innerLiteral };
      const innerPostfixExpr = {
        primaryExpression: () => innerPrimaryExpr,
        postfixOp: () => [],
      };
      const innerUnaryExpr = {
        postfixExpression: () => innerPostfixExpr,
        unaryExpression: () => null,
        getText: () => "5",
      };
      const outerUnaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => innerUnaryExpr,
        getText: () => "-5",
      };
      const topUnaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => outerUnaryExpr,
        getText: () => "--5", // Double negative = positive
      };
      const multExpr = { unaryExpression: () => [topUnaryExpr] };
      const addExpr = {
        multiplicativeExpression: () => [multExpr],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => "x << --5",
      } as unknown as Parser.ShiftExpressionContext;

      // This should evaluate to 5, which is valid for u8
      expect(() =>
        TypeValidator.validateShiftAmount("u8", addExpr, "<<", ctx),
      ).not.toThrow();
    });

    it("handles multiple unary expressions gracefully", () => {
      setupState();
      const unaryExpr1 = {
        postfixExpression: () => null,
        unaryExpression: () => null,
        getText: () => "a",
      };
      const unaryExpr2 = {
        postfixExpression: () => null,
        unaryExpression: () => null,
        getText: () => "b",
      };
      const multExpr = { unaryExpression: () => [unaryExpr1, unaryExpr2] };
      const addExpr = {
        multiplicativeExpression: () => [multExpr],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => "x << a * b",
      } as unknown as Parser.ShiftExpressionContext;

      expect(() =>
        TypeValidator.validateShiftAmount("u8", addExpr, "<<", ctx),
      ).not.toThrow();
    });

    it("handles binary literal in nested unary (coverage for evaluateUnaryExpression)", () => {
      setupState();
      // Create nested unary with binary literal: -0b100 = -4
      const innerLiteral = { getText: () => "0b100" }; // binary for 4
      const innerPrimaryExpr = { literal: () => innerLiteral };
      const innerPostfixExpr = {
        primaryExpression: () => innerPrimaryExpr,
        postfixOp: () => [],
      };
      const innerUnaryExpr = {
        postfixExpression: () => innerPostfixExpr,
        unaryExpression: () => null,
        getText: () => "0b100",
      };
      const outerUnaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => innerUnaryExpr,
        getText: () => "-0b100",
      };
      const multExpr = { unaryExpression: () => [outerUnaryExpr] };
      const addExpr = {
        multiplicativeExpression: () => [multExpr],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => "x << -0b100",
      } as unknown as Parser.ShiftExpressionContext;

      // -4 is negative, should throw
      expect(() =>
        TypeValidator.validateShiftAmount("u8", addExpr, "<<", ctx),
      ).toThrow("Negative shift amount (-4) is undefined behavior");
    });

    it("handles nested unary returning null in evaluateUnaryExpression", () => {
      setupState();
      // Create nested unary that returns null (no literal)
      const innerPrimaryExpr = { literal: () => null };
      const innerPostfixExpr = {
        primaryExpression: () => innerPrimaryExpr,
        postfixOp: () => [],
      };
      const innerUnaryExpr = {
        postfixExpression: () => innerPostfixExpr,
        unaryExpression: () => null,
        getText: () => "unknown",
      };
      const outerUnaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => innerUnaryExpr,
        getText: () => "-unknown",
      };
      const multExpr = { unaryExpression: () => [outerUnaryExpr] };
      const addExpr = {
        multiplicativeExpression: () => [multExpr],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => "x << -unknown",
      } as unknown as Parser.ShiftExpressionContext;

      // Cannot evaluate, should skip validation
      expect(() =>
        TypeValidator.validateShiftAmount("u8", addExpr, "<<", ctx),
      ).not.toThrow();
    });

    it("handles fallthrough case in evaluateUnaryExpression when nothing returns value", () => {
      setupState();
      // Create unary expression that has neither postfix nor nested unary
      const unaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => null,
        getText: () => "something",
      };
      const multExpr = { unaryExpression: () => [unaryExpr] };
      const addExpr = {
        multiplicativeExpression: () => [multExpr],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => "x << something",
      } as unknown as Parser.ShiftExpressionContext;

      // Cannot evaluate, should skip validation
      expect(() =>
        TypeValidator.validateShiftAmount("u8", addExpr, "<<", ctx),
      ).not.toThrow();
    });

    it("handles hex literal in evaluateUnaryExpression via nested unary path", () => {
      setupState();
      // Create nested unary with hex literal: -0x08 = -8
      const innerLiteral = { getText: () => "0x08" }; // hex for 8
      const innerPrimaryExpr = { literal: () => innerLiteral };
      const innerPostfixExpr = {
        primaryExpression: () => innerPrimaryExpr,
        postfixOp: () => [],
      };
      const innerUnaryExpr = {
        postfixExpression: () => innerPostfixExpr,
        unaryExpression: () => null,
        getText: () => "0x08",
      };
      const outerUnaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => innerUnaryExpr,
        getText: () => "-0x08",
      };
      const multExpr = { unaryExpression: () => [outerUnaryExpr] };
      const addExpr = {
        multiplicativeExpression: () => [multExpr],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => "x << -0x08",
      } as unknown as Parser.ShiftExpressionContext;

      // -8 is negative, should throw
      expect(() =>
        TypeValidator.validateShiftAmount("u8", addExpr, "<<", ctx),
      ).toThrow("Negative shift amount (-8) is undefined behavior");
    });

    it("handles negative value in evaluateUnaryExpression when inner has negative getText", () => {
      setupState();
      // Create unary with postfixExpr where getText starts with "-"
      const innerLiteral = { getText: () => "5" };
      const innerPrimaryExpr = { literal: () => innerLiteral };
      const innerPostfixExpr = {
        primaryExpression: () => innerPrimaryExpr,
        postfixOp: () => [],
      };
      // This unary has postfixExpr but getText returns "-5"
      const unaryExpr = {
        postfixExpression: () => innerPostfixExpr,
        unaryExpression: () => null,
        getText: () => "-5", // isNegative will be true
      };
      // Wrap in another unary to force evaluateUnaryExpression path
      const outerUnaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => unaryExpr,
        getText: () => "--5",
      };
      const multExpr = { unaryExpression: () => [outerUnaryExpr] };
      const addExpr = {
        multiplicativeExpression: () => [multExpr],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => "x << --5",
      } as unknown as Parser.ShiftExpressionContext;

      // --5 should evaluate to 5 (double negative)
      expect(() =>
        TypeValidator.validateShiftAmount("u8", addExpr, "<<", ctx),
      ).not.toThrow();
    });

    it("handles case where numMatch fails in evaluateUnaryExpression", () => {
      setupState();
      // Create unary with a literal that doesn't match any pattern
      const innerLiteral = { getText: () => "abc" }; // Not a number
      const innerPrimaryExpr = { literal: () => innerLiteral };
      const innerPostfixExpr = {
        primaryExpression: () => innerPrimaryExpr,
        postfixOp: () => [],
      };
      const innerUnaryExpr = {
        postfixExpression: () => innerPostfixExpr,
        unaryExpression: () => null,
        getText: () => "abc",
      };
      const outerUnaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => innerUnaryExpr,
        getText: () => "-abc",
      };
      const multExpr = { unaryExpression: () => [outerUnaryExpr] };
      const addExpr = {
        multiplicativeExpression: () => [multExpr],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => "x << -abc",
      } as unknown as Parser.ShiftExpressionContext;

      // Cannot evaluate, should skip validation (value stays null)
      expect(() =>
        TypeValidator.validateShiftAmount("u8", addExpr, "<<", ctx),
      ).not.toThrow();
    });

    it("hits line 1168 in evaluateUnaryExpression (double-nested null return)", () => {
      setupState();
      // Create deeply nested unary where inner has no postfix and no nested
      // This forces evaluateUnaryExpression to reach the final return null
      const innerInnerUnaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => null,
        getText: () => "x",
      };
      const innerUnaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => innerInnerUnaryExpr,
        getText: () => "-x",
      };
      const outerUnaryExpr = {
        postfixExpression: () => null,
        unaryExpression: () => innerUnaryExpr,
        getText: () => "--x",
      };
      const multExpr = { unaryExpression: () => [outerUnaryExpr] };
      const addExpr = {
        multiplicativeExpression: () => [multExpr],
      } as unknown as Parser.AdditiveExpressionContext;
      const ctx = {
        getText: () => "x << --x",
      } as unknown as Parser.ShiftExpressionContext;

      // Cannot evaluate, should skip validation
      expect(() =>
        TypeValidator.validateShiftAmount("u8", addExpr, "<<", ctx),
      ).not.toThrow();
    });
  });

  // ========================================================================
  // Tests - resolveBareIdentifier coverage for outside-scope cases
  // ========================================================================

  describe("resolveBareIdentifier - outside scope coverage", () => {
    it("returns null for enum identifier when outside scope", () => {
      const symbols = createMockSymbols({ knownEnums: new Set(["State"]) });
      setupState({ symbols, currentScope: null });
      const result = TypeValidator.resolveBareIdentifier(
        "State",
        false,
        () => false,
      );
      expect(result).toBeNull();
    });

    it("returns null for struct identifier when outside scope", () => {
      setupState({ currentScope: null });
      const result = TypeValidator.resolveBareIdentifier(
        "Point",
        false,
        () => true,
      );
      expect(result).toBeNull();
    });

    it("returns null for register identifier when outside scope", () => {
      const symbols = createMockSymbols({ knownRegisters: new Set(["GPIO"]) });
      setupState({ symbols, currentScope: null });
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

  describe("validateIntegerAssignment", () => {
    it("skips validation for compound assignments", () => {
      setupState();
      const literalSpy = vi.spyOn(TypeResolver, "validateLiteralFitsType");
      const conversionSpy = vi.spyOn(TypeResolver, "validateTypeConversion");

      TypeValidator.validateIntegerAssignment("u8", "10", null, true);

      expect(literalSpy).not.toHaveBeenCalled();
      expect(conversionSpy).not.toHaveBeenCalled();
    });

    it("skips validation for non-integer types", () => {
      setupState();
      const spy = vi.spyOn(TypeResolver, "validateLiteralFitsType");

      TypeValidator.validateIntegerAssignment("f32", "10", null, false);

      expect(spy).not.toHaveBeenCalled();
    });

    it("validates decimal literal fits in target type", () => {
      setupState();
      const spy = vi
        .spyOn(TypeResolver, "validateLiteralFitsType")
        .mockImplementation(() => {});

      TypeValidator.validateIntegerAssignment("u8", "100", null, false);

      expect(spy).toHaveBeenCalledWith("100", "u8");
    });

    it("validates negative decimal literal fits in target type", () => {
      setupState();
      const spy = vi
        .spyOn(TypeResolver, "validateLiteralFitsType")
        .mockImplementation(() => {});

      TypeValidator.validateIntegerAssignment("i8", "-50", null, false);

      expect(spy).toHaveBeenCalledWith("-50", "i8");
    });

    it("validates hex literal fits in target type", () => {
      setupState();
      const spy = vi
        .spyOn(TypeResolver, "validateLiteralFitsType")
        .mockImplementation(() => {});

      TypeValidator.validateIntegerAssignment("u8", "0xFF", null, false);

      expect(spy).toHaveBeenCalledWith("0xFF", "u8");
    });

    it("validates binary literal fits in target type", () => {
      setupState();
      const spy = vi
        .spyOn(TypeResolver, "validateLiteralFitsType")
        .mockImplementation(() => {});

      TypeValidator.validateIntegerAssignment("u8", "0b11111111", null, false);

      expect(spy).toHaveBeenCalledWith("0b11111111", "u8");
    });

    it("validates type conversion for non-literal expressions", () => {
      setupState();
      const spy = vi
        .spyOn(TypeResolver, "validateTypeConversion")
        .mockImplementation(() => {});

      TypeValidator.validateIntegerAssignment("u8", "myVariable", "u16", false);

      expect(spy).toHaveBeenCalledWith("u8", "u16");
    });

    it("trims whitespace from expression text", () => {
      setupState();
      const spy = vi
        .spyOn(TypeResolver, "validateLiteralFitsType")
        .mockImplementation(() => {});

      TypeValidator.validateIntegerAssignment("u8", "  100  ", null, false);

      expect(spy).toHaveBeenCalledWith("100", "u8");
    });
  });
});
