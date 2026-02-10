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
 */
function createMockArrayType(sizeExpr?: string | null) {
  if (sizeExpr === null) {
    // Empty brackets - no expression
    return {
      expression: () => null,
    };
  }
  return {
    expression: () =>
      sizeExpr
        ? {
            getText: () => sizeExpr,
            __mockValue: sizeExpr,
          }
        : null,
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
  return {
    currentScope: null,
    indentLevel: 0,
    inFunctionBody: false,
    currentParameters: new Map(),
    localVariables: new Set(),
    localArrays: new Set(),
    expectedType: null,
    selfIncludeAdded: false,
    scopeMembers: new Map(),
    mainArgsName: null,
    floatBitShadows: new Set(),
    floatShadowCurrent: new Set(),
    lengthCache: null,
    ...overrides,
  };
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
    generateCallbackTypedef: vi.fn(() => null),
    isConstValue: vi.fn(() => true),
    tryEvaluateConstant: vi.fn(() => undefined),
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

      expect(result.code).toContain("static uint32_t Stats_counter = 0;");
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

      expect(result.code).toContain("uint16_t API_value = 100;");
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

      expect(result.code).toContain("const uint8_t App_VERSION = 1;");
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
        "static const uint8_t Data_LOOKUP[10] = {0};",
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

      expect(result.code).toContain("static uint8_t Serial_buffer[256] = {0};");
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

      expect(result.code).toContain("static u16[8] Buffer_data[8] = {0};");
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
        "static u16[BUFFER_SIZE] Storage_items[BUFFER_SIZE] = {0};",
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

      expect(result.code).toContain("static u8[] Dynamic_flexible[] = {0};");
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
        "static string<32> Logger_message[33] = 0;",
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

      expect(result.code).toContain("static uint32_t Device_status = 0;");
      expect(orchestrator.getZeroInitializer).toHaveBeenCalled();
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
        "static Sensor HW_sensor(HW_PIN, HW_RATE);",
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

      expect(result.code).toContain("Device App_device(App_CONFIG);");
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
      const member = createMockScopeMember({ functionDecl: funcDecl });
      const ctx = createMockScopeContext("Utils", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("static void Utils_helper(void) { }");
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

      expect(result.code).toContain("void Motor_init(void) { }");
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
        "uint32_t Data_process(uint8_t* data, uint32_t len) { }",
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
        "Test_test",
      );
      expect(orchestrator.setParameters).toHaveBeenCalled();
      expect(orchestrator.enterFunctionBody).toHaveBeenCalled();
      expect(orchestrator.generateBlock).toHaveBeenCalled();
      expect(orchestrator.updateFunctionParamsAutoConst).toHaveBeenCalledWith(
        "Test_test",
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
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        isCallbackTypeUsedAsFieldType: vi.fn(() => true),
        generateCallbackTypedef: vi.fn(
          () => "typedef void (*Events_callback_t)(void);",
        ),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("typedef void (*Events_callback_t)(void);");
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
              "Machine_Status",
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
      expect(result.code).toContain("Machine_Status_IDLE = 0,");
      expect(result.code).toContain("Machine_Status_RUNNING = 1");
      expect(result.code).toContain("} Machine_Status;");
    });

    it("generates scoped enum with AST fallback", () => {
      const enumDecl = createMockEnumDecl("Level", [
        { name: "LOW" },
        { name: "MEDIUM" },
        { name: "HIGH" },
      ]);
      const member = createMockScopeMember({ enumDecl: enumDecl });
      const ctx = createMockScopeContext("Audio", [member]);
      const input = createMockInput(); // No symbol info
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("Audio_Level_LOW = 0,");
      expect(result.code).toContain("Audio_Level_MEDIUM = 1,");
      expect(result.code).toContain("Audio_Level_HIGH = 2");
    });

    it("skips enum when selfIncludeAdded (Issue #369)", () => {
      const enumDecl = createMockEnumDecl("State", [{ name: "A" }]);
      const member = createMockScopeMember({ enumDecl: enumDecl });
      const ctx = createMockScopeContext("Test", [member]);
      const input = createMockInput();
      const state = createMockState({ selfIncludeAdded: true });
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).not.toContain("typedef enum");
    });

    it("generates enum with explicit values using AST fallback", () => {
      const enumDecl = createMockEnumDecl("ErrorCode", [
        { name: "OK", value: "0" },
        { name: "WARNING", value: "100" },
        { name: "ERROR", value: "200" },
      ]);
      const member = createMockScopeMember({ enumDecl: enumDecl });
      const ctx = createMockScopeContext("System", [member]);
      const input = createMockInput(); // No symbol info - uses AST fallback
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        tryEvaluateConstant: vi.fn((expr) => {
          const value = expr.__mockValue;
          return value ? Number.parseInt(value, 10) : undefined;
        }),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("System_ErrorCode_OK = 0,");
      expect(result.code).toContain("System_ErrorCode_WARNING = 100,");
      expect(result.code).toContain("System_ErrorCode_ERROR = 200");
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
          bitmapBackingType: new Map([["Config_Flags", "uint8_t"]]),
          bitmapFields: new Map([
            [
              "Config_Flags",
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

      expect(result.code).toContain("/* Bitmap: Config_Flags */");
      expect(result.code).toContain("enabled: bit 0 (1 bit)");
      expect(result.code).toContain("mode: bits 1-3 (3 bits)");
      expect(result.code).toContain("typedef uint8_t Config_Flags;");
    });

    it("generates scoped bitmap with AST fallback", () => {
      const bitmapDecl = createMockBitmapDecl("Status", "bitmap16", [
        { name: "ready", width: 1 },
        { name: "error", width: 1 },
      ]);
      const member = createMockScopeMember({ bitmapDecl: bitmapDecl });
      const ctx = createMockScopeContext("Device", [member]);
      const input = createMockInput(); // No symbol info
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("typedef uint16_t Device_Status;");
    });

    it("generates bitmap8/16/32/64 with correct backing type", () => {
      const testCases = [
        { keyword: "bitmap8", expected: "uint8_t" },
        { keyword: "bitmap16", expected: "uint16_t" },
        { keyword: "bitmap32", expected: "uint32_t" },
        { keyword: "bitmap64", expected: "uint64_t" },
      ];

      for (const { keyword, expected } of testCases) {
        const bitmapDecl = createMockBitmapDecl("Test", keyword, []);
        const member = createMockScopeMember({ bitmapDecl: bitmapDecl });
        const ctx = createMockScopeContext("Scope", [member]);
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateScope(ctx, input, state, orchestrator);

        expect(result.code).toContain(`typedef ${expected} Scope_Test;`);
      }
    });

    it("skips bitmap when selfIncludeAdded (Issue #369)", () => {
      const bitmapDecl = createMockBitmapDecl("Flags", "bitmap8", []);
      const member = createMockScopeMember({ bitmapDecl: bitmapDecl });
      const ctx = createMockScopeContext("Test", [member]);
      const input = createMockInput();
      const state = createMockState({ selfIncludeAdded: true });
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).not.toContain("Bitmap:");
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
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("typedef struct Graphics_Point {");
      expect(result.code).toContain("int32_t x;");
      expect(result.code).toContain("int32_t y;");
      expect(result.code).toContain("} Graphics_Point;");
    });

    it("generates struct field with array dimensions", () => {
      const structDecl = createMockStructDecl("Buffer", [
        { name: "data", type: "u8", arrayDims: ["256"] },
      ]);
      const member = createMockScopeMember({ structDecl: structDecl });
      const ctx = createMockScopeContext("IO", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("uint8_t data[256];");
    });

    it("generates struct field with C-Next array type constant size", () => {
      const structDecl = createMockStructDecl("Container", [
        { name: "items", type: "u16[4]", arrayTypeSize: "4" },
      ]);
      const member = createMockScopeMember({ structDecl: structDecl });
      const ctx = createMockScopeContext("Data", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        tryEvaluateConstant: vi.fn(() => 4),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("u16[4] items[4];");
    });

    it("generates struct field with C-Next array type non-constant (fallback)", () => {
      const structDecl = createMockStructDecl("FlexContainer", [
        { name: "buffer", type: "u8[MAX_SIZE]", arrayTypeSize: "MAX_SIZE" },
      ]);
      const member = createMockScopeMember({ structDecl: structDecl });
      const ctx = createMockScopeContext("Flex", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        ...createMockOrchestrator(),
        tryEvaluateConstant: vi.fn(() => undefined), // Can't resolve macro
        generateExpression: vi.fn(() => "MAX_SIZE"),
      });

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("u8[MAX_SIZE] buffer[MAX_SIZE];");
    });

    it("generates struct field with C-Next array type no size (empty brackets)", () => {
      const structDecl = createMockStructDecl("DynamicContainer", [
        { name: "data", type: "u8[]", arrayTypeSize: null },
      ]);
      const member = createMockScopeMember({ structDecl: structDecl });
      const ctx = createMockScopeContext("Dyn", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).toContain("u8[] data[];");
    });

    it("generates struct field with string capacity", () => {
      const structDecl = createMockStructDecl("Message", [
        { name: "text", type: "string<64>", hasStringType: true },
      ]);
      const member = createMockScopeMember({ structDecl: structDecl });
      const ctx = createMockScopeContext("Log", [member]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      // Capacity + 1 for null terminator
      expect(result.code).toContain("string<64> text[33];");
    });

    it("skips struct when selfIncludeAdded (Issue #369)", () => {
      const structDecl = createMockStructDecl("Data", [
        { name: "value", type: "u32" },
      ]);
      const member = createMockScopeMember({ structDecl: structDecl });
      const ctx = createMockScopeContext("Test", [member]);
      const input = createMockInput();
      const state = createMockState({ selfIncludeAdded: true });
      const orchestrator = createMockOrchestrator();

      const result = generateScope(ctx, input, state, orchestrator);

      expect(result.code).not.toContain("typedef struct");
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

      expect(result.code).toContain("/* Register: HAL_GPIO");
      expect(result.code).toContain("#define HAL_GPIO_DATA");
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
      expect(result.code).toContain("static uint32_t Counter_count = 0;");
      expect(result.code).toContain("void Counter_increment(void) { }");
    });
  });
});
