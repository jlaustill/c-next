import { describe, it, expect, vi, beforeEach } from "vitest";
import generateFunctionCall from "../CallExprGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../../PARSE/2-Parse/grammar/CNextParser";
import TranspileState from "../../../../../TranspileState";
import TTypeInfo from "../../../../../../transpiler/types/TTypeInfo";
import TestGeneratorState from "../../__tests__/testGeneratorState";
import type IPlannedCallArgument from "../../../types/IPlannedCallArgument";

// ========================================================================
// Test Helpers
// ========================================================================

function createMockExpressionContext(text: string): Parser.ExpressionContext {
  return {
    getText: () => text,
  } as unknown as Parser.ExpressionContext;
}

/**
 * The planned arguments for a call, built the way
 * `CodeGenerator.planCallArguments` builds them -- by asking the orchestrator
 * the same four questions, in the same eager/lazy split.
 *
 * #1445 box 3: the generator takes `IPlannedCallArgument[]` now. These tests
 * keep their mock expression contexts, because what the mock orchestrator's
 * `generateExpression` / `getSimpleIdentifier` / `getExpressionType` /
 * `generateFunctionArg` were always doing is standing in for the PLANNER. This
 * makes that explicit rather than deleting it, so every per-test override of
 * those four keeps working and no assertion moves.
 *
 * The eager/lazy split is the part worth copying exactly: `simpleIdentifier` is
 * read once, here; the other three are deferred, because exactly one render
 * may happen per argument.
 */
function planArguments(
  orchestrator: IArgumentPlannerStub,
  expressions: Parser.ExpressionContext[],
): readonly IPlannedCallArgument[] {
  return expressions.map((expression) => ({
    simpleIdentifier: orchestrator.getSimpleIdentifier(expression),
    expressionType: () => orchestrator.getExpressionType(expression),
    render: () => orchestrator.generateExpression(expression),
    renderByReference: (targetParamBaseType: string | undefined) =>
      orchestrator.generateFunctionArg(expression, targetParamBaseType),
  }));
}

function createMockInput(
  overrides: Partial<IGeneratorInput> = {},
): IGeneratorInput {
  // Also populate TranspileState with the type registry entries
  // This is needed because CallExprGenerator now uses TranspileState directly
  const typeRegistry =
    (overrides.typeRegistry as Map<string, TTypeInfo>) ?? new Map();
  for (const [name, info] of typeRegistry) {
    sharedState.setVariableTypeInfo(name, info);
  }

  return {
    symbols: null,
    symbolTable: null,
    typeRegistry,
    functionSignatures: new Map(),
    knownFunctions: new Set(),
    knownStructs: new Set(),
    knownScopes: new Set<string>(),
    constValues: new Map(),
    callbackTypes: new Map(),
    callbackFieldTypes: new Map(),
    targetCapabilities: { hasAtomicSupport: false },
    debugMode: false,
    ...overrides,
  } as unknown as IGeneratorInput;
}

function createMockState(): IGeneratorState {
  return TestGeneratorState.create();
}

/**
 * The four planner operations this file stands in for.
 *
 * #1445 box 3: they used to be declared on `IOrchestrator`, where **no
 * production generator called them** -- they were interface surface kept alive
 * by this test alone, and `IOrchestrator` named a parse type solely to declare
 * them. Declared locally instead, so every per-case override below keeps
 * working while the production interface sheds its last parse types.
 */
interface IArgumentPlannerStub {
  getSimpleIdentifier(ctx: Parser.ExpressionContext): string | null;
  getExpressionType(ctx: Parser.ExpressionContext): string | null;
  generateExpression(ctx: Parser.ExpressionContext): string;
  generateFunctionArg(
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ): string;
}

/**
 * #1452: the generator reads render state off its orchestrator, so the mock
 * and the assertions share ONE instance.
 */
let sharedState = new TranspileState();

function createMockOrchestrator(
  overrides: Partial<IOrchestrator & IArgumentPlannerStub> = {},
): IOrchestrator & IArgumentPlannerStub {
  return {
    // #1452: the orchestrator carries 2.3's per-file state, so a generator
    // reads it from the collaborator it was handed rather than a static class.
    state: sharedState,
    generateExpression: vi.fn((ctx: Parser.ExpressionContext) => ctx.getText()),
    generateFunctionArg: vi.fn(
      (ctx: Parser.ExpressionContext) => `&${ctx.getText()}`,
    ),
    getSimpleIdentifier: vi.fn((ctx: Parser.ExpressionContext) =>
      ctx.getText(),
    ),
    isCNextFunction: vi.fn(() => false),
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
  } as unknown as IOrchestrator & IArgumentPlannerStub;
}

// ========================================================================
// Tests
// ========================================================================

describe("CallExprGenerator", () => {
  // Reset TranspileState before each test to avoid state pollution
  beforeEach(() => {
    sharedState = new TranspileState();
  });

  describe("empty function call", () => {
    it("generates call with no arguments when the call declares none", () => {
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
      const argExpressions = [
        createMockExpressionContext("x"),
        createMockExpressionContext("y"),
      ];
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "printf",
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("printf(x, y)");
    });

    it("auto-adds & for struct arguments passed to pointer parameters", () => {
      const argExpressions = [createMockExpressionContext("myStruct")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(&myStruct)");
    });

    it("does not add & if argument already has & prefix", () => {
      const argExpressions = [createMockExpressionContext("myStruct")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(&myStruct)");
    });

    it("does not add & if argument is an array parameter", () => {
      const argExpressions = [createMockExpressionContext("arr")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(arr)");
    });

    it("does not add & if argument type is already a pointer", () => {
      const argExpressions = [createMockExpressionContext("ptr")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(ptr)");
    });

    it("falls back to type registry when getExpressionType returns null", () => {
      const argExpressions = [
        createMockExpressionContext("ConfigManager_config"),
      ];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(&ConfigManager_config)");
    });

    it("does not add & when type registry lookup also returns null", () => {
      const argExpressions = [createMockExpressionContext("unknown")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(unknown)");
    });

    it("Issue #937: passes callback-promoted params directly to pointer-expecting C functions", () => {
      // When a C-Next param matches a callback typedef (e.g., u8 buf -> uint8_t* buf),
      // and it's passed to a C function expecting a pointer, use identifier directly
      const argExpressions = [createMockExpressionContext("buf")];
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
      const generatorState = createMockState();

      // Set up the render state's currentParameters to simulate a
      // callback-promoted param.
      sharedState.currentParameters.set("buf", {
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
        planArguments(orchestrator, argExpressions),
        input,
        generatorState,
        orchestrator,
      );

      // Should pass buf directly, NOT (*buf) or &(*buf)
      expect(result.code).toBe("draw_bitmap(buf)");

      // Clean up
      sharedState.currentParameters.clear();
    });
  });

  describe("C++ enum class static_cast", () => {
    it("wraps enum class argument with static_cast for integer parameter", () => {
      const argExpressions = [createMockExpressionContext("MyEnum::Value")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(static_cast<uint32_t>(MyEnum::Value))");
    });

    it("does not wrap when not in C++ mode", () => {
      const argExpressions = [createMockExpressionContext("val")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(val)");
    });

    it("does not wrap when argument is not an enum class", () => {
      const argExpressions = [createMockExpressionContext("val")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(val)");
    });

    it("does not wrap when target parameter is not an integer type", () => {
      const argExpressions = [createMockExpressionContext("val")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(val)");
    });

    it("does not wrap when expression type is null", () => {
      const argExpressions = [createMockExpressionContext("val")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(val)");
    });
  });

  describe("C-Next function calls", () => {
    it("passes struct arguments by reference", () => {
      const argExpressions = [createMockExpressionContext("myVal")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("doWork(&myVal)");
    });

    it("passes float parameters by value", () => {
      const argExpressions = [createMockExpressionContext("temperature")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("setTemp(temperature)");
    });

    it("passes enum parameters by value", () => {
      const argExpressions = [createMockExpressionContext("STATE_ON")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("setState(STATE_ON)");
    });

    it("passes small primitive parameters by value (Issue #269)", () => {
      const argExpressions = [createMockExpressionContext("flag")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("setFlag(flag)");
    });

    it("passes unknown types by value (Issue #551)", () => {
      const argExpressions = [createMockExpressionContext("extVal")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("process(extVal)");
    });

    it("wraps C++ enum class with static_cast for C-Next pass-by-value", () => {
      const argExpressions = [createMockExpressionContext("MyEnum::Val")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("doWork(static_cast<uint32_t>(MyEnum::Val))");
    });
  });

  describe("cross-file function calls (Issue #315)", () => {
    it("looks up parameter info from SymbolTable and passes primitives by value (Issue #786)", () => {
      const argExpressions = [createMockExpressionContext("myVal")];
      const symbolTable = {
        getOverloadsByCName: vi.fn(() => [
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      // Issue #1139: cross-file lookup resolves by transpiled C name, so a
      // scoped callee is found instead of silently missing.
      expect(symbolTable.getOverloadsByCName).toHaveBeenCalledWith(
        "crossFileFunc",
      );
      // Issue #786: Primitive types like u32 are now passed by value for cross-file calls
      expect(result.code).toBe("crossFileFunc(myVal)");
    });

    it("passes small primitive by value for cross-file functions", () => {
      const argExpressions = [createMockExpressionContext("flag")];
      const symbolTable = {
        getOverloadsByCName: vi.fn(() => [
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("crossFileFunc(flag)");
    });

    it("skips non-function symbols in SymbolTable overloads", () => {
      const argExpressions = [createMockExpressionContext("val")];
      const symbolTable = {
        getOverloadsByCName: vi.fn(() => [
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
        planArguments(orchestrator, argExpressions),
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
      const argExpressions = [
        createMockExpressionContext("result"),
        createMockExpressionContext("a"),
        createMockExpressionContext("b"),
        createMockExpressionContext("0"),
      ];
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
        planArguments(orchestrator, argExpressions),
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
      const argExpressions = [
        createMockExpressionContext("out"),
        createMockExpressionContext("x"),
        createMockExpressionContext("y"),
        createMockExpressionContext("1"),
      ];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("cnx_safe_mod_i64(&out, x, y, 1)");
      expect(result.effects).toEqual([
        { type: "safe-div", operation: "mod", cnxType: "i64" },
      ]);
    });

    // #1322: these four asserted the user-facing throws. ADR-051's call shape
    // is E0884/E0885 in pass 2.1, and a `const` output is E0877 there -- a case
    // this file never had, because it was accepted. What remains here is the
    // invariant, which these now assert: the guards still narrow.
    it("asserts the invariant when safe_div has the wrong number of arguments", () => {
      const argExpressions = [
        createMockExpressionContext("a"),
        createMockExpressionContext("b"),
      ];
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
      });

      expect(() =>
        generateFunctionCall(
          "safe_div",
          planArguments(orchestrator, argExpressions),
          input,
          state,
          orchestrator,
        ),
      ).toThrow("E0884 rejects this in pass 2.1");
    });

    it("asserts the invariant when safe_mod has the wrong number of arguments", () => {
      const argExpressions = [createMockExpressionContext("a")];
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
      });

      expect(() =>
        generateFunctionCall(
          "safe_mod",
          planArguments(orchestrator, argExpressions),
          input,
          state,
          orchestrator,
        ),
      ).toThrow("E0884 rejects this in pass 2.1");
    });

    it("asserts the invariant when the first argument is not an identifier", () => {
      const argExpressions = [
        createMockExpressionContext("a + b"),
        createMockExpressionContext("x"),
        createMockExpressionContext("y"),
        createMockExpressionContext("0"),
      ];
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getSimpleIdentifier: vi.fn(() => null),
      });

      expect(() =>
        generateFunctionCall(
          "safe_div",
          planArguments(orchestrator, argExpressions),
          input,
          state,
          orchestrator,
        ),
      ).toThrow("E0885 rejects this in pass 2.1");
    });

    it("asserts the invariant when the output parameter has no type", () => {
      const argExpressions = [
        createMockExpressionContext("unknownVar"),
        createMockExpressionContext("a"),
        createMockExpressionContext("b"),
        createMockExpressionContext("0"),
      ];
      const input = createMockInput(); // empty typeRegistry
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        getSimpleIdentifier: vi.fn(() => "unknownVar"),
      });

      expect(() =>
        generateFunctionCall(
          "safe_div",
          planArguments(orchestrator, argExpressions),
          input,
          state,
          orchestrator,
        ),
      ).toThrow("E0885 rejects this in pass 2.1");
    });

    it("throws error when output parameter has no baseType", () => {
      const argExpressions = [
        createMockExpressionContext("noType"),
        createMockExpressionContext("a"),
        createMockExpressionContext("b"),
        createMockExpressionContext("0"),
      ];
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
        generateFunctionCall(
          "safe_div",
          planArguments(orchestrator, argExpressions),
          input,
          state,
          orchestrator,
        ),
      ).toThrow("a registered variable always has a non-empty baseType");
    });
  });

  describe("const-to-non-const validation (ADR-013)", () => {
    it("allows const value passed to const parameter", () => {
      const argExpressions = [createMockExpressionContext("MY_CONST")];
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
        isFloatType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      // Should not throw
      const result = generateFunctionCall(
        "readOnly",
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("readOnly(");
    });

    it("skips validation when no function signature exists", () => {
      const argExpressions = [createMockExpressionContext("val")];
      const input = createMockInput(); // no signatures
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => true),
        isFloatType: vi.fn(() => false),
        isStructType: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      // Should not throw
      const result = generateFunctionCall(
        "unknownFunc",
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("unknownFunc(");
    });
  });

  describe("pass-through modification tracking (Issue #268)", () => {
    it("marks parameter as modified when callee modifies it", () => {
      const argExpressions = [createMockExpressionContext("myParam")];
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

      generateFunctionCall(
        "callee",
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(markParameterModified).toHaveBeenCalledWith("myParam");
    });

    it("does not mark when argument is not a current parameter", () => {
      const argExpressions = [createMockExpressionContext("localVar")];
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

      generateFunctionCall(
        "callee",
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(markParameterModified).not.toHaveBeenCalled();
    });

    it("does not mark when callee does not modify the parameter", () => {
      const argExpressions = [createMockExpressionContext("myParam")];
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

      generateFunctionCall(
        "callee",
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(markParameterModified).not.toHaveBeenCalled();
    });

    it("skips tracking when argument has no simple identifier", () => {
      const argExpressions = [createMockExpressionContext("a + b")];
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

      generateFunctionCall(
        "callee",
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(markParameterModified).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Issue #832: Auto-reference for typedef pointer output parameters
  // ========================================================================
  describe("Issue #832: typedef pointer output parameters", () => {
    it("adds & when typedef pointer type is passed to pointer-to-typedef param", () => {
      // handle_t is typedef'd pointer, create_handle expects handle_t*
      const argExpressions = [createMockExpressionContext("my_handle")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("create_handle(&my_handle)");
    });

    it("does not add & for primitive types passed to pointer params (array decay)", () => {
      // uint8_t[] passed to uint8_t* should NOT get &
      const argExpressions = [createMockExpressionContext("data")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      // Should NOT add & because uint8_t is in C_TYPE_WIDTH (primitive)
      expect(result.code).toBe("send_data(data)");
    });

    it("does not add & when typedef type is passed directly (not to pointer)", () => {
      // use_handle expects handle_t, not handle_t*
      const argExpressions = [createMockExpressionContext("my_handle")];
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
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("use_handle(my_handle)");
    });
  });

  describe("inDeclarationInit clearing (Issue #992)", () => {
    beforeEach(() => {
      sharedState = new TranspileState();
    });

    it("clears inDeclarationInit during function argument generation", () => {
      sharedState.inDeclarationInit = true;

      const argExpressions = [createMockExpressionContext("myArg")];
      const input = createMockInput();
      const state = createMockState();

      let flagDuringArg = true;
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
        generateExpression: vi.fn((ctx: Parser.ExpressionContext) => {
          flagDuringArg = sharedState.inDeclarationInit;
          return ctx.getText();
        }),
      });

      generateFunctionCall(
        "myFunc",
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(flagDuringArg).toBe(false);
      expect(sharedState.inDeclarationInit).toBe(true);
    });

    it("restores inDeclarationInit after argument generation", () => {
      sharedState.inDeclarationInit = true;

      const argExpressions = [
        createMockExpressionContext("a"),
        createMockExpressionContext("b"),
      ];
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
      });

      generateFunctionCall(
        "myFunc",
        planArguments(orchestrator, argExpressions),
        input,
        state,
        orchestrator,
      );

      expect(sharedState.inDeclarationInit).toBe(true);
    });
  });
});
