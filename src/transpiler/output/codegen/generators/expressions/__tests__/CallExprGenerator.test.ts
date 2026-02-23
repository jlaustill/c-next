import { describe, it, expect, vi, beforeEach } from "vitest";
import generateFunctionCall from "../CallExprGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";
import CodeGenState from "../../../../../state/CodeGenState";
import TTypeInfo from "../../../types/TTypeInfo";

// ========================================================================
// Test Helpers
// ========================================================================

function createMockExpressionContext(text: string): Parser.ExpressionContext {
  return {
    getText: () => text,
  } as unknown as Parser.ExpressionContext;
}

function createMockArgListContext(
  expressions: Parser.ExpressionContext[],
): Parser.ArgumentListContext {
  return {
    expression: () => expressions,
  } as unknown as Parser.ArgumentListContext;
}

function createMockInput(
  overrides: Partial<IGeneratorInput> = {},
): IGeneratorInput {
  // Also populate CodeGenState with the type registry entries
  // This is needed because CallExprGenerator now uses CodeGenState directly
  const typeRegistry =
    (overrides.typeRegistry as Map<string, TTypeInfo>) ?? new Map();
  for (const [name, info] of typeRegistry) {
    CodeGenState.setVariableTypeInfo(name, info);
  }

  return {
    symbols: null,
    symbolTable: null,
    typeRegistry,
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

function createMockState(): IGeneratorState {
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
  };
}

function createMockOrchestrator(
  overrides: Partial<IOrchestrator> = {},
): IOrchestrator {
  return {
    generateExpression: vi.fn((ctx: Parser.ExpressionContext) => ctx.getText()),
    generateFunctionArg: vi.fn(
      (ctx: Parser.ExpressionContext) => `&${ctx.getText()}`,
    ),
    getSimpleIdentifier: vi.fn((ctx: Parser.ExpressionContext) =>
      ctx.getText(),
    ),
    isCNextFunction: vi.fn(() => false),
    isConstValue: vi.fn(() => false),
    isFloatType: vi.fn(() => false),
    isIntegerType: vi.fn(() => false),
    isStructType: vi.fn(() => false),
    isCppMode: vi.fn(() => false),
    isCppEnumClass: vi.fn(() => false),
    getExpressionType: vi.fn(() => null),
    getKnownEnums: vi.fn(() => new Set<string>()),
    isParameterPassByValue: vi.fn(() => false),
    isCurrentParameter: vi.fn(() => false),
    isCalleeParameterModified: vi.fn(() => false),
    markParameterModified: vi.fn(),
    ...overrides,
  } as unknown as IOrchestrator;
}

// ========================================================================
// Tests
// ========================================================================

describe("CallExprGenerator", () => {
  // Reset CodeGenState before each test to avoid state pollution
  beforeEach(() => {
    CodeGenState.reset();
  });

  describe("empty function call", () => {
    it("generates call with no arguments when argCtx is null", () => {
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateFunctionCall(
        "myFunc",
        null,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("myFunc()");
      expect(result.effects).toEqual([]);
    });
  });

  describe("C function calls (not C-Next)", () => {
    it("generates pass-by-value arguments for C functions", () => {
      const argExprs = [
        createMockExpressionContext("x"),
        createMockExpressionContext("y"),
      ];
      const argCtx = createMockArgListContext(argExprs);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "printf",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("printf(x, y)");
    });

    it("auto-adds & for struct arguments passed to pointer parameters", () => {
      const argExprs = [createMockExpressionContext("myStruct")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "c_func",
          {
            name: "c_func",
            parameters: [
              {
                name: "p",
                baseType: "MyStruct*",
                isConst: false,
                isArray: false,
              },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getExpressionType: vi.fn(() => "MyStruct"),
        isStructType: vi.fn(() => true),
      });

      const result = generateFunctionCall(
        "c_func",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(&myStruct)");
    });

    it("does not add & if argument already has & prefix", () => {
      const argExprs = [createMockExpressionContext("myStruct")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "c_func",
          {
            name: "c_func",
            parameters: [
              {
                name: "p",
                baseType: "MyStruct*",
                isConst: false,
                isArray: false,
              },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        generateExpression: vi.fn(() => "&myStruct"),
        getExpressionType: vi.fn(() => "MyStruct"),
        isStructType: vi.fn(() => true),
      });

      const result = generateFunctionCall(
        "c_func",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(&myStruct)");
    });

    it("does not add & if argument is an array parameter", () => {
      const argExprs = [createMockExpressionContext("arr")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "c_func",
          {
            name: "c_func",
            parameters: [
              { name: "p", baseType: "u8*", isConst: false, isArray: true },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getExpressionType: vi.fn(() => "u8"),
        isStructType: vi.fn(() => true),
      });

      const result = generateFunctionCall(
        "c_func",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(arr)");
    });

    it("does not add & if argument type is already a pointer", () => {
      const argExprs = [createMockExpressionContext("ptr")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "c_func",
          {
            name: "c_func",
            parameters: [
              {
                name: "p",
                baseType: "MyStruct*",
                isConst: false,
                isArray: false,
              },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getExpressionType: vi.fn(() => "MyStruct*"),
        isStructType: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "c_func",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(ptr)");
    });

    it("falls back to type registry when getExpressionType returns null", () => {
      const argExprs = [createMockExpressionContext("ConfigManager_config")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "c_func",
          {
            name: "c_func",
            parameters: [
              {
                name: "p",
                baseType: "Config*",
                isConst: false,
                isArray: false,
              },
            ],
          },
        ],
      ]);
      const typeRegistry = new Map([
        [
          "ConfigManager_config",
          { baseType: "Config", bitWidth: 0, isArray: false, isConst: false },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getExpressionType: vi.fn(() => null),
        isStructType: vi.fn(() => true),
      });

      const result = generateFunctionCall(
        "c_func",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(&ConfigManager_config)");
    });

    it("does not add & when type registry lookup also returns null", () => {
      const argExprs = [createMockExpressionContext("unknown")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "c_func",
          {
            name: "c_func",
            parameters: [
              {
                name: "p",
                baseType: "MyStruct*",
                isConst: false,
                isArray: false,
              },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getExpressionType: vi.fn(() => null),
      });

      const result = generateFunctionCall(
        "c_func",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(unknown)");
    });

    it("Issue #937: passes callback-promoted params directly to pointer-expecting C functions", () => {
      // When a C-Next param matches a callback typedef (e.g., u8 buf -> uint8_t* buf),
      // and it's passed to a C function expecting a pointer, use identifier directly
      const argExprs = [createMockExpressionContext("buf")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "draw_bitmap",
          {
            name: "draw_bitmap",
            parameters: [
              {
                name: "data",
                baseType: "const void*",
                isConst: true,
                isArray: false,
              },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();

      // Set up CodeGenState.currentParameters to simulate callback-promoted param
      CodeGenState.currentParameters.set("buf", {
        name: "buf",
        baseType: "u8",
        isArray: false,
        isStruct: false,
        isConst: false,
        isCallback: false,
        isString: false,
        forcePointerSemantics: true, // Callback-promoted param
      });

      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getSimpleIdentifier: vi.fn(() => "buf"),
        // generateExpression would return (*buf) if called, but we bypass it
        generateExpression: vi.fn(() => "(*buf)"),
        getExpressionType: vi.fn(() => "u8"),
        isStructType: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "draw_bitmap",
        argCtx,
        input,
        state,
        orchestrator,
      );

      // Should pass buf directly, NOT (*buf) or &(*buf)
      expect(result.code).toBe("draw_bitmap(buf)");

      // Clean up
      CodeGenState.currentParameters.clear();
    });
  });

  describe("C++ enum class static_cast", () => {
    it("wraps enum class argument with static_cast for integer parameter", () => {
      const argExprs = [createMockExpressionContext("MyEnum::Value")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "c_func",
          {
            name: "c_func",
            parameters: [
              { name: "p", baseType: "u32", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        isCppMode: vi.fn(() => true),
        isCppEnumClass: vi.fn(() => true),
        isIntegerType: vi.fn(() => true),
        getExpressionType: vi.fn(() => "MyEnum"),
      });

      const result = generateFunctionCall(
        "c_func",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(static_cast<uint32_t>(MyEnum::Value))");
    });

    it("does not wrap when not in C++ mode", () => {
      const argExprs = [createMockExpressionContext("val")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "c_func",
          {
            name: "c_func",
            parameters: [
              { name: "p", baseType: "u32", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        isCppMode: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "c_func",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(val)");
    });

    it("does not wrap when argument is not an enum class", () => {
      const argExprs = [createMockExpressionContext("val")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "c_func",
          {
            name: "c_func",
            parameters: [
              { name: "p", baseType: "u32", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        isCppMode: vi.fn(() => true),
        getExpressionType: vi.fn(() => "u32"),
        isCppEnumClass: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "c_func",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(val)");
    });

    it("does not wrap when target parameter is not an integer type", () => {
      const argExprs = [createMockExpressionContext("val")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "c_func",
          {
            name: "c_func",
            parameters: [
              {
                name: "p",
                baseType: "MyStruct",
                isConst: false,
                isArray: false,
              },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        isCppMode: vi.fn(() => true),
        getExpressionType: vi.fn(() => "MyEnum"),
        isCppEnumClass: vi.fn(() => true),
        isIntegerType: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "c_func",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(val)");
    });

    it("does not wrap when expression type is null", () => {
      const argExprs = [createMockExpressionContext("val")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "c_func",
          {
            name: "c_func",
            parameters: [
              { name: "p", baseType: "u32", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        isCppMode: vi.fn(() => true),
        getExpressionType: vi.fn(() => null),
      });

      const result = generateFunctionCall(
        "c_func",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(val)");
    });
  });

  describe("C-Next function calls", () => {
    it("passes struct arguments by reference", () => {
      const argExprs = [createMockExpressionContext("myVal")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "doWork",
          {
            name: "doWork",
            parameters: [
              { name: "val", baseType: "u32", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isFloatType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "doWork",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("doWork(&myVal)");
    });

    it("passes float parameters by value", () => {
      const argExprs = [createMockExpressionContext("temperature")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "setTemp",
          {
            name: "setTemp",
            parameters: [
              { name: "temp", baseType: "f32", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isFloatType: vi.fn(() => true),
        isParameterPassByValue: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "setTemp",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("setTemp(temperature)");
    });

    it("passes enum parameters by value", () => {
      const argExprs = [createMockExpressionContext("STATE_ON")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "setState",
          {
            name: "setState",
            parameters: [
              { name: "s", baseType: "State", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const knownEnums = new Set(["State"]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isFloatType: vi.fn(() => false),
        getKnownEnums: vi.fn(() => knownEnums),
        isParameterPassByValue: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "setState",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("setState(STATE_ON)");
    });

    it("passes small primitive parameters by value (Issue #269)", () => {
      const argExprs = [createMockExpressionContext("flag")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "setFlag",
          {
            name: "setFlag",
            parameters: [
              { name: "f", baseType: "u8", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isFloatType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => true),
      });

      const result = generateFunctionCall(
        "setFlag",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("setFlag(flag)");
    });

    it("passes unknown types by value (Issue #551)", () => {
      const argExprs = [createMockExpressionContext("extVal")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "process",
          {
            name: "process",
            parameters: [
              {
                name: "v",
                baseType: "ExternalTypedef",
                isConst: false,
                isArray: false,
              },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isFloatType: vi.fn(() => false),
        isStructType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "process",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("process(extVal)");
    });

    it("wraps C++ enum class with static_cast for C-Next pass-by-value", () => {
      const argExprs = [createMockExpressionContext("MyEnum::Val")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "doWork",
          {
            name: "doWork",
            parameters: [
              { name: "v", baseType: "u32", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isFloatType: vi.fn(() => true),
        isCppMode: vi.fn(() => true),
        isCppEnumClass: vi.fn(() => true),
        isIntegerType: vi.fn(() => true),
        getExpressionType: vi.fn(() => "MyEnum"),
        isParameterPassByValue: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "doWork",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("doWork(static_cast<uint32_t>(MyEnum::Val))");
    });
  });

  describe("cross-file function calls (Issue #315)", () => {
    it("looks up parameter info from SymbolTable and passes primitives by value (Issue #786)", () => {
      const argExprs = [createMockExpressionContext("myVal")];
      const argCtx = createMockArgListContext(argExprs);
      const symbolTable = {
        getOverloads: vi.fn(() => [
          {
            kind: "function",
            parameters: [
              { name: "val", type: "u32", isConst: false, isArray: false },
            ],
          },
        ]),
      };
      const input = createMockInput({
        symbolTable: symbolTable as any,
      });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isFloatType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
        isStructType: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "crossFileFunc",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(symbolTable.getOverloads).toHaveBeenCalledWith("crossFileFunc");
      // Issue #786: Primitive types like u32 are now passed by value for cross-file calls
      expect(result.code).toBe("crossFileFunc(myVal)");
    });

    it("passes small primitive by value for cross-file functions", () => {
      const argExprs = [createMockExpressionContext("flag")];
      const argCtx = createMockArgListContext(argExprs);
      const symbolTable = {
        getOverloads: vi.fn(() => [
          {
            kind: "function",
            parameters: [
              { name: "f", type: "u8", isConst: false, isArray: false },
            ],
          },
        ]),
      };
      const input = createMockInput({
        symbolTable: symbolTable as any,
      });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isFloatType: vi.fn(() => false),
        isStructType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "crossFileFunc",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("crossFileFunc(flag)");
    });

    it("skips non-function symbols in SymbolTable overloads", () => {
      const argExprs = [createMockExpressionContext("val")];
      const argCtx = createMockArgListContext(argExprs);
      const symbolTable = {
        getOverloads: vi.fn(() => [
          { kind: "variable", parameters: undefined },
        ]),
      };
      const input = createMockInput({
        symbolTable: symbolTable as any,
      });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isFloatType: vi.fn(() => false),
        isStructType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "unknownFunc",
        argCtx,
        input,
        state,
        orchestrator,
      );

      // No param info found, falls through to pass-by-reference (no targetParam)
      expect(result.code).toBe("unknownFunc(&val)");
    });
  });

  describe("safe_div and safe_mod (ADR-051)", () => {
    it("generates safe_div call with correct helper name and effects", () => {
      const argExprs = [
        createMockExpressionContext("result"),
        createMockExpressionContext("a"),
        createMockExpressionContext("b"),
        createMockExpressionContext("0"),
      ];
      const argCtx = createMockArgListContext(argExprs);
      const typeRegistry = new Map([
        [
          "result",
          { baseType: "u32", bitWidth: 32, isArray: false, isConst: false },
        ],
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getSimpleIdentifier: vi.fn((ctx: Parser.ExpressionContext) =>
          ctx.getText(),
        ),
      });

      const result = generateFunctionCall(
        "safe_div",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("cnx_safe_div_u32(&result, a, b, 0)");
      expect(result.effects).toEqual([
        { type: "safe-div", operation: "div", cnxType: "u32" },
      ]);
    });

    it("generates safe_mod call with correct helper name and effects", () => {
      const argExprs = [
        createMockExpressionContext("out"),
        createMockExpressionContext("x"),
        createMockExpressionContext("y"),
        createMockExpressionContext("1"),
      ];
      const argCtx = createMockArgListContext(argExprs);
      const typeRegistry = new Map([
        [
          "out",
          { baseType: "i64", bitWidth: 64, isArray: false, isConst: false },
        ],
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getSimpleIdentifier: vi.fn((ctx: Parser.ExpressionContext) =>
          ctx.getText(),
        ),
      });

      const result = generateFunctionCall(
        "safe_mod",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("cnx_safe_mod_i64(&out, x, y, 1)");
      expect(result.effects).toEqual([
        { type: "safe-div", operation: "mod", cnxType: "i64" },
      ]);
    });

    it("throws error when safe_div has wrong number of arguments", () => {
      const argExprs = [
        createMockExpressionContext("a"),
        createMockExpressionContext("b"),
      ];
      const argCtx = createMockArgListContext(argExprs);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
      });

      expect(() =>
        generateFunctionCall("safe_div", argCtx, input, state, orchestrator),
      ).toThrow(
        "safe_div requires exactly 4 arguments: output, numerator, divisor, defaultValue",
      );
    });

    it("throws error when safe_mod has wrong number of arguments", () => {
      const argExprs = [createMockExpressionContext("a")];
      const argCtx = createMockArgListContext(argExprs);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
      });

      expect(() =>
        generateFunctionCall("safe_mod", argCtx, input, state, orchestrator),
      ).toThrow(
        "safe_mod requires exactly 4 arguments: output, numerator, divisor, defaultValue",
      );
    });

    it("throws error when first argument is not a simple identifier", () => {
      const argExprs = [
        createMockExpressionContext("a + b"),
        createMockExpressionContext("x"),
        createMockExpressionContext("y"),
        createMockExpressionContext("0"),
      ];
      const argCtx = createMockArgListContext(argExprs);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getSimpleIdentifier: vi.fn(() => null),
      });

      expect(() =>
        generateFunctionCall("safe_div", argCtx, input, state, orchestrator),
      ).toThrow(
        "safe_div requires a variable as the first argument (output parameter)",
      );
    });

    it("throws error when output parameter type cannot be determined", () => {
      const argExprs = [
        createMockExpressionContext("unknownVar"),
        createMockExpressionContext("a"),
        createMockExpressionContext("b"),
        createMockExpressionContext("0"),
      ];
      const argCtx = createMockArgListContext(argExprs);
      const input = createMockInput(); // empty typeRegistry
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getSimpleIdentifier: vi.fn(() => "unknownVar"),
      });

      expect(() =>
        generateFunctionCall("safe_div", argCtx, input, state, orchestrator),
      ).toThrow(
        "Cannot determine type of output parameter 'unknownVar' for safe_div",
      );
    });

    it("throws error when output parameter has no baseType", () => {
      const argExprs = [
        createMockExpressionContext("noType"),
        createMockExpressionContext("a"),
        createMockExpressionContext("b"),
        createMockExpressionContext("0"),
      ];
      const argCtx = createMockArgListContext(argExprs);
      const typeRegistry = new Map([
        [
          "noType",
          { baseType: "", bitWidth: 0, isArray: false, isConst: false },
        ],
      ]);
      const input = createMockInput({ typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getSimpleIdentifier: vi.fn(() => "noType"),
      });

      expect(() =>
        generateFunctionCall("safe_div", argCtx, input, state, orchestrator),
      ).toThrow("Output parameter 'noType' has no C-Next type for safe_div");
    });
  });

  describe("const-to-non-const validation (ADR-013)", () => {
    it("throws error when const value passed to non-const parameter", () => {
      const argExprs = [createMockExpressionContext("MY_CONST")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "modify",
          {
            name: "modify",
            parameters: [
              { name: "val", baseType: "u32", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isConstValue: vi.fn(() => true),
        getSimpleIdentifier: vi.fn(() => "MY_CONST"),
      });

      expect(() =>
        generateFunctionCall("modify", argCtx, input, state, orchestrator),
      ).toThrow(
        "cannot pass const 'MY_CONST' to non-const parameter 'val' of function 'modify'",
      );
    });

    it("allows const value passed to const parameter", () => {
      const argExprs = [createMockExpressionContext("MY_CONST")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "readOnly",
          {
            name: "readOnly",
            parameters: [
              { name: "val", baseType: "u32", isConst: true, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isConstValue: vi.fn(() => true),
        isFloatType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      // Should not throw
      const result = generateFunctionCall(
        "readOnly",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("readOnly(");
    });

    it("skips validation when no function signature exists", () => {
      const argExprs = [createMockExpressionContext("val")];
      const argCtx = createMockArgListContext(argExprs);
      const input = createMockInput(); // no signatures
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isConstValue: vi.fn(() => true),
        isFloatType: vi.fn(() => false),
        isStructType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      // Should not throw
      const result = generateFunctionCall(
        "unknownFunc",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("unknownFunc(");
    });
  });

  describe("pass-through modification tracking (Issue #268)", () => {
    it("marks parameter as modified when callee modifies it", () => {
      const argExprs = [createMockExpressionContext("myParam")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "callee",
          {
            name: "callee",
            parameters: [
              { name: "p", baseType: "u32", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const markParameterModified = vi.fn();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isCurrentParameter: vi.fn(() => true),
        isCalleeParameterModified: vi.fn(() => true),
        markParameterModified,
        isFloatType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      generateFunctionCall("callee", argCtx, input, state, orchestrator);

      expect(markParameterModified).toHaveBeenCalledWith("myParam");
    });

    it("does not mark when argument is not a current parameter", () => {
      const argExprs = [createMockExpressionContext("localVar")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "callee",
          {
            name: "callee",
            parameters: [
              { name: "p", baseType: "u32", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const markParameterModified = vi.fn();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isCurrentParameter: vi.fn(() => false),
        markParameterModified,
        isFloatType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      generateFunctionCall("callee", argCtx, input, state, orchestrator);

      expect(markParameterModified).not.toHaveBeenCalled();
    });

    it("does not mark when callee does not modify the parameter", () => {
      const argExprs = [createMockExpressionContext("myParam")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "callee",
          {
            name: "callee",
            parameters: [
              { name: "p", baseType: "u32", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const markParameterModified = vi.fn();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isCurrentParameter: vi.fn(() => true),
        isCalleeParameterModified: vi.fn(() => false),
        markParameterModified,
        isFloatType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      generateFunctionCall("callee", argCtx, input, state, orchestrator);

      expect(markParameterModified).not.toHaveBeenCalled();
    });

    it("skips tracking when argument has no simple identifier", () => {
      const argExprs = [createMockExpressionContext("a + b")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "callee",
          {
            name: "callee",
            parameters: [
              { name: "p", baseType: "u32", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs });
      const state = createMockState();
      const markParameterModified = vi.fn();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        getSimpleIdentifier: vi.fn(() => null),
        isCurrentParameter: vi.fn(() => false),
        markParameterModified,
        isFloatType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      generateFunctionCall("callee", argCtx, input, state, orchestrator);

      expect(markParameterModified).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Issue #832: Auto-reference for typedef pointer output parameters
  // ========================================================================
  describe("Issue #832: typedef pointer output parameters", () => {
    it("adds & when typedef pointer type is passed to pointer-to-typedef param", () => {
      // handle_t is typedef'd pointer, create_handle expects handle_t*
      const argExprs = [createMockExpressionContext("my_handle")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "create_handle",
          {
            name: "create_handle",
            parameters: [
              {
                name: "out",
                baseType: "handle_t*",
                isConst: false,
                isArray: false,
              },
            ],
          },
        ],
      ]);
      const typeRegistry = new Map([
        [
          "my_handle",
          { baseType: "handle_t", bitWidth: 0, isArray: false, isConst: false },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getExpressionType: vi.fn(() => "handle_t"),
        isStructType: vi.fn(() => false), // typedef pointer is not a struct
        isIntegerType: vi.fn(() => false),
        isFloatType: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "create_handle",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("create_handle(&my_handle)");
    });

    it("does not add & for primitive types passed to pointer params (array decay)", () => {
      // uint8_t[] passed to uint8_t* should NOT get &
      const argExprs = [createMockExpressionContext("data")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "send_data",
          {
            name: "send_data",
            parameters: [
              {
                name: "buf",
                baseType: "uint8_t*",
                isConst: false,
                isArray: false,
              },
            ],
          },
        ],
      ]);
      const typeRegistry = new Map([
        [
          "data",
          { baseType: "uint8_t", bitWidth: 8, isArray: true, isConst: false },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getExpressionType: vi.fn(() => "uint8_t"),
        isStructType: vi.fn(() => false),
        isIntegerType: vi.fn(() => false), // uint8_t is C type, not in INTEGER_TYPES
        isFloatType: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "send_data",
        argCtx,
        input,
        state,
        orchestrator,
      );

      // Should NOT add & because uint8_t is in C_TYPE_WIDTH (primitive)
      expect(result.code).toBe("send_data(data)");
    });

    it("does not add & when typedef type is passed directly (not to pointer)", () => {
      // use_handle expects handle_t, not handle_t*
      const argExprs = [createMockExpressionContext("my_handle")];
      const argCtx = createMockArgListContext(argExprs);
      const sigs = new Map([
        [
          "use_handle",
          {
            name: "use_handle",
            parameters: [
              {
                name: "h",
                baseType: "handle_t", // NOT a pointer
                isConst: false,
                isArray: false,
              },
            ],
          },
        ],
      ]);
      const typeRegistry = new Map([
        [
          "my_handle",
          { baseType: "handle_t", bitWidth: 0, isArray: false, isConst: false },
        ],
      ]);
      const input = createMockInput({ functionSignatures: sigs, typeRegistry });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getExpressionType: vi.fn(() => "handle_t"),
        isStructType: vi.fn(() => false),
        isIntegerType: vi.fn(() => false),
        isFloatType: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "use_handle",
        argCtx,
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("use_handle(my_handle)");
    });
  });
});
