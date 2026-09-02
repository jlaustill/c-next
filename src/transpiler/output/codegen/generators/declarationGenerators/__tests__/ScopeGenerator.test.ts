/**
 * Unit tests for ScopeGenerator - ADR-016 Scope Declaration Generation
 *
 * Tests scope generation including:
 * - Basic scope structure with comment
 * - Variable declarations (private/public, const, array, string)
 * - Constructor syntax (Issue #375)
 * - Function declarations with visibility
 * - Nested enum, bitmap, struct, and register declarations
 * - Self-include handling (Issue #369)
 */

import { describe, it, expect, vi } from "vitest";
import generateScope from "../ScopeGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";
import TestGeneratorState from "../../__tests__/testGeneratorState";
import PublicInterface from "../../../../../logic/symbols/PublicInterface";
import CodeGenState from "../../../../../state/CodeGenState";

// ========================================================================
// Test Helpers
// ========================================================================

/**
 * Create a mock visibility modifier context.
 */
function createMockVisibility(
  visibility: string | null,
): Parser.VisibilityModifierContext | null {
  if (!visibility) return null;
  return {
    getText: () => visibility,
  } as unknown as Parser.VisibilityModifierContext;
}

/**
 * Create a mock const modifier context.
 */
function createMockConstModifier(
  isConst: boolean,
): Parser.ConstModifierContext | null {
  return isConst ? ({} as Parser.ConstModifierContext) : null;
}

/**
 * Create a mock array type context.
 * Updated for new grammar: arrayType has arrayTypeDimension() which returns dimensions
 */
function createMockArrayType(sizeExpr?: string | null) {
  // Create a single dimension with optional expression
  const mockDimension = {
    expression: () =>
      sizeExpr
        ? {
            getText: () => sizeExpr,
            __mockValue: sizeExpr,
          }
        : null,
  };

  return {
    // New grammar: arrayTypeDimension() returns array of dimensions
    arrayTypeDimension: () => [mockDimension],
    // Keep primitiveType for base type extraction
    primitiveType: () => null,
    userType: () => null,
    stringType: () => null,
  };
}

/**
 * Create a mock type context.
 */
function createMockType(
  typeName: string,
  hasStringType = false,
  arrayTypeSize?: string | null,
) {
  return {
    getText: () => typeName,
    stringType: () =>
      hasStringType
        ? {
            INTEGER_LITERAL: () => ({ getText: () => "32" }),
          }
        : null,
    arrayType: () =>
      arrayTypeSize !== undefined ? createMockArrayType(arrayTypeSize) : null,
  };
}

/**
 * Create a mock array dimension context.
 */
function createMockArrayDimension(size: string): Parser.ArrayDimensionContext {
  return {
    getText: () => `[${size}]`,
  } as unknown as Parser.ArrayDimensionContext;
}

/**
 * Create a mock expression context.
 */
function createMockExpression(value: string): Parser.ExpressionContext {
  return {
    getText: () => value,
    __mockValue: value,
  } as unknown as Parser.ExpressionContext;
}

/**
 * Create a mock constructor argument list.
 */
function createMockConstructorArgList(
  args: string[],
): Parser.ConstructorArgumentListContext {
  return {
    IDENTIFIER: () => args.map((arg) => ({ getText: () => arg })),
  } as unknown as Parser.ConstructorArgumentListContext;
}

/**
 * Create a mock variable declaration.
 */
function createMockVariableDecl(options: {
  name: string;
  type: string;
  isConst?: boolean;
  isAtomic?: boolean;
  isVolatile?: boolean;
  initialValue?: string;
  arrayDims?: string[];
  hasStringType?: boolean;
  constructorArgs?: string[];
  startLine?: number;
  arrayTypeSize?: string | null; // C-Next style: u16[8] name
}) {
  return {
    IDENTIFIER: () => ({ getText: () => options.name }),
    type: () =>
      createMockType(
        options.type,
        options.hasStringType,
        options.arrayTypeSize,
      ),
    constModifier: () => createMockConstModifier(options.isConst ?? false),
    // Issue #998: atomic and volatile modifiers for scope variables
    // Uses VariableModifierBuilder for consistent handling
    atomicModifier: () => (options.isAtomic ? ({} as unknown) : null),
    volatileModifier: () => (options.isVolatile ? ({} as unknown) : null),
    expression: () =>
      options.initialValue ? createMockExpression(options.initialValue) : null,
    arrayDimension: () =>
      (options.arrayDims ?? []).map(createMockArrayDimension),
    constructorArgumentList: () =>
      options.constructorArgs
        ? createMockConstructorArgList(options.constructorArgs)
        : null,
    start: { line: options.startLine ?? 1 },
  };
}

/**
 * Create a mock parameter list context.
 */
function createMockParameterList(): Parser.ParameterListContext {
  return {
    parameter: () => [],
  } as unknown as Parser.ParameterListContext;
}

/**
 * Create a mock block context.
 */
function createMockBlock(): Parser.BlockContext {
  return {
    statement: () => [],
  } as unknown as Parser.BlockContext;
}

/**
 * Create a mock function declaration.
 */
function createMockFunctionDecl(options: {
  name: string;
  returnType: string;
  hasParams?: boolean;
}) {
  return {
    IDENTIFIER: () => ({ getText: () => options.name }),
    type: () => createMockType(options.returnType),
    parameterList: () => (options.hasParams ? createMockParameterList() : null),
    block: () => createMockBlock(),
  };
}

/**
 * Create a mock enum member.
 */
function createMockEnumMember(name: string, value?: string) {
  return {
    IDENTIFIER: () => ({ getText: () => name }),
    expression: () => (value ? createMockExpression(value) : null),
  };
}

/**
 * Create a mock enum declaration.
 */
function createMockEnumDecl(
  name: string,
  members: Array<{ name: string; value?: string }>,
) {
  return {
    IDENTIFIER: () => ({ getText: () => name }),
    enumMember: () => members.map((m) => createMockEnumMember(m.name, m.value)),
  };
}

/**
 * Create a mock bitmap member.
 */
function createMockBitmapMember(name: string, width?: number) {
  return {
    IDENTIFIER: () => ({ getText: () => name }),
    INTEGER_LITERAL: () => (width ? { getText: () => String(width) } : null),
  };
}

/**
 * Create a mock bitmap declaration.
 */
function createMockBitmapDecl(
  name: string,
  keyword: string,
  members: Array<{ name: string; width?: number }>,
) {
  return {
    IDENTIFIER: () => ({ getText: () => name }),
    getChild: (i: number) => (i === 0 ? { getText: () => keyword } : null),
    bitmapMember: () =>
      members.map((m) => createMockBitmapMember(m.name, m.width)),
  };
}

/**
 * Create a mock struct member.
 */
function createMockStructMember(
  name: string,
  type: string,
  arrayDims?: string[],
  hasStringType = false,
  arrayTypeSize?: string | null,
) {
  return {
    IDENTIFIER: () => ({ getText: () => name }),
    type: () => createMockType(type, hasStringType, arrayTypeSize),
    arrayDimension: () => (arrayDims ?? []).map(createMockArrayDimension),
  };
}

/**
 * Create a mock struct declaration.
 */
function createMockStructDecl(
  name: string,
  members: Array<{
    name: string;
    type: string;
    arrayDims?: string[];
    hasStringType?: boolean;
    arrayTypeSize?: string | null;
  }>,
) {
  return {
    IDENTIFIER: () => ({ getText: () => name }),
    structMember: () =>
      members.map((m) =>
        createMockStructMember(
          m.name,
          m.type,
          m.arrayDims,
          m.hasStringType,
          m.arrayTypeSize,
        ),
      ),
  };
}

/**
 * Create a mock register member.
 */
function createMockRegisterMember(
  name: string,
  type: string,
  access: string,
  offset: string,
) {
  return {
    IDENTIFIER: () => ({ getText: () => name }),
    type: () => createMockType(type),
    accessModifier: () => ({ getText: () => access }),
    expression: () => createMockExpression(offset),
  };
}

/**
 * Create a mock register declaration.
 */
function createMockRegisterDecl(
  name: string,
  baseAddress: string,
  members: Array<{
    name: string;
    type: string;
    access: string;
    offset: string;
  }>,
) {
  return {
    IDENTIFIER: () => ({ getText: () => name }),
    expression: () => createMockExpression(baseAddress),
    registerMember: () =>
      members.map((m) =>
        createMockRegisterMember(m.name, m.type, m.access, m.offset),
      ),
  };
}

/**
 * Create a mock scope member.
 */
function createMockScopeMember(options: {
  visibility?: string;
  variableDecl?: ReturnType<typeof createMockVariableDecl>;
  functionDecl?: ReturnType<typeof createMockFunctionDecl>;
  enumDecl?: ReturnType<typeof createMockEnumDecl>;
  bitmapDecl?: ReturnType<typeof createMockBitmapDecl>;
  structDecl?: ReturnType<typeof createMockStructDecl>;
  registerDecl?: ReturnType<typeof createMockRegisterDecl>;
}): Parser.ScopeMemberContext {
  return {
    visibilityModifier: () => createMockVisibility(options.visibility ?? null),
    variableDeclaration: () => options.variableDecl ?? null,
    functionDeclaration: () => options.functionDecl ?? null,
    enumDeclaration: () => options.enumDecl ?? null,
    bitmapDeclaration: () => options.bitmapDecl ?? null,
    structDeclaration: () => options.structDecl ?? null,
    registerDeclaration: () => options.registerDecl ?? null,
  } as unknown as Parser.ScopeMemberContext;
}

/**
 * Create a mock scope declaration context.
 */
function createMockScopeContext(
  name: string,
  members: Parser.ScopeMemberContext[],
): Parser.ScopeDeclarationContext {
  return {
    IDENTIFIER: () => ({ getText: () => name }),
    scopeMember: () => members,
  } as unknown as Parser.ScopeDeclarationContext;
}

/**
 * Create minimal mock input.
 */
function createMockInput(
  overrides?: Partial<IGeneratorInput>,
): IGeneratorInput {
  return {
    symbols: {
      enumMembers: new Map(),
      knownScopes: new Set(),
      knownStructs: new Set(),
      knownRegisters: new Set(),
      knownEnums: new Set(),
      knownBitmaps: new Set(),
      scopeMembers: new Map(),
      scopeMemberVisibility: new Map(),
      structFields: new Map(),
      structFieldArrays: new Map(),
      structFieldDimensions: new Map(),
      bitmapFields: new Map(),
      bitmapBackingType: new Map(),
      bitmapBitWidth: new Map(),
      scopedRegisters: new Map(),
      registerMemberAccess: new Map(),
      registerMemberTypes: new Map(),
      scopePrivateConstValues: new Map(),
    },
    symbolTable: null,
    typeRegistry: new Map(),
    functionSignatures: new Map(),
    knownFunctions: new Set(),
    knownStructs: new Set(),
    constValues: new Map(),
    callbackTypes: new Map(),
    callbackFieldTypes: new Map(),
    targetCapabilities: { hasAtomicSupport: false },
    debugMode: false,
    ...overrides,
  } as unknown as IGeneratorInput;
}

/**
 * Create minimal mock state.
 */
function createMockState(
  overrides?: Partial<IGeneratorState>,
): IGeneratorState {
  return TestGeneratorState.create(overrides);
}

/**
 * Create mock orchestrator with common methods.
 */
function createMockOrchestrator(
  overrides?: Partial<IOrchestrator>,
): IOrchestrator {
  return {
    setCurrentScope: vi.fn(),
    generateType: vi.fn((ctx) => {
      const text = ctx.getText();
      const typeMap: Record<string, string> = {
        u8: "uint8_t",
        u16: "uint16_t",
        u32: "uint32_t",
        u64: "uint64_t",
        i8: "int8_t",
        i16: "int16_t",
        i32: "int32_t",
        i64: "int64_t",
        f32: "float",
        f64: "double",
        bool: "bool",
        void: "void",
      };
      return typeMap[text] ?? text;
    }),
    generateExpression: vi.fn((ctx) => ctx.__mockValue ?? ctx.getText()),
    generateArrayDimensions: vi.fn((dims) =>
      dims.map((d: { getText: () => string }) => d.getText()).join(""),
    ),
    getZeroInitializer: vi.fn((typeCtx, isArray) => (isArray ? "{0}" : "0")),
    setCurrentFunctionName: vi.fn(),
    setParameters: vi.fn(),
    enterFunctionBody: vi.fn(),
    generateBlock: vi.fn(() => "{ }"),
    updateFunctionParamsAutoConst: vi.fn(),
    generateParameterList: vi.fn(() => "void"),
    exitFunctionBody: vi.fn(),
    clearParameters: vi.fn(),
    isCallbackTypeUsedAsFieldType: vi.fn(() => false),
    recordCallbackTypedef: vi.fn(),
    getCallbackTypedefName: vi.fn(() => null),
    generateCallbackTypedef: vi.fn(() => null),
    isConstValue: vi.fn(() => true),
    tryEvaluateConstant: vi.fn(() => undefined),
    // Issue #948: Opaque type helpers
    isOpaqueType: vi.fn(() => false),
    // Issue #958: Typedef struct type helper
    isTypedefStructType: vi.fn(() => false),
    markOpaqueScopeVariable: vi.fn(),
    ...overrides,
  } as unknown as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("ScopeGenerator", () => {
  // ========================================================================
  // Basic scope structure
  // ========================================================================

  describe("basic scope structure", () => {
    it("generates scope comment and sets/clears scope", () => {
      const ctx = createMockScopeContext("Driver", []);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("/* Scope: Driver */");
      expect(orchestrator.setCurrentScope).toHaveBeenCalledWith("Driver");
      expect(orchestrator.setCurrentScope).toHaveBeenLastCalledWith(null);
    });

    it("returns empty effects array", () => {
      const ctx = createMockScopeContext("Test", []);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.effects).toEqual([]);
    });
  });

  // ========================================================================
  // Variable declarations
  // ========================================================================

  describe("variable declarations", () => {
    // Issue #1200: a callback-typed scope member renders as its function-pointer
    // typedef. Without this the raw function name was emitted as the type, which
    // collides with the function of the same name.
    it("renders a callback-typed scope member as its _fp typedef", () => {
      const varDecl = createMockVariableDecl({
        name: "tick",
        type: "tickSource",
        initialValue: "tickSource",
      });
      const member = createMockScopeMember({
        visibility: "public",
        variableDecl: varDecl,
      });
      const ctx = createMockScopeContext("Clock", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        getCallbackTypedefName: vi.fn(() => "tickSource_fp"),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("tickSource_fp Clock__tick");
      expect(result.code).not.toContain("tickSource Clock__tick");
    });

    it("leaves a non-callback scope member type untouched", () => {
      const varDecl = createMockVariableDecl({
        name: "counter",
        type: "u32",
        initialValue: "0",
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Stats", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("static uint32_t Stats__counter = 0;");
    });

    it("generates private variable with static modifier", () => {
      const varDecl = createMockVariableDecl({
        name: "counter",
        type: "u32",
        initialValue: "0",
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Stats", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("static uint32_t Stats__counter = 0;");
    });

    it("generates public variable without static modifier", () => {
      const varDecl = createMockVariableDecl({
        name: "value",
        type: "u16",
        initialValue: "100",
      });
      const member = createMockScopeMember({
        visibility: "public",
        variableDecl: varDecl,
      });
      const ctx = createMockScopeContext("API", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("uint16_t API__value = 100;");
      expect(result.code).not.toContain("static uint16_t API_value");
    });

    it("skips private const non-array variables (inlined)", () => {
      const varDecl = createMockVariableDecl({
        name: "MAX_SIZE",
        type: "u8",
        isConst: true,
        initialValue: "255",
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Config", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).not.toContain("MAX_SIZE");
    });

    it("emits public const variables", () => {
      const varDecl = createMockVariableDecl({
        name: "VERSION",
        type: "u8",
        isConst: true,
        initialValue: "1",
      });
      const member = createMockScopeMember({
        visibility: "public",
        variableDecl: varDecl,
      });
      const ctx = createMockScopeContext("App", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("const uint8_t App__VERSION = 1;");
    });

    it("emits private const array variables (Issue #500)", () => {
      const varDecl = createMockVariableDecl({
        name: "LOOKUP",
        type: "u8",
        isConst: true,
        arrayDims: ["10"],
        initialValue: "{0}",
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Data", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain(
        "static const uint8_t Data__LOOKUP[10] = {0};",
      );
    });

    it("generates array variable with dimensions", () => {
      const varDecl = createMockVariableDecl({
        name: "buffer",
        type: "u8",
        arrayDims: ["256"],
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Serial", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain(
        "static uint8_t Serial__buffer[256] = {0};",
      );
    });

    it("generates C-Next style array variable with constant size", () => {
      const varDecl = createMockVariableDecl({
        name: "data",
        type: "u16[8]",
        arrayTypeSize: "8",
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Buffer", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        tryEvaluateConstant: vi.fn(() => 8),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("static u16[8] Buffer__data[8] = {0};");
    });

    it("generates C-Next style array variable with non-constant expression (fallback)", () => {
      const varDecl = createMockVariableDecl({
        name: "items",
        type: "u16[BUFFER_SIZE]",
        arrayTypeSize: "BUFFER_SIZE",
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Storage", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        tryEvaluateConstant: vi.fn(() => undefined), // Can't resolve macro
        generateExpression: vi.fn(() => "BUFFER_SIZE"),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain(
        "static u16[BUFFER_SIZE] Storage__items[BUFFER_SIZE] = {0};",
      );
    });

    it("generates C-Next style array variable with no size (empty brackets)", () => {
      const varDecl = createMockVariableDecl({
        name: "flexible",
        type: "u8[]",
        arrayTypeSize: null, // No size expression
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Dynamic", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("static u8[] Dynamic__flexible[] = {0};");
    });

    it("generates string variable with capacity dimension (ADR-045)", () => {
      const varDecl = createMockVariableDecl({
        name: "message",
        type: "string<32>",
        hasStringType: true,
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Logger", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      // Capacity + 1 for null terminator
      expect(result.code).toContain(
        "static string<32> Logger__message[33] = 0;",
      );
    });

    it("generates uninitialized variable with zero initializer (ADR-015)", () => {
      const varDecl = createMockVariableDecl({
        name: "status",
        type: "u32",
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Device", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("static uint32_t Device__status = 0;");
      expect(orchestrator.getZeroInitializer).toHaveBeenCalled();
    });

    it("generates opaque type variable as pointer with NULL (Issue #948)", () => {
      const varDecl = createMockVariableDecl({
        name: "widget",
        type: "widget_t",
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("GUI", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        isOpaqueType: vi.fn(() => true),
        markOpaqueScopeVariable: vi.fn(),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      // Should generate as pointer with NULL initialization
      expect(result.code).toContain("static widget_t* GUI__widget = NULL;");
      // Should call markOpaqueScopeVariable
      expect(orchestrator.markOpaqueScopeVariable).toHaveBeenCalledWith(
        "GUI__widget",
      );
    });

    it("does not generate pointer for non-opaque struct types", () => {
      const varDecl = createMockVariableDecl({
        name: "point",
        type: "Point",
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Canvas", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        isOpaqueType: vi.fn(() => false),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      // Should generate as value with {0} initialization
      expect(result.code).toContain("static Point Canvas__point = 0;");
      expect(result.code).not.toContain("Point*");
    });

    it("generates atomic variable with volatile modifier (Issue #998)", () => {
      const varDecl = createMockVariableDecl({
        name: "counter",
        type: "u32",
        isAtomic: true,
        initialValue: "0",
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("ISR", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain(
        "static volatile uint32_t ISR__counter = 0;",
      );
    });

    it("generates public atomic variable with volatile but without static (Issue #998)", () => {
      const varDecl = createMockVariableDecl({
        name: "flag",
        type: "bool",
        isAtomic: true,
        initialValue: "false",
      });
      const member = createMockScopeMember({
        visibility: "public",
        variableDecl: varDecl,
      });
      const ctx = createMockScopeContext("Shared", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("volatile bool Shared__flag = false;");
      expect(result.code).not.toContain("static volatile bool Shared_flag");
    });

    it("generates volatile-keyword variable with volatile modifier (Issue #998)", () => {
      const varDecl = createMockVariableDecl({
        name: "reg",
        type: "u8",
        isVolatile: true,
        initialValue: "0",
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("HW", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("static volatile uint8_t HW__reg = 0;");
    });

    it("throws error when both atomic and volatile are specified (Issue #998)", () => {
      const varDecl = createMockVariableDecl({
        name: "bad",
        type: "u8",
        isAtomic: true,
        isVolatile: true,
        initialValue: "0",
        startLine: 10,
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Test", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      expect(() => generateScope(ctx, input, state, orchestrator)).toThrow(
        /Cannot use both 'atomic' and 'volatile' modifiers/,
      );
    });
  });

  // ========================================================================
  // Constructor syntax (Issue #375)
  // ========================================================================

  describe("constructor syntax (Issue #375)", () => {
    it("generates constructor call with const arguments", () => {
      const varDecl = createMockVariableDecl({
        name: "sensor",
        type: "Sensor",
        constructorArgs: ["PIN", "RATE"],
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("HW", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        isConstValue: vi.fn(() => true),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain(
        "static Sensor HW__sensor(HW__PIN, HW__RATE);",
      );
    });

    it("throws error for non-const constructor argument", () => {
      const varDecl = createMockVariableDecl({
        name: "obj",
        type: "MyClass",
        constructorArgs: ["nonConstArg"],
        startLine: 42,
      });
      const member = createMockScopeMember({ variableDecl: varDecl });
      const ctx = createMockScopeContext("Test", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        isConstValue: vi.fn(() => false),
      });

      expect(() => generateScope(ctx, input, state, orchestrator)).toThrow(
        "Error at line 42: Constructor argument 'nonConstArg' must be const",
      );
    });

    it("generates public constructor without static", () => {
      const varDecl = createMockVariableDecl({
        name: "device",
        type: "Device",
        constructorArgs: ["CONFIG"],
      });
      const member = createMockScopeMember({
        visibility: "public",
        variableDecl: varDecl,
      });
      const ctx = createMockScopeContext("App", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        isConstValue: vi.fn(() => true),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("Device App__device(App__CONFIG);");
      expect(result.code).not.toContain("static Device App_device");
    });
  });

  // ========================================================================
  // Function declarations
  // ========================================================================

  describe("function declarations", () => {
    it("generates private function with static modifier", () => {
      const funcDecl = createMockFunctionDecl({
        name: "helper",
        returnType: "void",
      });
      // ADR-016: Functions are public by default, so explicit 'private' needed
      const member = createMockScopeMember({
        visibility: "private",
        functionDecl: funcDecl,
      });
      const ctx = createMockScopeContext("Utils", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("static void Utils__helper(void) { }");
    });

    it("generates public function without static modifier", () => {
      const funcDecl = createMockFunctionDecl({
        name: "init",
        returnType: "void",
      });
      const member = createMockScopeMember({
        visibility: "public",
        functionDecl: funcDecl,
      });
      const ctx = createMockScopeContext("Motor", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("void Motor__init(void) { }");
      expect(result.code).not.toContain("static void Motor_init");
    });

    it("generates function with parameters", () => {
      const funcDecl = createMockFunctionDecl({
        name: "process",
        returnType: "u32",
        hasParams: true,
      });
      const member = createMockScopeMember({
        visibility: "public",
        functionDecl: funcDecl,
      });
      const ctx = createMockScopeContext("Data", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        generateParameterList: vi.fn(() => "uint8_t* data, uint32_t len"),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain(
        "uint32_t Data__process(uint8_t* data, uint32_t len) { }",
      );
    });

    it("calls orchestrator methods in correct order", () => {
      const funcDecl = createMockFunctionDecl({
        name: "test",
        returnType: "void",
      });
      const member = createMockScopeMember({ functionDecl: funcDecl });
      const ctx = createMockScopeContext("Test", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      generateScope(ctx, input, state, orchestrator);

      // Verify call order
      expect(orchestrator.setCurrentFunctionName).toHaveBeenCalledWith(
        "Test__test",
      );
      expect(orchestrator.setParameters).toHaveBeenCalled();
      expect(orchestrator.enterFunctionBody).toHaveBeenCalled();
      expect(orchestrator.generateBlock).toHaveBeenCalled();
      expect(orchestrator.updateFunctionParamsAutoConst).toHaveBeenCalledWith(
        "Test__test",
      );
      expect(orchestrator.exitFunctionBody).toHaveBeenCalled();
      expect(orchestrator.setCurrentFunctionName).toHaveBeenLastCalledWith(
        null,
      );
      expect(orchestrator.clearParameters).toHaveBeenCalled();
    });

    it("generates callback typedef when used as field type (ADR-029)", () => {
      const funcDecl = createMockFunctionDecl({
        name: "callback",
        returnType: "void",
      });
      const member = createMockScopeMember({
        visibility: "public",
        functionDecl: funcDecl,
      });
      const ctx = createMockScopeContext("Events", [member]);
      const input = createMockInput();
      const state = createMockState();
      // Issue #1212: the typedef is no longer appended after the function.
      // ScopeGenerator's contract is now to report that a function was emitted;
      // whether a typedef is needed and where it lands belong to the orchestrator.
      const recordCallbackTypedef = vi.fn();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        isCallbackTypeUsedAsFieldType: vi.fn(() => true),
        recordCallbackTypedef,
        getCallbackTypedefName: vi.fn(() => null),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      expect(recordCallbackTypedef).toHaveBeenCalledWith(
        expect.stringContaining("callback"),
      );
      expect(result.code).not.toContain("typedef void (*");
    });
  });

  // ========================================================================
  // Enum declarations (ADR-017)
  // ========================================================================

  describe("enum declarations (ADR-017)", () => {
    it("generates scoped enum with symbol info", () => {
      const enumDecl = createMockEnumDecl("Status", [
        { name: "IDLE" },
        { name: "RUNNING" },
      ]);
      const member = createMockScopeMember({ enumDecl: enumDecl });
      const ctx = createMockScopeContext("Machine", [member]);
      const input = createMockInput({
        symbols: {
          ...createMockInput().symbols!,
          enumMembers: new Map([
            [
              "Machine__Status",
              new Map([
                ["IDLE", 0],
                ["RUNNING", 1],
              ]),
            ],
          ]),
        },
      } as Partial<IGeneratorInput>);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("typedef enum {");
      expect(result.code).toContain("Machine__Status__IDLE = 0,");
      expect(result.code).toContain("Machine__Status__RUNNING = 1");
      expect(result.code).toContain("} Machine__Status;");
    });

    it("skips enum when the header defines it (#369, #1300)", () => {
      CodeGenState.sourcePath = "test.cnx";
      const definesInHeader = vi
        .spyOn(PublicInterface, "definesTypeInHeader")
        .mockReturnValue(true);
      const enumDecl = createMockEnumDecl("State", [{ name: "A" }]);
      const member = createMockScopeMember({ enumDecl: enumDecl });
      const ctx = createMockScopeContext("Test", [member]);
      const state = createMockState({ selfIncludeAdded: true });

      const result = generateScope(
        ctx,
        createMockInput(),
        state,
        createMockOrchestrator(),
      );

      expect(result.code).not.toContain("typedef enum");
      expect(definesInHeader).toHaveBeenCalledWith(
        expect.anything(),
        "test.cnx",
        "Test__State",
      );
      definesInHeader.mockRestore();
      CodeGenState.sourcePath = null;
    });

    it("emits enum into the .c when the header does NOT define it (#1300)", () => {
      // A PRIVATE scope type leaves the header but must still be defined
      // somewhere, or the `.c` that uses it does not compile. The two
      // placements are complements of one decision, so this is the other half
      // of the test above -- and the half that was missing while the gate read
      // the file-level `selfIncludeAdded` instead of asking the header.
      CodeGenState.sourcePath = "test.cnx";
      const definesInHeader = vi
        .spyOn(PublicInterface, "definesTypeInHeader")
        .mockReturnValue(false);
      const enumDecl = createMockEnumDecl("State", [{ name: "A" }]);
      const member = createMockScopeMember({ enumDecl: enumDecl });
      const ctx = createMockScopeContext("Test", [member]);
      const state = createMockState({ selfIncludeAdded: true });
      const input = createMockInput({
        symbols: {
          ...createMockInput().symbols!,
          enumMembers: new Map([["Test__State", new Map([["A", 0]])]]),
        },
      } as Partial<IGeneratorInput>);

      const result = generateScope(ctx, input, state, createMockOrchestrator());

      expect(result.code).toContain("typedef enum");
      definesInHeader.mockRestore();
      CodeGenState.sourcePath = null;
    });
  });

  // ========================================================================
  // Bitmap declarations (ADR-034)
  // ========================================================================

  describe("bitmap declarations (ADR-034)", () => {
    it("generates scoped bitmap with symbol info", () => {
      const bitmapDecl = createMockBitmapDecl("Flags", "bitmap8", [
        { name: "enabled", width: 1 },
        { name: "mode", width: 3 },
      ]);
      const member = createMockScopeMember({ bitmapDecl: bitmapDecl });
      const ctx = createMockScopeContext("Config", [member]);
      const input = createMockInput({
        symbols: {
          ...createMockInput().symbols!,
          bitmapBackingType: new Map([["Config__Flags", "uint8_t"]]),
          bitmapFields: new Map([
            [
              "Config__Flags",
              new Map([
                ["enabled", { offset: 0, width: 1 }],
                ["mode", { offset: 1, width: 3 }],
              ]),
            ],
          ]),
        },
      } as Partial<IGeneratorInput>);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      // #1300: one emitter, so the .c carries the HEADER's comment block --
      // codegen's own `/* Bitmap: X */` + `/* Fields: */` form is gone.
      expect(result.code).toContain("/* Bitmap: Config__Flags");
      expect(result.code).toContain("enabled: bit 0");
      expect(result.code).toContain("mode: bits 1-3 (3 bits)");
      expect(result.code).toContain("typedef uint8_t Config__Flags;");
    });

    it("skips bitmap when the header defines it (#369, #1300)", () => {
      CodeGenState.sourcePath = "test.cnx";
      const definesInHeader = vi
        .spyOn(PublicInterface, "definesTypeInHeader")
        .mockReturnValue(true);
      const bitmapDecl = createMockBitmapDecl("Flags", "bitmap8", []);
      const member = createMockScopeMember({ bitmapDecl: bitmapDecl });
      const ctx = createMockScopeContext("Test", [member]);
      const state = createMockState({ selfIncludeAdded: true });

      const result = generateScope(
        ctx,
        createMockInput(),
        state,
        createMockOrchestrator(),
      );

      expect(result.code).not.toContain("Bitmap:");
      expect(definesInHeader).toHaveBeenCalledWith(
        expect.anything(),
        "test.cnx",
        "Test__Flags",
      );
      definesInHeader.mockRestore();
      CodeGenState.sourcePath = null;
    });

    it("emits bitmap into the .c when the header does NOT define it (#1300)", () => {
      // A PRIVATE scope type leaves the header but must still be defined
      // somewhere, or the `.c` that uses it does not compile. The two
      // placements are complements of one decision, so this is the other half
      // of the test above -- and the half that was missing while the gate read
      // the file-level `selfIncludeAdded` instead of asking the header.
      CodeGenState.sourcePath = "test.cnx";
      const definesInHeader = vi
        .spyOn(PublicInterface, "definesTypeInHeader")
        .mockReturnValue(false);
      const bitmapDecl = createMockBitmapDecl("Flags", "bitmap8", []);
      const member = createMockScopeMember({ bitmapDecl: bitmapDecl });
      const ctx = createMockScopeContext("Test", [member]);
      const state = createMockState({ selfIncludeAdded: true });

      const result = generateScope(
        ctx,
        createMockInput(),
        state,
        createMockOrchestrator(),
      );

      expect(result.code).toContain("Bitmap:");
      definesInHeader.mockRestore();
      CodeGenState.sourcePath = null;
    });
  });

  // ========================================================================
  // Struct declarations
  // ========================================================================

  describe("struct declarations", () => {
    it("generates scoped struct with fields", () => {
      const structDecl = createMockStructDecl("Point", [
        { name: "x", type: "i32" },
        { name: "y", type: "i32" },
      ]);
      const member = createMockScopeMember({ structDecl: structDecl });
      const ctx = createMockScopeContext("Graphics", [member]);
      // #1300: the .c reads fields from symbols, the same map the header reads.
      // Field FORMATTING is generateStructHeader's own test file's job now.
      const input = createMockInput({
        symbols: {
          ...createMockInput().symbols!,
          structFields: new Map([
            [
              "Graphics__Point",
              new Map([
                ["x", "i32"],
                ["y", "i32"],
              ]),
            ],
          ]),
        },
      } as Partial<IGeneratorInput>);
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("typedef struct Graphics__Point {");
      expect(result.code).toContain("int32_t x;");
      expect(result.code).toContain("int32_t y;");
      expect(result.code).toContain("} Graphics__Point;");
    });

    it("skips struct when the header defines it (#369, #1300)", () => {
      CodeGenState.sourcePath = "test.cnx";
      const definesInHeader = vi
        .spyOn(PublicInterface, "definesTypeInHeader")
        .mockReturnValue(true);
      const structDecl = createMockStructDecl("Data", [
        { name: "value", type: "u32" },
      ]);
      const member = createMockScopeMember({ structDecl: structDecl });
      const ctx = createMockScopeContext("Test", [member]);
      const state = createMockState({ selfIncludeAdded: true });

      const result = generateScope(
        ctx,
        createMockInput(),
        state,
        createMockOrchestrator(),
      );

      expect(result.code).not.toContain("typedef struct");
      expect(definesInHeader).toHaveBeenCalledWith(
        expect.anything(),
        "test.cnx",
        "Test__Data",
      );
      definesInHeader.mockRestore();
      CodeGenState.sourcePath = null;
    });

    it("emits struct into the .c when the header does NOT define it (#1300)", () => {
      // A PRIVATE scope type leaves the header but must still be defined
      // somewhere, or the `.c` that uses it does not compile. The two
      // placements are complements of one decision, so this is the other half
      // of the test above -- and the half that was missing while the gate read
      // the file-level `selfIncludeAdded` instead of asking the header.
      CodeGenState.sourcePath = "test.cnx";
      const definesInHeader = vi
        .spyOn(PublicInterface, "definesTypeInHeader")
        .mockReturnValue(false);
      const structDecl = createMockStructDecl("Data", [
        { name: "value", type: "u32" },
      ]);
      const member = createMockScopeMember({ structDecl: structDecl });
      const ctx = createMockScopeContext("Test", [member]);
      const state = createMockState({ selfIncludeAdded: true });

      const result = generateScope(
        ctx,
        createMockInput(),
        state,
        createMockOrchestrator(),
      );

      expect(result.code).toContain("typedef struct");
      definesInHeader.mockRestore();
      CodeGenState.sourcePath = null;
    });
  });

  // ========================================================================
  // Register declarations
  // ========================================================================

  describe("register declarations", () => {
    it("generates scoped register with members", () => {
      const regDecl = createMockRegisterDecl("GPIO", "0x40000000", [
        { name: "DATA", type: "u32", access: "rw", offset: "0x00" },
      ]);
      const member = createMockScopeMember({ registerDecl: regDecl });
      const ctx = createMockScopeContext("HAL", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("/* Register: HAL__GPIO");
      expect(result.code).toContain("#define HAL__GPIO__DATA");
    });
  });

  // ========================================================================
  // Multiple members
  // ========================================================================

  describe("multiple members", () => {
    it("generates scope with mixed member types", () => {
      const varDecl = createMockVariableDecl({
        name: "count",
        type: "u32",
        initialValue: "0",
      });
      const funcDecl = createMockFunctionDecl({
        name: "increment",
        returnType: "void",
      });
      const varMember = createMockScopeMember({ variableDecl: varDecl });
      const funcMember = createMockScopeMember({
        visibility: "public",
        functionDecl: funcDecl,
      });
      const ctx = createMockScopeContext("Counter", [varMember, funcMember]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("/* Scope: Counter */");
      expect(result.code).toContain("static uint32_t Counter__count = 0;");
      expect(result.code).toContain("void Counter__increment(void) { }");
    });
  });
});
