/**
 * Unit tests for VariableDeclHelper
 *
 * Issue #792: Tests for extracted variable declaration logic
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import VariableDeclHelper from "../VariableDeclHelper";
import CodeGenState from "../../../../../transpiler/state/CodeGenState";
import CNextSourceParser from "../../../../../PARSE/2-Parse/CNextSourceParser";
import * as Parser from "../../../../../PARSE/2-Parse/grammar/CNextParser";

/**
 * Helper to parse a variable declaration from source code.
 */
function parseVarDecl(source: string): Parser.VariableDeclarationContext {
  const result = CNextSourceParser.parse(source);
  const decl = result.tree.declaration(0);
  const varDecl = decl?.variableDeclaration();
  if (!varDecl) {
    throw new Error(`Failed to parse variable declaration from: ${source}`);
  }
  return varDecl;
}

/**
 * Helper to parse a type context from source code.
 */
function parseType(source: string): Parser.TypeContext {
  const varDecl = parseVarDecl(source);
  return varDecl.type();
}

describe("VariableDeclHelper", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  // ========================================================================
  // Tier 1: Pure Utilities
  // ========================================================================

  describe("parseArrayTypeDimension", () => {
    it.each([
      ["non-array types", "u8 x;", null],
      ["literal array type", "u8[10] x;", 10],
      ["empty array dimension", "u8[] x;", null],
      ["expression dimension", "u8[SIZE] x;", null],
    ])("parseArrayTypeDimension returns %s", (_label, source, expected) => {
      // toBeNull() is toBe(null), so the numeric row belongs in the same table
      // rather than sitting between the null rows as SonarCloud grouped it.
      expect(
        VariableDeclHelper.parseArrayTypeDimension(parseType(source)),
      ).toBe(expected);
    });
  });

  describe("parseFirstArrayDimension", () => {
    it("returns null for empty array", () => {
      expect(VariableDeclHelper.parseFirstArrayDimension([])).toBeNull();
    });

    it("returns null for empty dimension expression", () => {
      const varDecl = parseVarDecl("u8 x[];");
      const dims = varDecl.arrayDimension();
      expect(VariableDeclHelper.parseFirstArrayDimension(dims)).toBeNull();
    });

    it("returns numeric value for literal dimension", () => {
      // Note: arrayTypeDimension != arrayDimension, so we test with arrayDimension
      const varDecl = parseVarDecl("u8 x[5];");
      const arrayDims = varDecl.arrayDimension();
      expect(VariableDeclHelper.parseFirstArrayDimension(arrayDims)).toBe(5);
    });

    it("returns null for expression dimension", () => {
      const varDecl = parseVarDecl("u8 x[SIZE];");
      const dims = varDecl.arrayDimension();
      expect(VariableDeclHelper.parseFirstArrayDimension(dims)).toBeNull();
    });
  });

  // ========================================================================
  // Tier 2: Simple Operations
  // ========================================================================

  // #1322: the `validateIntegerInitializer` suite that stood here is gone with the method. ADR-024's
  // rules are E0868/E0869 in pass 2.1, covered by
  // `1-Analyze/__tests__/IntegerConversionAnalyzer.test.ts` against real source
  // rather than a text API.

  // ========================================================================
  // Tier 3b: ADR-045 string planning (#1445 box 3)
  // ========================================================================

  describe("planStringDecl", () => {
    /**
     * A full `IVariableDeclCallbacks`. The planner needs four of these; the
     * rest are present because the interface requires them, and each throws so
     * a path that starts calling one fails loudly instead of reading a stub.
     */
    function stubCallbacks(
      overrides: Partial<Record<string, unknown>> = {},
    ): Parameters<typeof VariableDeclHelper.planStringDecl>[3] {
      const unused = (name: string) => () => {
        throw new Error(`planStringDecl must not call ${name}`);
      };
      return {
        generateExpression: (ctx: Parser.ExpressionContext) => ctx.getText(),
        generateArrayDimensions: (dims: Parser.ArrayDimensionContext[]) =>
          dims.map((d) => `[${d.expression()?.getText() ?? ""}]`).join(""),
        getStringConcatOperands: () => null,
        getSubstringOperands: () => null,
        generateType: unused("generateType"),
        getTypeName: unused("getTypeName"),
        tryEvaluateConstant: unused("tryEvaluateConstant"),
        getZeroInitializer: unused("getZeroInitializer"),
        getExpressionType: unused("getExpressionType"),
        inferVariableType: unused("inferVariableType"),
        trackLocalVariable: unused("trackLocalVariable"),
        markVariableAsPointer: unused("markVariableAsPointer"),
        ...overrides,
      } as Parameters<typeof VariableDeclHelper.planStringDecl>[3];
    }

    function plan(source: string, overrides = {}) {
      const varDecl = parseVarDecl(source);
      return VariableDeclHelper.planStringDecl(
        varDecl.type(),
        varDecl.expression() ?? null,
        varDecl.arrayDimension(),
        stubCallbacks(overrides),
      );
    }

    it("returns null for a declaration that is not a string", () => {
      expect(plan("u8 x;")).toBeNull();
    });

    it("plans a bounded string without an initializer", () => {
      expect(plan("string<16> s;")).toEqual({
        kind: "bounded",
        capacity: 16,
        init: null,
      });
    });

    it("plans a bounded string with its initializer text", () => {
      const result = plan('string<16> s <- "hi";');
      expect(result?.kind).toBe("bounded");
      expect(result?.kind === "bounded" && result.init?.text).toBe('"hi"');
    });

    it("plans an unsized string, carrying the literal it infers from", () => {
      expect(plan('const string s <- "abc";')).toEqual({
        kind: "unsized",
        initText: '"abc"',
      });
    });

    it("plans an unsized string with no initializer as initText null", () => {
      expect(plan("const string s;")).toEqual({
        kind: "unsized",
        initText: null,
      });
    });

    it("plans a string array, rendering its dimensions", () => {
      expect(plan("string<32>[4] items;")).toMatchObject({
        kind: "array",
        elementCapacity: 32,
        dimensions: "[4]",
        declaredSize: 4,
        renderInit: null,
      });
    });

    // #1644: the declared size and the rendered dimension come from ONE
    // evaluator, so a hex spelling cannot fold in the declarator and fail to
    // fold for the fill-all expansion.
    it.each([
      ["hex", "string<32>[0x4] items;"],
      ["binary", "string<32>[0b100] items;"],
    ])(
      "folds a %s dimension for both the declarator and the size",
      (_l, src) => {
        expect(plan(src)).toMatchObject({ dimensions: "[4]", declaredSize: 4 });
      },
    );

    it("appends trailing declaration dimensions to the type's own", () => {
      expect(plan("string<10>[2] matrix[3];")).toMatchObject({
        dimensions: "[2][3]",
      });
    });

    it("asserts the invariant for an unsized string array", () => {
      expect(() => plan("string[4] items;")).toThrow(
        "a string array states its element capacity",
      );
    });

    // The plan is built where `generateStringDecl` used to be called, so the
    // effects it raises must be the ones that call raised. Asking for a
    // substring generates index expressions and rendering generates the whole
    // initializer -- neither may happen until the renderer takes that arm.
    it("does not render the initializer or ask for a substring at plan time", () => {
      const getSubstringOperands = vi.fn(() => null);
      const generateExpression = vi.fn(() => "rendered");
      const result = plan("string<16> s <- src[0, 5];", {
        getSubstringOperands,
        generateExpression,
      });

      expect(getSubstringOperands).not.toHaveBeenCalled();
      expect(generateExpression).not.toHaveBeenCalled();

      expect(result?.kind === "bounded" && result.init?.renderSubstring()).toBe(
        null,
      );
      expect(getSubstringOperands).toHaveBeenCalledTimes(1);
    });

    it("asks for concatenation operands eagerly, exactly once", () => {
      const getStringConcatOperands = vi.fn(() => null);
      plan("string<16> s <- a + b;", { getStringConcatOperands });

      expect(getStringConcatOperands).toHaveBeenCalledTimes(1);
    });
  });

  describe("finalizeCppClassAssignments", () => {
    beforeEach(() => {
      CodeGenState.reset();
    });

    it("returns simple declaration with semicolon when no pending assignments", () => {
      const result = VariableDeclHelper.finalizeCppClassAssignments(
        "x",
        "MyClass x",
      );
      expect(result).toBe("MyClass x;");
    });

    it("appends assignments in function body", () => {
      CodeGenState.inFunctionBody = true;
      CodeGenState.pendingCppClassAssignments = ["field1 = value1"];

      const result = VariableDeclHelper.finalizeCppClassAssignments(
        "x",
        "MyClass x",
      );

      expect(result).toBe("MyClass x;\nx.field1 = value1");
      expect(CodeGenState.pendingCppClassAssignments).toHaveLength(0);
    });

    it("asserts a pending assignment outside a function body cannot reach here", () => {
      // #1322: this asserted the E0508 rejection, which reported `1:0` against
      // whichever declaration happened to drain the queue rather than the
      // initializer that filled it. Pass 2.1 rejects it at the initializer.
      CodeGenState.inFunctionBody = false;
      CodeGenState.pendingCppClassAssignments = ["field1 = value1"];

      expect(() => {
        VariableDeclHelper.finalizeCppClassAssignments("x", "MyClass x");
      }).toThrow("E0508 rejects this in pass 2.1");
    });
  });

  // ========================================================================
  // Tier 3: Complex Operations
  // ========================================================================

  describe("getArrayTypeDimension", () => {
    it("returns empty string for non-array type", () => {
      const typeCtx = parseType("u8 x;");
      const result = VariableDeclHelper.getArrayTypeDimension(typeCtx, {
        tryEvaluateConstant: () => undefined,
        generateExpression: (ctx) => ctx.getText(),
      });
      expect(result).toBe("");
    });

    it("returns dimension string for literal", () => {
      const typeCtx = parseType("u8[10] x;");
      const result = VariableDeclHelper.getArrayTypeDimension(typeCtx, {
        tryEvaluateConstant: () => 10,
        generateExpression: (ctx) => ctx.getText(),
      });
      expect(result).toBe("[10]");
    });

    it("returns empty bracket for unsized dimension", () => {
      const typeCtx = parseType("u8[] x;");
      const result = VariableDeclHelper.getArrayTypeDimension(typeCtx, {
        tryEvaluateConstant: () => undefined,
        generateExpression: (ctx) => ctx.getText(),
      });
      expect(result).toBe("[]");
    });

    it("falls back to expression for non-const", () => {
      const typeCtx = parseType("u8[SIZE] x;");
      const result = VariableDeclHelper.getArrayTypeDimension(typeCtx, {
        tryEvaluateConstant: () => undefined,
        generateExpression: () => "SIZE",
      });
      expect(result).toBe("[SIZE]");
    });
  });

  describe("handleArrayDeclaration", () => {
    beforeEach(() => {
      CodeGenState.reset();
    });

    it("returns not handled for non-array", () => {
      const varDecl = parseVarDecl("u8 x;");
      const typeCtx = varDecl.type();
      const result = VariableDeclHelper.handleArrayDeclaration(
        varDecl,
        typeCtx,
        "x",
        "uint8_t x",
        {
          generateExpression: (ctx) => ctx.getText(),
          getTypeName: () => "u8",
          generateArrayDimensions: () => "",
          tryEvaluateConstant: () => undefined,
        },
      );
      expect(result.handled).toBe(false);
      expect(result.isArray).toBe(false);
    });

    it("returns array with dimension for C-Next style", () => {
      const varDecl = parseVarDecl("u8[10] arr;");
      const typeCtx = varDecl.type();
      const result = VariableDeclHelper.handleArrayDeclaration(
        varDecl,
        typeCtx,
        "arr",
        "uint8_t arr",
        {
          generateExpression: (ctx) => ctx.getText(),
          getTypeName: () => "u8",
          generateArrayDimensions: () => "",
          tryEvaluateConstant: () => 10,
        },
      );
      expect(result.handled).toBe(false);
      expect(result.isArray).toBe(true);
      expect(result.decl).toBe("uint8_t arr[10]");
    });
  });

  describe("generateVariableInitializer", () => {
    beforeEach(() => {
      CodeGenState.reset();
    });

    it("returns zero initializer for uninitialized variable", () => {
      const varDecl = parseVarDecl("u8 x;");
      const typeCtx = varDecl.type();
      const result = VariableDeclHelper.generateVariableInitializer(
        varDecl,
        typeCtx,
        "uint8_t x",
        false,
        {
          generateExpression: (ctx) => ctx.getText(),
          getTypeName: () => "u8",
          getZeroInitializer: () => "0",
          getExpressionType: () => "u8",
        },
      );
      expect(result).toBe("uint8_t x = 0");
    });

    it("generates expression for initialized variable", () => {
      const varDecl = parseVarDecl("u8 x <- 42;");
      const typeCtx = varDecl.type();
      const result = VariableDeclHelper.generateVariableInitializer(
        varDecl,
        typeCtx,
        "uint8_t x",
        false,
        {
          generateExpression: () => "42",
          getTypeName: () => "u8",
          getZeroInitializer: () => "0",
          getExpressionType: () => "u8",
        },
      );
      expect(result).toBe("uint8_t x = 42");
    });
  });

  // ========================================================================
  // Tier 4: Orchestrators
  // ========================================================================

  describe("generateConstructorDecl", () => {
    beforeEach(() => {
      CodeGenState.reset();
      // Set up a const variable in the type registry for constructor argument
      CodeGenState.setVariableTypeInfo("pinConst", {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        arrayDimensions: [],
        isConst: true,
      });
    });

    it("generates constructor declaration with const args", () => {
      const varDecl = parseVarDecl("MAX31856 thermo(pinConst);");
      const argListCtx = varDecl.constructorArgumentList()!;

      const result = VariableDeclHelper.generateConstructorDecl(
        varDecl,
        argListCtx,
        { generateType: () => "MAX31856" },
      );

      expect(result).toBe("MAX31856 thermo(pinConst);");
    });

    // #1322: this drove codegen directly with an argument pass 2.1 now
    // rejects (E0432 / E0433), so the pipeline halts before this code runs.
    // The rule is covered by
    // `1-Analyze/__tests__/ConstructorArgumentAnalyzer.test.ts` and by
    // `tests/constructor-syntax/error-non-const-arg` and
    // `error-undeclared-arg`, which now assert a real position.

    // #1322: this drove codegen directly with an argument pass 2.1 now
    // rejects (E0432 / E0433), so the pipeline halts before this code runs.
    // The rule is covered by
    // `1-Analyze/__tests__/ConstructorArgumentAnalyzer.test.ts` and by
    // `tests/constructor-syntax/error-non-const-arg` and
    // `error-undeclared-arg`, which now assert a real position.

    it("tracks the variable in type registry", () => {
      const varDecl = parseVarDecl("MAX31856 thermo(pinConst);");
      const argListCtx = varDecl.constructorArgumentList()!;

      VariableDeclHelper.generateConstructorDecl(varDecl, argListCtx, {
        generateType: () => "MAX31856",
      });

      const typeInfo = CodeGenState.getVariableTypeInfo("thermo");
      expect(typeInfo).toBeDefined();
      expect(typeInfo!.baseType).toBe("MAX31856");
      expect(typeInfo!.isExternalCppType).toBe(true);
    });
  });
});
