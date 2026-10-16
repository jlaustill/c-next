import type IArgumentPassing from "../../../../../2-Plan/types/IArgumentPassing";
import CArgumentAddress from "../../../../../2-Plan/CArgumentAddress";
import type ICArgumentFacts from "../../../../../2-Plan/types/ICArgumentFacts";
import ForeignTypeFacts from "../../../../../../utils/ForeignTypeFacts";
import type TParameterInfo from "../../../../../../types/TParameterInfo";
import TestSymbolTable from "../../../../../__tests__/TestSymbolTable";
import { describe, it, expect, vi, beforeEach } from "vitest";
import generateFunctionCall from "../CallExprGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../../PARSE/2-Parse/grammar/CNextParser";
import TranspileState from "../../../../../TranspileState";
import TTypeInfo from "../../../../../../types/TTypeInfo";
import TestGeneratorState from "../../__tests__/testGeneratorState";
import type IPlannedCallArgument from "../../../types/IPlannedCallArgument";
import type IPlannedArgument from "../../../../../2-Plan/types/IPlannedArgument";
import CallArgumentPassing from "../../../../../2-Plan/CallArgumentPassing";

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
 * the same five questions, in the same eager/lazy split.
 *
 * #1445 box 3: the generator takes `IPlannedCallArgument[]` now. These tests
 * keep their mock expression contexts, because what the mock orchestrator's
 * `generateExpression` / `getSimpleIdentifier` / `getExpressionType` /
 * `generateFunctionArg` were always doing is standing in for the PLANNER. This
 * makes that explicit rather than deleting it, so every per-test override of
 * those four keeps working and no assertion moves. `isArrayExpression` is the
 * fifth, added with the whole-array rule, and answers "not an array" unless a
 * case says otherwise.
 *
 * The eager/lazy split is the part worth copying exactly: `simpleIdentifier` is
 * read once, here; the other four are deferred, because exactly one render
 * may happen per argument.
 */
function planArguments(
  orchestrator: IArgumentPlannerStub &
    Parameters<typeof CallArgumentPassing.of>[3],
  expressions: Parser.ExpressionContext[],
  callee: string,
  input: IGeneratorInput,
): readonly IPlannedCallArgument[] {
  return expressions.map((expression, index) => {
    // 2.2's decision, made the way `FilePlanner.planArguments` makes it
    const passing = CallArgumentPassing.of(callee, index, input, orchestrator);
    const base = passing.param?.baseType;
    return planArgument(
      orchestrator,
      expression,
      {
        passing,
        form: null,
        cForm:
          passing.mode === "c"
            ? CArgumentAddress.formOf(
                cArgumentFacts(orchestrator, expression, passing.param),
                orchestrator,
              )
            : null,
        enumCast:
          passing.mode === "reference"
            ? null
            : CallArgumentPassing.cppEnumCast(
                orchestrator.getExpressionType(expression),
                base,
                orchestrator,
              ),
      },
      base,
    );
  });
}

/** The facts `FilePlanner.cArgumentForm` gathers, read off the case's stubs */
function cArgumentFacts(
  orchestrator: IArgumentPlannerStub,
  expression: Parser.ExpressionContext,
  param: IArgumentPassing["param"],
): ICArgumentFacts {
  const text = expression.getText();
  const declared = declaredTypes.get(text);
  const symbolTable = (orchestrator as unknown as IOrchestrator).state
    ?.symbolTable;
  const foreign = symbolTable
    ? ForeignTypeFacts.foreignSymbol(symbolTable, text)
    : undefined;
  const bracket = text.indexOf("[");
  const array =
    bracket > 0 ? declaredTypes.get(text.slice(0, bracket)) : undefined;
  return {
    param,
    addressWritten: text.startsWith("&"),
    promotedHandle:
      orchestrator.getParameter(expression)?.forcePointerSemantics ?? false,
    argType:
      orchestrator.getExpressionType(expression) ??
      declared?.baseType ??
      (foreign?.kind === "variable" && !foreign.isArray ? foreign.type : null),
    declared,
    isArray: orchestrator.isArrayExpression(expression),
    isHandleArrayElement:
      (array?.isArray ?? false) && (array?.isPointer ?? false),
  };
}

function planArgument(
  orchestrator: IArgumentPlannerStub,
  expression: Parser.ExpressionContext,
  planned: IPlannedArgument,
  base: string | undefined,
): IPlannedCallArgument {
  return {
    planned,
    simpleIdentifier: orchestrator.getSimpleIdentifier(expression),
    parameter: orchestrator.getParameter(expression),
    // The planner decides this from the array's declaration; the stub reads
    // the case's declared array the way `declared` reads a name
    render: () => orchestrator.generateExpression(expression),
    renderByReference: () => orchestrator.generateFunctionArg(expression, base),
  };
}

/** What each case declares, by name -- see `createMockInput` */
let declaredTypes: ReadonlyMap<string, TTypeInfo> = new Map();

function createMockInput(
  overrides: Partial<IGeneratorInput> & {
    /** #1668: each case's declared variables, which the plan carries */
    typeRegistry?: Map<string, TTypeInfo>;
  } = {},
): IGeneratorInput {
  // #1668 (C7): an argument carries its declared type on its plan, which
  // `planArguments` reads from these
  const { typeRegistry = new Map<string, TTypeInfo>(), ...input } = overrides;
  declaredTypes = typeRegistry;

  return {
    symbols: null,
    symbolTable: null,
    functionSignatures: new Map(),
    knownFunctions: new Set(),
    knownStructs: new Set(),
    knownScopes: new Set<string>(),
    constValues: new Map(),
    callbackTypes: new Map(),
    callbackFieldTypes: new Map(),
    program: null,
    ...input,
  } as unknown as IGeneratorInput;
}

function createMockState(): IGeneratorState {
  return TestGeneratorState.create();
}

/**
 * The five planner operations this file stands in for.
 *
 * #1445 box 3: they used to be declared on `IOrchestrator`, where **no
 * production generator called them** -- they were interface surface kept alive
 * by this test alone, and `IOrchestrator` named a parse type solely to declare
 * them. Declared locally instead, so every per-case override below keeps
 * working while the production interface sheds its last parse types.
 */
interface IArgumentPlannerStub {
  getSimpleIdentifier(ctx: Parser.ExpressionContext): string | null;
  /** #1969: the parameter the argument's name binds to where it is passed */
  getParameter(ctx: Parser.ExpressionContext): TParameterInfo | undefined;
  getExpressionType(ctx: Parser.ExpressionContext): string | null;
  isArrayExpression(ctx: Parser.ExpressionContext): boolean;
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

/** A by-reference `u32` parameter of the calling function */
const PASS_THROUGH_PARAM: TParameterInfo = {
  name: "p",
  baseType: "u32",
  isArray: false,
  isStruct: false,
  isConst: false,
  isCallback: false,
  isString: false,
};

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
    isKnownStruct: vi.fn(() => false),
    isCppMode: vi.fn(() => false),
    isCppEnumClass: vi.fn(() => false),
    getExpressionType: vi.fn(() => null),
    isArrayExpression: vi.fn(() => false),
    getKnownEnums: vi.fn(() => new Set<string>()),
    isParameterPassByValue: vi.fn(() => false),
    getParameter: vi.fn((ctx: Parser.ExpressionContext) =>
      sharedState.currentParameters.get(ctx.getText()),
    ),
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
    TestSymbolTable.install(sharedState);
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
        planArguments(orchestrator, argExpressions, "printf", input),
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
        isKnownStruct: vi.fn(() => true),
      });

      const result = generateFunctionCall(
        "c_func",
        planArguments(orchestrator, argExpressions, "c_func", input),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("c_func(&myStruct)");
    });

    it("does not add & if argument already has & prefix", () => {
      const argExpressions = [createMockExpressionContext("&myStruct")];
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
        isKnownStruct: vi.fn(() => true),
      });

      const result = generateFunctionCall(
        "c_func",
        planArguments(orchestrator, argExpressions, "c_func", input),
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
        isKnownStruct: vi.fn(() => true),
      });

      const result = generateFunctionCall(
        "c_func",
        planArguments(orchestrator, argExpressions, "c_func", input),
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
        isKnownStruct: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "c_func",
        planArguments(orchestrator, argExpressions, "c_func", input),
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
        isKnownStruct: vi.fn(() => true),
      });

      const result = generateFunctionCall(
        "c_func",
        planArguments(orchestrator, argExpressions, "c_func", input),
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
        planArguments(orchestrator, argExpressions, "c_func", input),
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
        isKnownStruct: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "draw_bitmap",
        planArguments(orchestrator, argExpressions, "draw_bitmap", input),
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
        planArguments(orchestrator, argExpressions, "c_func", input),
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
        planArguments(orchestrator, argExpressions, "c_func", input),
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
        planArguments(orchestrator, argExpressions, "c_func", input),
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
        planArguments(orchestrator, argExpressions, "c_func", input),
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
        planArguments(orchestrator, argExpressions, "c_func", input),
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
        planArguments(orchestrator, argExpressions, "doWork", input),
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
        planArguments(orchestrator, argExpressions, "setTemp", input),
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
        planArguments(orchestrator, argExpressions, "setState", input),
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
        planArguments(orchestrator, argExpressions, "setFlag", input),
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
        isKnownStruct: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "process",
        planArguments(orchestrator, argExpressions, "process", input),
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
        planArguments(orchestrator, argExpressions, "doWork", input),
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
        isParameterPassByValue: vi.fn(() => true),
        isKnownStruct: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "crossFileFunc",
        planArguments(orchestrator, argExpressions, "crossFileFunc", input),
        input,
        state,
        orchestrator,
      );

      // Issue #1139: cross-file lookup resolves by transpiled C name, so a
      // scoped callee is found instead of silently missing.
      expect(symbolTable.getOverloadsByCName).toHaveBeenCalledWith(
        "crossFileFunc",
      );
      // #1991: 1.4's whole-program eligibility says the callee leaves it
      // unmodified, so it is passed by value, from any file
      expect(result.code).toBe("crossFileFunc(myVal)");
    });

    it("passes a cross-file primitive its callee modifies by reference", () => {
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
        isKnownStruct: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "crossFileFunc",
        planArguments(orchestrator, argExpressions, "crossFileFunc", input),
        input,
        state,
        orchestrator,
      );

      // #1991: a primitive is not forced by value for coming from another
      // file (#786); 1.4 says the callee modifies it
      expect(result.code).toBe("crossFileFunc(&flag)");
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
        isKnownStruct: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "unknownFunc",
        planArguments(orchestrator, argExpressions, "unknownFunc", input),
        input,
        state,
        orchestrator,
      );

      // No param info found, falls through to pass-by-reference (no targetParam)
      expect(result.code).toBe("unknownFunc(&val)");
    });
  });

  describe("safe_div and safe_mod (ADR-051)", () => {
    it("generates safe_div call with the helper 2.2 planned", () => {
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
        planArguments(orchestrator, argExpressions, "safe_div", input),
        input,
        state,
        orchestrator,
        null,
        "cnx_safe_div_u32",
      );

      expect(result.code).toBe("cnx_safe_div_u32(&result, a, b, 0)");
      expect(result.effects).toEqual([]);
    });

    it("generates safe_mod call with the helper 2.2 planned", () => {
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
        planArguments(orchestrator, argExpressions, "safe_mod", input),
        input,
        state,
        orchestrator,
        null,
        "cnx_safe_mod_i64",
      );

      expect(result.code).toBe("cnx_safe_mod_i64(&out, x, y, 1)");
      expect(result.effects).toEqual([]);
    });

    // #1322: these four asserted the user-facing throws. ADR-051's call shape
    // is E0884/E0885 in pass 2.1, and a read-only output is E0900 there -- a case
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
          planArguments(orchestrator, argExpressions, "safe_div", input),
          input,
          state,
          orchestrator,
          null,
          "cnx_safe_div_u32",
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
          planArguments(orchestrator, argExpressions, "safe_mod", input),
          input,
          state,
          orchestrator,
          null,
          "cnx_safe_mod_i64",
        ),
      ).toThrow("E0884 rejects this in pass 2.1");
    });

    it("writes an unplanned call by its name: 2.3 does not decide it is ADR-051's", () => {
      const argExpressions = [
        createMockExpressionContext("result"),
        createMockExpressionContext("a"),
        createMockExpressionContext("b"),
        createMockExpressionContext("0"),
      ];
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "safe_div",
        planArguments(
          orchestrator,
          argExpressions,
          "safe_div",
          createMockInput(),
        ),
        createMockInput(),
        createMockState(),
        orchestrator,
      );

      expect(result.code).toBe("safe_div(result, a, b, 0)");
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
        planArguments(orchestrator, argExpressions, "readOnly", input),
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
        isKnownStruct: vi.fn(() => false),
        isParameterPassByValue: vi.fn(() => false),
      });

      // Should not throw
      const result = generateFunctionCall(
        "unknownFunc",
        planArguments(orchestrator, argExpressions, "unknownFunc", input),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toContain("unknownFunc(");
    });
  });

  // ========================================================================
  // Issue #832: Auto-reference for typedef pointer output parameters
  // ========================================================================
  /**
   * ADR-030 / #996: an array of opaque handles is an array of pointers, so its
   * element is already the handle -- `dev_poke(&arr[0U])` passed a `Dev**`.
   * Asked of the array's declaration, however the array is named (a scope
   * member's too). The complete-struct array is the control: its
   * element is a value and keeps its `&`.
   */
  describe("element of an array that holds pointers (ADR-030 / #996)", () => {
    it.each<[string, string, string, boolean, boolean, string]>([
      ["handles", "handleArr", "Dev", true, false, "take(handleArr[0U])"],
      [
        "complete structs",
        "pointArr",
        "Point",
        false,
        true,
        "take(&pointArr[0U])",
      ],
    ])(
      "passes an element of an array of %s",
      (_label, arrayName, elementType, isPointer, isStruct, expected) => {
        const argExpressions = [
          createMockExpressionContext(`${arrayName}[0U]`),
        ];
        const sigs = new Map([
          [
            "take",
            {
              name: "take",
              parameters: [
                {
                  name: "p",
                  baseType: `${elementType}*`,
                  isConst: false,
                  isArray: false,
                },
              ],
            },
          ],
        ]);
        const typeRegistry = new Map([
          [
            arrayName,
            {
              baseType: elementType,
              bitWidth: 0,
              isArray: true,
              isConst: false,
              isPointer,
            },
          ],
        ]);
        const input = createMockInput({
          functionSignatures: sigs,
          typeRegistry,
        });
        const orchestrator = createMockOrchestrator({
          getExpressionType: vi.fn(() => elementType),
          isKnownStruct: vi.fn(() => isStruct),
        });

        const result = generateFunctionCall(
          "take",
          planArguments(orchestrator, argExpressions, "take", input),
          input,
          createMockState(),
          orchestrator,
        );

        expect(result.code).toBe(expected);
      },
    );
  });

  /** A C function `take` whose one parameter is `paramType`. */
  const takeSignature = (paramType: string) =>
    new Map([
      [
        "take",
        {
          name: "take",
          parameters: [
            { name: "p", baseType: paramType, isConst: false, isArray: false },
          ],
        },
      ],
    ]);

  describe("a whole array reaches a C pointer parameter as itself", () => {
    it.each<[string, boolean, string]>([
      // C decays the array to a pointer to its first element; `&pts` is a
      // pointer to the ARRAY -- `CPoint (*)[2]`, or `CPoint**` for a parameter.
      ["a whole array", true, "take(pts)"],
      // Control: a struct VALUE is still passed by address.
      ["a struct value", false, "take(&pts)"],
    ])("%s", (_label, isArray, expected) => {
      const orchestrator = createMockOrchestrator({
        getExpressionType: vi.fn(() => "CPoint"),
        isKnownStruct: vi.fn(() => true),
        isArrayExpression: vi.fn(() => isArray),
      });

      const result = generateFunctionCall(
        "take",
        planArguments(
          orchestrator,
          [createMockExpressionContext("pts")],
          "take",
          createMockInput({ functionSignatures: takeSignature("CPoint*") }),
        ),
        createMockInput({ functionSignatures: takeSignature("CPoint*") }),
        createMockState(),
        orchestrator,
      );

      expect(result.code).toBe(expected);
    });
  });

  describe("a value already a pointer, against the parameter's pointer depth", () => {
    it.each<[string, string, string, string]>([
      // An opaque handle IS the argument for a `Dev*`...
      ["a handle to a Dev*", "Dev", "Dev*", "take(d)"],
      // ...and its address is the argument for a `Dev**` out-parameter.
      ["a handle to a Dev**", "Dev", "Dev**", "take(&d)"],
      // Only one level can be bridged by `&`; anything else is left alone.
      ["a handle to a Dev***", "Dev", "Dev***", "take(d)"],
      // A C variable declared `Dev*` says its depth in its type.
      ["a Dev* variable to a Dev*", "Dev*", "Dev*", "take(d)"],
      ["a Dev* variable to a Dev**", "Dev*", "Dev**", "take(&d)"],
      ["a Dev** variable to a Dev**", "Dev**", "Dev**", "take(d)"],
      ["a Dev** variable to a Dev***", "Dev**", "Dev***", "take(&d)"],
    ])("%s", (_label, argType, paramType, expected) => {
      const typeRegistry = new Map([
        [
          "d",
          {
            baseType: argType,
            bitWidth: 0,
            isArray: false,
            isConst: false,
            // A handle is registered as a pointer; a `Dev*` C variable is not
            // registered here at all, so its type alone carries the depth.
            isPointer: !argType.endsWith("*"),
          },
        ],
      ]);
      const orchestrator = createMockOrchestrator({
        getExpressionType: vi.fn(() => argType),
        isKnownStruct: vi.fn(() => true),
      });
      // The input first: it records the case's declared variables, and a
      // planned argument reads its declared type when it is planned (#1668)
      const input = createMockInput({
        functionSignatures: takeSignature(paramType),
        typeRegistry,
      });

      const result = generateFunctionCall(
        "take",
        planArguments(
          orchestrator,
          [createMockExpressionContext("d")],
          "take",
          input,
        ),
        input,
        createMockState(),
        orchestrator,
      );

      expect(result.code).toBe(expected);
    });
  });

  describe("a call through a callback-typed value (ADR-029)", () => {
    it.each<[string, string | null, string]>([
      // The field holds a `peek`, so the call takes `peek`'s parameters: the
      // struct goes by reference, as it does in a direct `peek(p)`.
      ["a value of a callback type", "peek", "h.onPeek(&p)"],
      // Controls: nothing names a callback type, so nothing names parameters.
      ["an untyped callee", null, "h.onPeek(p)"],
      ["a callee of a non-callback type", "u32", "h.onPeek(p)"],
    ])("%s", (_label, calleeType, expected) => {
      const functionSignatures = new Map([
        [
          "peek",
          {
            name: "peek",
            parameters: [
              { name: "p", baseType: "Point", isConst: false, isArray: false },
            ],
          },
        ],
      ]);
      const callbackTypes = new Map([
        [
          "peek",
          {
            functionName: "peek",
            returnType: "uint32_t",
            parameters: [],
            typedefName: "peek_fp",
          },
        ],
      ]);
      const orchestrator = createMockOrchestrator({
        isCNextFunction: vi.fn((name: string) => name === "peek"),
        isKnownStruct: vi.fn(() => true),
      });

      const result = generateFunctionCall(
        "h.onPeek",
        planArguments(
          orchestrator,
          [createMockExpressionContext("p")],
          CallArgumentPassing.callbackFunction(
            calleeType,
            createMockInput({ functionSignatures, callbackTypes }),
          ) ?? "h.onPeek",
          createMockInput({ functionSignatures, callbackTypes }),
        ),
        createMockInput({ functionSignatures, callbackTypes }),
        createMockState(),
        orchestrator,
        calleeType,
      );

      expect(result.code).toBe(expected);
    });
  });

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
        isKnownStruct: vi.fn(() => false), // typedef pointer is not a struct
        isIntegerType: vi.fn(() => false),
        isFloatType: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "create_handle",
        planArguments(orchestrator, argExpressions, "create_handle", input),
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
        isKnownStruct: vi.fn(() => false),
        isIntegerType: vi.fn(() => false), // uint8_t is C type, not in INTEGER_TYPES
        isFloatType: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "send_data",
        planArguments(orchestrator, argExpressions, "send_data", input),
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
        isKnownStruct: vi.fn(() => false),
        isIntegerType: vi.fn(() => false),
        isFloatType: vi.fn(() => false),
      });

      const result = generateFunctionCall(
        "use_handle",
        planArguments(orchestrator, argExpressions, "use_handle", input),
        input,
        state,
        orchestrator,
      );

      expect(result.code).toBe("use_handle(my_handle)");
    });
  });
});
