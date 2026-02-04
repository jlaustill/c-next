/**
 * Unit tests for PostfixExpressionGenerator
 *
 * Tests postfix expression generation including:
 * - Member access (obj.field)
 * - Array subscripts (arr[i])
 * - Bit access (value[3] or value[0, 8])
 * - Function calls (func())
 * - Property access (.length, .capacity, .size)
 */

import { describe, it, expect, vi } from "vitest";
import generatePostfixExpression from "../PostfixExpressionGenerator";
import type IGeneratorInput from "../../IGeneratorInput";
import type IGeneratorState from "../../IGeneratorState";
import type IOrchestrator from "../../IOrchestrator";
import type ICodeGenSymbols from "../../../../../types/ICodeGenSymbols";
import type TTypeInfo from "../../../types/TTypeInfo";
import type TParameterInfo from "../../../types/TParameterInfo";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";

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
// Test Helpers - Mock Input
// ========================================================================

function createMockInput(overrides?: {
  symbols?: ICodeGenSymbols;
  typeRegistry?: Map<string, TTypeInfo>;
}): IGeneratorInput {
  return {
    symbolTable: null,
    symbols: overrides?.symbols ?? createMockSymbols(),
    typeRegistry: overrides?.typeRegistry ?? new Map(),
    functionSignatures: new Map(),
    knownFunctions: new Set(),
    knownStructs: new Set(),
    constValues: new Map(),
    callbackTypes: new Map(),
    callbackFieldTypes: new Map(),
    targetCapabilities: {
      wordSize: 32,
      hasLdrexStrex: false,
      hasBasepri: false,
    },
    debugMode: false,
  } as IGeneratorInput;
}

// ========================================================================
// Test Helpers - Mock State
// ========================================================================

function createMockState(overrides?: {
  currentScope?: string | null;
  currentParameters?: Map<string, TParameterInfo>;
  localVariables?: Set<string>;
  scopeMembers?: Map<string, Set<string>>;
  mainArgsName?: string | null;
  lengthCache?: Map<string, string> | null;
  inFunctionBody?: boolean;
}): IGeneratorState {
  return {
    currentScope: overrides?.currentScope ?? null,
    indentLevel: 0,
    inFunctionBody: overrides?.inFunctionBody ?? true,
    currentParameters: overrides?.currentParameters ?? new Map(),
    localVariables: overrides?.localVariables ?? new Set(),
    localArrays: new Set(),
    expectedType: null,
    selfIncludeAdded: false,
    scopeMembers: overrides?.scopeMembers ?? new Map(),
    mainArgsName: overrides?.mainArgsName ?? null,
    floatBitShadows: new Set(),
    floatShadowCurrent: new Set(),
    lengthCache: overrides?.lengthCache ?? null,
  };
}

// ========================================================================
// Test Helpers - Mock Orchestrator
// ========================================================================

function createMockOrchestrator(overrides?: {
  generatePrimaryExpr?: (ctx: Parser.PrimaryExpressionContext) => string;
  generateExpression?: (ctx: Parser.ExpressionContext) => string;
  generateFunctionArg?: (
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ) => string;
  isKnownStruct?: (name: string) => boolean;
  isKnownScope?: (name: string) => boolean;
  isCppScopeSymbol?: (name: string) => boolean;
  isCppMode?: () => boolean;
  getScopeSeparator?: (isCpp: boolean) => string;
  getStructFieldInfo?: (
    structType: string,
    fieldName: string,
  ) => { type: string; dimensions?: (number | string)[] } | null;
  getMemberTypeInfo?: (
    structType: string,
    memberName: string,
  ) => { baseType: string; isArray: boolean } | null;
  validateCrossScopeVisibility?: (scope: string, member: string) => void;
  generateBitMask?: (width: string, is64?: boolean) => string;
  hasFloatBitShadow?: (name: string) => boolean;
  registerFloatBitShadow?: (name: string) => void;
  addPendingTempDeclaration?: (decl: string) => void;
  isFloatShadowCurrent?: (name: string) => boolean;
  markFloatShadowCurrent?: (name: string) => void;
}): IOrchestrator {
  return {
    getInput: vi.fn(),
    getState: vi.fn(),
    applyEffects: vi.fn(),
    getIndent: vi.fn(() => ""),
    resolveIdentifier: vi.fn((name) => name),
    generateExpression:
      overrides?.generateExpression ?? vi.fn((ctx) => ctx.getText()),
    generateExpressionWithExpectedType: vi.fn(),
    generateType: vi.fn(),
    generateUnaryExpr: vi.fn(),
    generatePostfixExpr: vi.fn(),
    generateOrExpr: vi.fn(),
    isKnownStruct: overrides?.isKnownStruct ?? vi.fn(() => false),
    isFloatType: vi.fn(),
    isIntegerType: vi.fn(),
    isCNextFunction: vi.fn(),
    isStructType: vi.fn(),
    getTypeName: vi.fn(),
    tryEvaluateConstant: vi.fn(),
    getZeroInitializer: vi.fn(),
    getExpressionEnumType: vi.fn(),
    isIntegerExpression: vi.fn(),
    isStringExpression: vi.fn(),
    getAdditiveExpressionType: vi.fn(),
    getOperatorsFromChildren: vi.fn(),
    validateCrossScopeVisibility:
      overrides?.validateCrossScopeVisibility ?? vi.fn(),
    validateShiftAmount: vi.fn(),
    validateTernaryCondition: vi.fn(),
    validateNoNestedTernary: vi.fn(),
    validateLiteralFitsType: vi.fn(),
    validateTypeConversion: vi.fn(),
    getSimpleIdentifier: vi.fn(),
    generateFunctionArg: overrides?.generateFunctionArg ?? vi.fn(),
    isConstValue: vi.fn(),
    getKnownEnums: vi.fn(() => new Set()),
    isCppMode: overrides?.isCppMode ?? vi.fn(() => false),
    isCppEnumClass: vi.fn(),
    getExpressionType: vi.fn(),
    isParameterPassByValue: vi.fn(),
    generateBlock: vi.fn(),
    generateStatement: vi.fn(),
    flushPendingTempDeclarations: vi.fn(() => ""),
    indent: vi.fn((text) => text),
    validateNoEarlyExits: vi.fn(),
    validateSwitchStatement: vi.fn(),
    validateDoWhileCondition: vi.fn(),
    validateConditionNoFunctionCall: vi.fn(),
    validateTernaryConditionNoFunctionCall: vi.fn(),
    generateAssignmentTarget: vi.fn(),
    generateArrayDimensions: vi.fn(),
    generateArrayDimension: vi.fn(),
    countStringLengthAccesses: vi.fn(),
    countBlockLengthAccesses: vi.fn(),
    setupLengthCache: vi.fn(),
    clearLengthCache: vi.fn(),
    registerLocalVariable: vi.fn(),
    generateParameterList: vi.fn(),
    getStringLiteralLength: vi.fn(),
    getStringConcatOperands: vi.fn(),
    getSubstringOperands: vi.fn(),
    getStringExprCapacity: vi.fn(),
    setParameters: vi.fn(),
    clearParameters: vi.fn(),
    isCallbackTypeUsedAsFieldType: vi.fn(),
    setCurrentScope: vi.fn(),
    setCurrentFunctionName: vi.fn(),
    getCurrentFunctionReturnType: vi.fn(),
    setCurrentFunctionReturnType: vi.fn(),
    enterFunctionBody: vi.fn(),
    exitFunctionBody: vi.fn(),
    setMainArgsName: vi.fn(),
    isMainFunctionWithArgs: vi.fn(),
    generateCallbackTypedef: vi.fn(),
    updateFunctionParamsAutoConst: vi.fn(),
    markParameterModified: vi.fn(),
    isCalleeParameterModified: vi.fn(),
    isCurrentParameter: vi.fn(),
    generatePrimaryExpr:
      overrides?.generatePrimaryExpr ?? vi.fn((ctx) => ctx.getText()),
    isKnownScope: overrides?.isKnownScope ?? vi.fn(() => false),
    isCppScopeSymbol: overrides?.isCppScopeSymbol ?? vi.fn(() => false),
    getScopeSeparator: overrides?.getScopeSeparator ?? vi.fn(() => "_"),
    getStructFieldInfo: overrides?.getStructFieldInfo ?? vi.fn(() => null),
    getMemberTypeInfo: overrides?.getMemberTypeInfo ?? vi.fn(() => null),
    generateBitMask:
      overrides?.generateBitMask ?? vi.fn((w) => `((1 << ${w}) - 1)`),
    addPendingTempDeclaration: overrides?.addPendingTempDeclaration ?? vi.fn(),
    registerFloatBitShadow: overrides?.registerFloatBitShadow ?? vi.fn(),
    markFloatShadowCurrent: overrides?.markFloatShadowCurrent ?? vi.fn(),
    hasFloatBitShadow: overrides?.hasFloatBitShadow ?? vi.fn(() => false),
    isFloatShadowCurrent: overrides?.isFloatShadowCurrent ?? vi.fn(() => false),
  } as unknown as IOrchestrator;
}

// ========================================================================
// Test Helpers - Mock Parser Contexts
// ========================================================================

function createMockPrimaryExpression(
  identifier?: string,
): Parser.PrimaryExpressionContext {
  return {
    IDENTIFIER: () => (identifier ? { getText: () => identifier } : null),
    getText: () => identifier ?? "expr",
  } as unknown as Parser.PrimaryExpressionContext;
}

function createMockPostfixOp(options?: {
  identifier?: string;
  expressions?: Parser.ExpressionContext[];
  argumentList?: Parser.ArgumentListContext | null;
}): Parser.PostfixOpContext {
  return {
    IDENTIFIER: () =>
      options?.identifier ? { getText: () => options.identifier } : null,
    expression: () => options?.expressions ?? [],
    argumentList: () => options?.argumentList ?? null,
    start: { line: 1 },
  } as unknown as Parser.PostfixOpContext;
}

function createMockExpression(text: string): Parser.ExpressionContext {
  return {
    getText: () => text,
  } as unknown as Parser.ExpressionContext;
}

function createMockPostfixExpressionContext(
  primaryId: string | undefined,
  ops: Parser.PostfixOpContext[],
): Parser.PostfixExpressionContext {
  return {
    primaryExpression: () => createMockPrimaryExpression(primaryId),
    postfixOp: () => ops,
    getText: () => primaryId ?? "expr",
  } as unknown as Parser.PostfixExpressionContext;
}

// ========================================================================
// Tests
// ========================================================================

describe("PostfixExpressionGenerator", () => {
  describe("basic expression generation", () => {
    it("generates simple identifier", () => {
      const ctx = createMockPostfixExpressionContext("x", []);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "x",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("x");
      expect(result.effects).toHaveLength(0);
    });

    it("wraps struct parameter as whole value (ADR-006)", () => {
      const params = new Map<string, TParameterInfo>([
        [
          "point",
          {
            name: "point",
            baseType: "Point",
            isArray: false,
            isStruct: true,
            isConst: false,
            isCallback: false,
            isString: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("point", []);
      const input = createMockInput();
      const state = createMockState({ currentParameters: params });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "point",
        isCppMode: () => false,
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("(*point)");
    });

    it("wraps struct parameter as reference in C++ mode", () => {
      const params = new Map<string, TParameterInfo>([
        [
          "point",
          {
            name: "point",
            baseType: "Point",
            isArray: false,
            isStruct: true,
            isConst: false,
            isCallback: false,
            isString: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("point", []);
      const input = createMockInput();
      const state = createMockState({ currentParameters: params });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "point",
        isCppMode: () => true,
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("point");
    });
  });

  describe("global prefix handling (ADR-016)", () => {
    it("strips __GLOBAL_PREFIX__ and uses member name", () => {
      const ctx = createMockPostfixExpressionContext("global", [
        createMockPostfixOp({ identifier: "counter" }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__GLOBAL_PREFIX__",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("counter");
    });

    it("throws when global.x shadows local variable (ADR-057)", () => {
      const ctx = createMockPostfixExpressionContext("global", [
        createMockPostfixOp({ identifier: "counter" }),
      ]);
      const input = createMockInput();
      const state = createMockState({ localVariables: new Set(["counter"]) });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__GLOBAL_PREFIX__",
      });

      expect(() =>
        generatePostfixExpression(ctx, input, state, orchestrator),
      ).toThrow(
        "Cannot use 'global.counter' when local variable 'counter' shadows it",
      );
    });

    it("sets struct type for global struct variable", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "config",
          {
            baseType: "Config",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("global", [
        createMockPostfixOp({ identifier: "config" }),
        createMockPostfixOp({ identifier: "value" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__GLOBAL_PREFIX__",
        isKnownStruct: (name) => name === "Config",
        getMemberTypeInfo: () => ({ baseType: "u32", isArray: false }),
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("config.value");
    });
  });

  describe("this.member handling (ADR-016)", () => {
    it("resolves this.length when length is a scope member", () => {
      const scopeMembers = new Map([["Motor", new Set(["length", "speed"])]]);
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput();
      const state = createMockState({
        currentScope: "Motor",
        scopeMembers,
      });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("Motor_length");
    });

    it("throws when using this outside a scope", () => {
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "speed" }),
      ]);
      const input = createMockInput();
      const state = createMockState({ currentScope: null });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
      });

      expect(() =>
        generatePostfixExpression(ctx, input, state, orchestrator),
      ).toThrow("'this' can only be used inside a scope");
    });

    it("resolves this.member to scope-prefixed name", () => {
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "speed" }),
      ]);
      const symbols = createMockSymbols();
      const input = createMockInput({ symbols });
      const state = createMockState({ currentScope: "Motor" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("Motor_speed");
    });

    it("resolves this.member to const value when available", () => {
      const symbols = createMockSymbols({
        scopePrivateConstValues: new Map([["Motor_MAX_SPEED", "100"]]),
      });
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "MAX_SPEED" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState({ currentScope: "Motor" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("100");
    });

    it("resolves this.member to struct type when member is a struct", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "Motor_config",
          {
            baseType: "MotorConfig",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const symbols = createMockSymbols();
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "config" }),
        createMockPostfixOp({ identifier: "speed" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState({ currentScope: "Motor" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
        isKnownStruct: (name) => name === "MotorConfig",
        getMemberTypeInfo: () => ({ baseType: "u32", isArray: false }),
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("Motor_config.speed");
    });

    it("resolves this.member without struct type when not a known struct", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "Motor_value",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const symbols = createMockSymbols();
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "value" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState({ currentScope: "Motor" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
        isKnownStruct: () => false,
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("Motor_value");
    });

    it("resolves this.member when member is a known enum", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["Motor_State"]),
      });
      const ctx = createMockPostfixExpressionContext("this", [
        createMockPostfixOp({ identifier: "State" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState({ currentScope: "Motor" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "__THIS_SCOPE__",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("Motor_State");
    });
  });

  describe(".length property", () => {
    it("returns argc for main args.length", () => {
      const ctx = createMockPostfixExpressionContext("args", [
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput();
      const state = createMockState({ mainArgsName: "args" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "argv",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("argc");
    });

    it("returns comment for unknown type", () => {
      const ctx = createMockPostfixExpressionContext("unknown", [
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "unknown",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toContain("unknown type");
      expect(result.code).toContain("0");
    });

    it("returns array dimension for array type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "arr",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: [10],
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("arr", [
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "arr",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("10");
    });

    it("returns strlen for string type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "str",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("str", [
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "str",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("strlen(str)");
    });

    it("uses cached length when available", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "str",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("str", [
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState({
        lengthCache: new Map([["str", "__len_str"]]),
      });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "str",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("__len_str");
    });

    it("returns bit width for integer type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("32");
    });

    it("returns 32 for enum type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "color",
          {
            baseType: "Color",
            bitWidth: 32,
            isArray: false,
            isConst: false,
            isEnum: true,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("color", [
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "color",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("32");
    });

    it("returns dimension for 2D array type at depth 0", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "matrix",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: [3, 4],
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("matrix", [
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "matrix",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("3");
    });

    it("returns dimension for 2D array type at depth 1", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "matrix",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: [3, 4],
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("matrix", [
        createMockPostfixOp({ expressions: [createMockExpression("0")] }),
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "matrix",
        generateExpression: () => "0",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("4");
    });

    it("returns bit width when subscriptDepth exceeds dimensions", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "arr",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: [10],
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("arr", [
        createMockPostfixOp({ expressions: [createMockExpression("0")] }),
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "arr",
        generateExpression: () => "0",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("32");
    });

    it("returns strlen for string array element", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "names",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: true,
            arrayDimensions: [5, 32],
            isConst: false,
            isString: true,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("names", [
        createMockPostfixOp({ expressions: [createMockExpression("0")] }),
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "names",
        generateExpression: () => "0",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("strlen(names[0])");
    });

    it("returns dimension for string array at depth 0", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "names",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: true,
            arrayDimensions: [5, 32],
            isConst: false,
            isString: true,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("names", [
        createMockPostfixOp({ identifier: "length" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "names",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("5");
    });
  });

  describe(".capacity property", () => {
    it("returns string capacity", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "str",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 64,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("str", [
        createMockPostfixOp({ identifier: "capacity" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "str",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("64");
    });
  });

  describe(".size property", () => {
    it("returns capacity + 1 for string", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "str",
          {
            baseType: "char",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isString: true,
            stringCapacity: 64,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("str", [
        createMockPostfixOp({ identifier: "size" }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "str",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("65");
    });
  });

  describe("bitmap field access", () => {
    it("generates bitmap field read", () => {
      const symbols = createMockSymbols({
        bitmapFields: new Map([
          ["Status", new Map([["Running", { offset: 0, width: 1 }]])],
        ]),
      });
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "status",
          {
            baseType: "Status",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isBitmap: true,
            bitmapTypeName: "Status",
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("status", [
        createMockPostfixOp({ identifier: "Running" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "status",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("((status >> 0) & 1)");
    });

    it("throws for unknown bitmap field", () => {
      const symbols = createMockSymbols({
        bitmapFields: new Map([["Status", new Map()]]),
      });
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "status",
          {
            baseType: "Status",
            bitWidth: 8,
            isArray: false,
            isConst: false,
            isBitmap: true,
            bitmapTypeName: "Status",
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("status", [
        createMockPostfixOp({ identifier: "Unknown" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "status",
      });

      expect(() =>
        generatePostfixExpression(ctx, input, state, orchestrator),
      ).toThrow("Unknown bitmap field 'Unknown' on type 'Status'");
    });
  });

  describe("scope member access", () => {
    it("generates cross-scope function call", () => {
      const ctx = createMockPostfixExpressionContext("LED", [
        createMockPostfixOp({ identifier: "on" }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "LED",
        isKnownScope: (name) => name === "LED",
        getScopeSeparator: () => "_",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("LED_on");
    });

    it("throws when referencing own scope by name", () => {
      const ctx = createMockPostfixExpressionContext("Motor", [
        createMockPostfixOp({ identifier: "speed" }),
      ]);
      const input = createMockInput();
      const state = createMockState({ currentScope: "Motor" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "Motor",
        isKnownScope: (name) => name === "Motor",
      });

      expect(() =>
        generatePostfixExpression(ctx, input, state, orchestrator),
      ).toThrow("Cannot reference own scope 'Motor' by name");
    });

    it("uses :: separator for C++ mode", () => {
      const ctx = createMockPostfixExpressionContext("LED", [
        createMockPostfixOp({ identifier: "on" }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "LED",
        isKnownScope: (name) => name === "LED",
        isCppScopeSymbol: () => true,
        getScopeSeparator: (isCpp) => (isCpp ? "::" : "_"),
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("LED::on");
    });
  });

  describe("enum member access", () => {
    it("generates enum member access", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["Color"]),
      });
      const ctx = createMockPostfixExpressionContext("Color", [
        createMockPostfixOp({ identifier: "Red" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "Color",
        getScopeSeparator: () => "_",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("Color_Red");
    });

    it("throws when accessing enum without global prefix inside scope", () => {
      const symbols = createMockSymbols({
        knownEnums: new Set(["Color"]),
      });
      const ctx = createMockPostfixExpressionContext("Color", [
        createMockPostfixOp({ identifier: "Red" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState({ currentScope: "Motor" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "Color",
        getScopeSeparator: () => "_",
      });

      expect(() =>
        generatePostfixExpression(ctx, input, state, orchestrator),
      ).toThrow("Use 'global.Color.Red' to access enum 'Color'");
    });
  });

  describe("register member access", () => {
    it("generates register member access", () => {
      const symbols = createMockSymbols({
        knownRegisters: new Set(["GPIO"]),
      });
      const ctx = createMockPostfixExpressionContext("GPIO", [
        createMockPostfixOp({ identifier: "PIN0" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "GPIO",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("GPIO_PIN0");
    });

    it("throws for write-only register read", () => {
      const symbols = createMockSymbols({
        knownRegisters: new Set(["GPIO"]),
        registerMemberAccess: new Map([["GPIO_DATA", "wo"]]),
      });
      const ctx = createMockPostfixExpressionContext("GPIO", [
        createMockPostfixOp({ identifier: "DATA" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "GPIO",
      });

      expect(() =>
        generatePostfixExpression(ctx, input, state, orchestrator),
      ).toThrow("cannot read from write-only register member 'DATA'");
    });

    it("throws when accessing register without global prefix inside scope", () => {
      const symbols = createMockSymbols({
        knownRegisters: new Set(["GPIO"]),
      });
      const ctx = createMockPostfixExpressionContext("GPIO", [
        createMockPostfixOp({ identifier: "PIN0" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState({ currentScope: "Motor" });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "GPIO",
      });

      expect(() =>
        generatePostfixExpression(ctx, input, state, orchestrator),
      ).toThrow("Use 'global.GPIO.PIN0' to access register 'GPIO'");
    });
  });

  describe("struct parameter access", () => {
    it("uses -> for struct parameter member access in C mode", () => {
      const params = new Map<string, TParameterInfo>([
        [
          "point",
          {
            name: "point",
            baseType: "Point",
            isArray: false,
            isStruct: true,
            isConst: false,
            isCallback: false,
            isString: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("point", [
        createMockPostfixOp({ identifier: "x" }),
      ]);
      const input = createMockInput();
      const state = createMockState({ currentParameters: params });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "point",
        isCppMode: () => false,
        getMemberTypeInfo: () => ({ baseType: "i32", isArray: false }),
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("point->x");
    });

    it("uses . for struct parameter member access in C++ mode", () => {
      const params = new Map<string, TParameterInfo>([
        [
          "point",
          {
            name: "point",
            baseType: "Point",
            isArray: false,
            isStruct: true,
            isConst: false,
            isCallback: false,
            isString: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("point", [
        createMockPostfixOp({ identifier: "x" }),
      ]);
      const input = createMockInput();
      const state = createMockState({ currentParameters: params });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "point",
        isCppMode: () => true,
        getMemberTypeInfo: () => ({ baseType: "i32", isArray: false }),
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("point.x");
    });
  });

  describe("array subscript access", () => {
    it("generates array index access", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "arr",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: [10],
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("arr", [
        createMockPostfixOp({ expressions: [createMockExpression("5")] }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "arr",
        generateExpression: () => "5",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("arr[5]");
    });

    it("generates bit access for integer type", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({ expressions: [createMockExpression("3")] }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
        generateExpression: () => "3",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("((val >> 3) & 1)");
    });

    it("generates register bit access", () => {
      const symbols = createMockSymbols({
        knownRegisters: new Set(["GPIO"]),
      });
      const ctx = createMockPostfixExpressionContext("GPIO", [
        createMockPostfixOp({ expressions: [createMockExpression("0")] }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "GPIO",
        generateExpression: () => "0",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("((GPIO >> 0) & 1)");
    });

    it("throws for bracket indexing on bitmap type", () => {
      // This test requires the registerMemberTypes to be set for the resolved
      // member (result after member access), which is "GPIO_CTRL"
      const symbols = createMockSymbols({
        knownRegisters: new Set(["GPIO"]),
        registerMemberTypes: new Map([["GPIO_CTRL", "CtrlBits"]]),
      });
      const ctx = createMockPostfixExpressionContext("GPIO", [
        createMockPostfixOp({ identifier: "CTRL" }),
        createMockPostfixOp({ expressions: [createMockExpression("0")] }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "GPIO",
        generateExpression: () => "0",
      });

      expect(() =>
        generatePostfixExpression(ctx, input, state, orchestrator),
      ).toThrow("Cannot use bracket indexing on bitmap type 'CtrlBits'");
    });
  });

  describe("bit range access", () => {
    it("generates bit range extraction", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({
          expressions: [createMockExpression("4"), createMockExpression("8")],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
        generateExpression: (ctx) => ctx.getText(),
        generateBitMask: () => "0xFF",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("((val >> 4) & 0xFF)");
    });

    it("optimizes bit range at position 0", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({
          expressions: [createMockExpression("0"), createMockExpression("8")],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
        generateExpression: (ctx) => ctx.getText(),
        generateBitMask: () => "0xFF",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("((val) & 0xFF)");
    });
  });

  describe("float bit indexing", () => {
    it("generates float bit range with memcpy", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "f",
          {
            baseType: "f32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("f", [
        createMockPostfixOp({
          expressions: [createMockExpression("0"), createMockExpression("8")],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState({ inFunctionBody: true });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "f",
        generateExpression: (ctx) => ctx.getText(),
        generateBitMask: () => "0xFF",
        hasFloatBitShadow: () => false,
        isFloatShadowCurrent: () => false,
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toContain("memcpy");
      expect(result.code).toContain("__bits_f");
      expect(result.effects).toContainEqual({
        type: "include",
        header: "string",
      });
      expect(result.effects).toContainEqual({
        type: "include",
        header: "float_static_assert",
      });
    });

    it("throws for float bit indexing at global scope", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "f",
          {
            baseType: "f32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("f", [
        createMockPostfixOp({
          expressions: [createMockExpression("0"), createMockExpression("8")],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState({ inFunctionBody: false });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "f",
        generateExpression: (ctx) => ctx.getText(),
      });

      expect(() =>
        generatePostfixExpression(ctx, input, state, orchestrator),
      ).toThrow("cannot be used at global scope");
    });

    it("skips memcpy when shadow is current", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "f",
          {
            baseType: "f32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("f", [
        createMockPostfixOp({
          expressions: [createMockExpression("0"), createMockExpression("8")],
        }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState({ inFunctionBody: true });
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "f",
        generateExpression: (ctx) => ctx.getText(),
        generateBitMask: () => "0xFF",
        hasFloatBitShadow: () => true,
        isFloatShadowCurrent: () => true,
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).not.toContain("memcpy");
      expect(result.code).toBe("(__bits_f & 0xFF)");
    });
  });

  describe("function call", () => {
    it("generates function call", () => {
      const ctx = createMockPostfixExpressionContext("foo", [
        createMockPostfixOp({
          argumentList: {
            expression: () => [createMockExpression("1")],
          } as unknown as Parser.ArgumentListContext,
        }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "foo",
        generateExpression: () => "1",
        generateFunctionArg: () => "1",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toContain("foo");
    });
  });

  describe("non-array parameter subscript (Issue #579)", () => {
    it("uses parameter name directly for non-array param with subscript", () => {
      // Issue #579: Non-array parameters become pointers in C (ADR-006)
      // so buf[i] should be array access, not bit access
      const params = new Map<string, TParameterInfo>([
        [
          "buf",
          {
            name: "buf",
            baseType: "u8",
            isArray: false,
            isStruct: false,
            isConst: false,
            isCallback: false,
            isString: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("buf", [
        createMockPostfixOp({ expressions: [createMockExpression("3")] }),
      ]);
      const input = createMockInput();
      const state = createMockState({ currentParameters: params });
      const orchestrator = createMockOrchestrator({
        generateExpression: () => "3",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      // Non-array parameters use array access (they become pointers in C)
      expect(result.code).toBe("buf[3]");
    });

    it("uses bit access for scalar variable (not parameter) with subscript", () => {
      // Scalar variables that are NOT parameters should use bit access
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "val",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: false,
            isConst: false,
            // Note: no isParameter flag
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("val", [
        createMockPostfixOp({ expressions: [createMockExpression("3")] }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "val",
        generateExpression: () => "3",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("((val >> 3) & 1)");
    });
  });

  describe("C++ scope symbols (Issue #516)", () => {
    it("uses :: separator when primary is C++ scope symbol", () => {
      const ctx = createMockPostfixExpressionContext("std", [
        createMockPostfixOp({ identifier: "cout" }),
      ]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "std",
        isCppScopeSymbol: (name) => name === "std",
        getScopeSeparator: (isCpp) => (isCpp ? "::" : "."),
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("std::cout");
    });
  });

  describe("register member with bitmap type", () => {
    it("generates bitmap field access on register member", () => {
      const symbols = createMockSymbols({
        registerMemberTypes: new Map([["MOTOR_CTRL", "CtrlBits"]]),
        bitmapFields: new Map([
          ["CtrlBits", new Map([["Running", { offset: 0, width: 1 }]])],
        ]),
      });
      const ctx = createMockPostfixExpressionContext("MOTOR_CTRL", [
        createMockPostfixOp({ identifier: "Running" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "MOTOR_CTRL",
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("((MOTOR_CTRL >> 0) & 1)");
    });

    it("throws for unknown field on register bitmap member", () => {
      const symbols = createMockSymbols({
        registerMemberTypes: new Map([["MOTOR_CTRL", "CtrlBits"]]),
        bitmapFields: new Map([["CtrlBits", new Map()]]),
      });
      const ctx = createMockPostfixExpressionContext("MOTOR_CTRL", [
        createMockPostfixOp({ identifier: "Unknown" }),
      ]);
      const input = createMockInput({ symbols });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "MOTOR_CTRL",
      });

      expect(() =>
        generatePostfixExpression(ctx, input, state, orchestrator),
      ).toThrow("Unknown bitmap field 'Unknown' on register member");
    });
  });

  describe("struct member with bitmap type", () => {
    it("generates bitmap field access on struct member", () => {
      const symbols = createMockSymbols({
        bitmapFields: new Map([
          ["StatusBits", new Map([["Active", { offset: 0, width: 1 }]])],
        ]),
      });
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "device",
          {
            baseType: "Device",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("device", [
        createMockPostfixOp({ identifier: "flags" }),
        createMockPostfixOp({ identifier: "Active" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "device",
        isKnownStruct: (name) => name === "Device",
        getMemberTypeInfo: (struct, member) => {
          if (struct === "Device" && member === "flags") {
            return { baseType: "StatusBits", isArray: false };
          }
          return null;
        },
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("((device.flags >> 0) & 1)");
    });

    it("throws for unknown bitmap field on struct member", () => {
      const symbols = createMockSymbols({
        bitmapFields: new Map([["StatusBits", new Map()]]),
      });
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "device",
          {
            baseType: "Device",
            bitWidth: 0,
            isArray: false,
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("device", [
        createMockPostfixOp({ identifier: "flags" }),
        createMockPostfixOp({ identifier: "Unknown" }),
      ]);
      const input = createMockInput({ symbols, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "device",
        isKnownStruct: (name) => name === "Device",
        getMemberTypeInfo: (struct, member) => {
          if (struct === "Device" && member === "flags") {
            return { baseType: "StatusBits", isArray: false };
          }
          return null;
        },
      });

      expect(() =>
        generatePostfixExpression(ctx, input, state, orchestrator),
      ).toThrow("Unknown bitmap field 'Unknown' on struct member");
    });
  });

  describe("multi-dimensional array access", () => {
    it("tracks remaining dimensions through subscripts", () => {
      const typeRegistry = new Map<string, TTypeInfo>([
        [
          "matrix",
          {
            baseType: "u32",
            bitWidth: 32,
            isArray: true,
            arrayDimensions: [3, 4],
            isConst: false,
          },
        ],
      ]);
      const ctx = createMockPostfixExpressionContext("matrix", [
        createMockPostfixOp({ expressions: [createMockExpression("0")] }),
        createMockPostfixOp({ expressions: [createMockExpression("1")] }),
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        generatePrimaryExpr: () => "matrix",
        generateExpression: (ctx) => ctx.getText(),
      });

      const result = generatePostfixExpression(ctx, input, state, orchestrator);
      expect(result.code).toBe("matrix[0][1]");
    });
  });
});
