import { describe, it, expect, vi } from "vitest";
import switchGenerators from "../SwitchGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";

const {
  generateSwitch,
  generateSwitchCase,
  generateCaseLabel,
  generateDefaultCase,
} = switchGenerators;

// ========================================================================
// Test Helpers - Mock Contexts
// ========================================================================

/**
 * Create a mock case label context with a qualified type (e.g., State.IDLE)
 */
function createQualifiedTypeCaseLabel(
  parts: string[],
): Parser.CaseLabelContext {
  return {
    qualifiedType: () => ({
      IDENTIFIER: () => parts.map((p) => ({ getText: () => p })),
    }),
    IDENTIFIER: () => null,
    INTEGER_LITERAL: () => null,
    HEX_LITERAL: () => null,
    BINARY_LITERAL: () => null,
    CHAR_LITERAL: () => null,
    children: null,
    start: { line: 1, column: 0 },
  } as unknown as Parser.CaseLabelContext;
}

/**
 * Create a mock case label context with an identifier
 */
function createIdentifierCaseLabel(
  id: string,
  line = 1,
  col = 0,
): Parser.CaseLabelContext {
  return {
    qualifiedType: () => null,
    IDENTIFIER: () => ({ getText: () => id }),
    INTEGER_LITERAL: () => null,
    HEX_LITERAL: () => null,
    BINARY_LITERAL: () => null,
    CHAR_LITERAL: () => null,
    children: null,
    start: { line, column: col },
  } as unknown as Parser.CaseLabelContext;
}

/**
 * Create a mock case label context with an integer literal
 */
function createIntegerCaseLabel(
  value: string,
  hasNegative = false,
): Parser.CaseLabelContext {
  return {
    qualifiedType: () => null,
    IDENTIFIER: () => null,
    INTEGER_LITERAL: () => ({ getText: () => value }),
    HEX_LITERAL: () => null,
    BINARY_LITERAL: () => null,
    CHAR_LITERAL: () => null,
    children: hasNegative ? [{ getText: () => "-" }] : null,
    start: { line: 1, column: 0 },
  } as unknown as Parser.CaseLabelContext;
}

/**
 * Create a mock case label context with a hex literal
 */
function createHexCaseLabel(
  value: string,
  hasNegative = false,
): Parser.CaseLabelContext {
  return {
    qualifiedType: () => null,
    IDENTIFIER: () => null,
    INTEGER_LITERAL: () => null,
    HEX_LITERAL: () => ({ getText: () => value }),
    BINARY_LITERAL: () => null,
    CHAR_LITERAL: () => null,
    children: hasNegative ? [{ getText: () => "-" }] : null,
    start: { line: 1, column: 0 },
  } as unknown as Parser.CaseLabelContext;
}

/**
 * Create a mock case label context with a binary literal
 */
function createBinaryCaseLabel(
  value: string,
  hasNegative = false,
): Parser.CaseLabelContext {
  return {
    qualifiedType: () => null,
    IDENTIFIER: () => null,
    INTEGER_LITERAL: () => null,
    HEX_LITERAL: () => null,
    BINARY_LITERAL: () => ({ getText: () => value }),
    CHAR_LITERAL: () => null,
    children: hasNegative ? [{ getText: () => "-" }] : null,
    start: { line: 1, column: 0 },
  } as unknown as Parser.CaseLabelContext;
}

/**
 * Create a mock case label context with a character literal
 */
function createCharCaseLabel(value: string): Parser.CaseLabelContext {
  return {
    qualifiedType: () => null,
    IDENTIFIER: () => null,
    INTEGER_LITERAL: () => null,
    HEX_LITERAL: () => null,
    BINARY_LITERAL: () => null,
    CHAR_LITERAL: () => ({ getText: () => value }),
    children: null,
    start: { line: 1, column: 0 },
  } as unknown as Parser.CaseLabelContext;
}

/**
 * Create a mock statement context
 */
function createMockStatement(): Parser.StatementContext {
  return {} as Parser.StatementContext;
}

/**
 * Create a mock block context with statements
 */
function createMockBlock(
  statements: Parser.StatementContext[] = [],
): Parser.BlockContext {
  return {
    statement: () => statements,
  } as unknown as Parser.BlockContext;
}

/**
 * Create a mock switch case context
 */
function createMockSwitchCase(
  labels: Parser.CaseLabelContext[],
  statements: Parser.StatementContext[] = [],
): Parser.SwitchCaseContext {
  return {
    caseLabel: () => labels,
    block: () => createMockBlock(statements),
  } as unknown as Parser.SwitchCaseContext;
}

/**
 * Create a mock default case context
 */
function createMockDefaultCase(
  statements: Parser.StatementContext[] = [],
): Parser.DefaultCaseContext {
  return {
    block: () => createMockBlock(statements),
  } as unknown as Parser.DefaultCaseContext;
}

/**
 * Create a mock expression context
 */
function createMockExpression(): Parser.ExpressionContext {
  return {} as Parser.ExpressionContext;
}

/**
 * Create a mock switch statement context
 */
function createMockSwitchStatement(options: {
  cases?: Parser.SwitchCaseContext[];
  defaultCase?: Parser.DefaultCaseContext | null;
}): Parser.SwitchStatementContext {
  return {
    expression: createMockExpression,
    switchCase: () => options.cases ?? [],
    defaultCase: () => options.defaultCase ?? null,
  } as unknown as Parser.SwitchStatementContext;
}

// ========================================================================
// Test Helpers - Mock Input/State/Orchestrator
// ========================================================================

/**
 * Create minimal mock input.
 */
function createMockInput(options?: {
  enumMembers?: Map<string, Map<string, number>>;
}): IGeneratorInput {
  const enumMembers = options?.enumMembers ?? new Map();
  return {
    symbols: {
      enumMembers,
      knownScopes: new Set(),
      knownStructs: new Set(),
      knownRegisters: new Set(),
      knownEnums: new Set(enumMembers.keys()),
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
  } as unknown as IGeneratorInput;
}

/**
 * Create minimal mock state.
 */
function createMockState(): IGeneratorState {
  return {
    currentScope: null,
    indentLevel: 0,
    inFunctionBody: true,
    currentParameters: new Map(),
    localVariables: new Set(),
    localArrays: new Set(),
    expectedType: null,
    selfIncludeAdded: false,
  };
}

/**
 * Create mock orchestrator for SwitchGenerator.
 * Methods used:
 * - generateExpression(expr) - for switch expression
 * - validateSwitchStatement(node, expr) - validation
 * - getExpressionEnumType(expr) - enum type resolution
 * - indent(text) - indentation
 * - generateStatement(stmt) - for statements in blocks
 */
function createMockOrchestrator(options?: {
  exprCode?: string;
  enumType?: string | null;
  statementCode?: string;
  validateSwitchStatement?: (
    node: Parser.SwitchStatementContext,
    expr: Parser.ExpressionContext,
  ) => void;
}): IOrchestrator {
  const generateExpression = vi.fn(() => options?.exprCode ?? "state");
  const validateSwitchStatement =
    options?.validateSwitchStatement ?? vi.fn(() => undefined);
  const getExpressionEnumType = vi.fn(() => options?.enumType ?? null);
  const indent = vi.fn((text: string) => `    ${text}`);
  const generateStatement = vi.fn(() => options?.statementCode ?? "x = 1;");

  return {
    generateExpression,
    validateSwitchStatement,
    getExpressionEnumType,
    indent,
    generateStatement,
  } as unknown as IOrchestrator;
}

// ========================================================================
// Tests - generateCaseLabel
// ========================================================================

describe("SwitchGenerator", () => {
  describe("generateCaseLabel", () => {
    describe("qualified type labels", () => {
      it("converts qualified enum to C underscore format", () => {
        const ctx = createQualifiedTypeCaseLabel(["State", "IDLE"]);
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("State_IDLE");
        expect(result.effects).toEqual([]);
      });

      it("handles multi-part qualified names", () => {
        const ctx = createQualifiedTypeCaseLabel(["Motor", "State", "RUNNING"]);
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("Motor_State_RUNNING");
      });
    });

    describe("identifier labels", () => {
      it("passes through plain identifiers (const variables)", () => {
        const ctx = createIdentifierCaseLabel("MAX_VALUE");
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("MAX_VALUE");
      });

      it("resolves unqualified enum member with type prefix (Issue #471)", () => {
        const ctx = createIdentifierCaseLabel("IDLE");
        const input = createMockInput({
          enumMembers: new Map([
            [
              "State",
              new Map([
                ["IDLE", 0],
                ["RUNNING", 1],
              ]),
            ],
          ]),
        });
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        // Pass switchEnumType to enable resolution
        const result = generateCaseLabel(
          ctx,
          input,
          state,
          orchestrator,
          "State",
        );

        expect(result.code).toBe("State_IDLE");
      });

      it("throws for unqualified enum member when switch is not on enum (Issue #477)", () => {
        const ctx = createIdentifierCaseLabel("IDLE", 5, 10);
        const input = createMockInput({
          enumMembers: new Map([["State", new Map([["IDLE", 0]])]]),
        });
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        // No switchEnumType - switching on non-enum
        expect(() =>
          generateCaseLabel(ctx, input, state, orchestrator),
        ).toThrow(
          "5:10 error[E0424]: 'IDLE' is not defined; did you mean 'State.IDLE'?",
        );
      });

      it("suggests multiple enums when identifier exists in multiple", () => {
        const ctx = createIdentifierCaseLabel("ACTIVE", 3, 5);
        const input = createMockInput({
          enumMembers: new Map([
            ["Mode", new Map([["ACTIVE", 1]])],
            ["Status", new Map([["ACTIVE", 2]])],
          ]),
        });
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        expect(() =>
          generateCaseLabel(ctx, input, state, orchestrator),
        ).toThrow("exists in: Mode, Status. Use qualified access.");
      });
    });

    describe("integer literals", () => {
      it("handles positive integer literal", () => {
        const ctx = createIntegerCaseLabel("42");
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("42");
      });

      it("handles negative integer literal", () => {
        const ctx = createIntegerCaseLabel("5", true);
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("-5");
      });

      it("handles zero", () => {
        const ctx = createIntegerCaseLabel("0");
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("0");
      });
    });

    describe("hex literals", () => {
      it("handles hex literal", () => {
        const ctx = createHexCaseLabel("0xFF");
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("0xFF");
      });

      it("handles negative hex literal", () => {
        const ctx = createHexCaseLabel("0x10", true);
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("-0x10");
      });
    });

    describe("binary literals", () => {
      it("converts binary to hex", () => {
        const ctx = createBinaryCaseLabel("0b1010");
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("0xA");
      });

      it("converts negative binary to negative hex", () => {
        const ctx = createBinaryCaseLabel("0b1111", true);
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("-0xF");
      });

      it("adds ULL suffix for large binary values (Issue #114)", () => {
        // Value > 0xFFFFFFFF requires ULL suffix
        const ctx = createBinaryCaseLabel(
          "0b100000000000000000000000000000000",
        ); // 2^32
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toContain("ULL");
        expect(result.code).toBe("0x100000000ULL");
      });

      it("does not add ULL for values within 32-bit range", () => {
        const ctx = createBinaryCaseLabel("0b11111111111111111111111111111111"); // 0xFFFFFFFF
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).not.toContain("ULL");
        expect(result.code).toBe("0xFFFFFFFF");
      });
    });

    describe("character literals", () => {
      it("handles character literal", () => {
        const ctx = createCharCaseLabel("'A'");
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("'A'");
      });

      it("handles escape sequence character", () => {
        const ctx = createCharCaseLabel("'\\n'");
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("'\\n'");
      });
    });

    describe("empty case", () => {
      it("returns empty string for unknown label type", () => {
        const ctx = {
          qualifiedType: () => null,
          IDENTIFIER: () => null,
          INTEGER_LITERAL: () => null,
          HEX_LITERAL: () => null,
          BINARY_LITERAL: () => null,
          CHAR_LITERAL: () => null,
          children: null,
          start: { line: 1, column: 0 },
        } as unknown as Parser.CaseLabelContext;
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator();

        const result = generateCaseLabel(ctx, input, state, orchestrator);

        expect(result.code).toBe("");
      });
    });
  });

  // ========================================================================
  // Tests - generateSwitchCase
  // ========================================================================

  describe("generateSwitchCase", () => {
    it("generates single case with block", () => {
      const label = createIntegerCaseLabel("1");
      const ctx = createMockSwitchCase([label], [createMockStatement()]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ statementCode: "x = 1;" });

      const result = generateSwitchCase(ctx, input, state, orchestrator);

      expect(result.code).toContain("case 1: {");
      expect(result.code).toContain("x = 1;");
      expect(result.code).toContain("break;");
      expect(result.code).toContain("}");
    });

    it("generates multiple labels for fall-through (|| expansion)", () => {
      const label1 = createIntegerCaseLabel("1");
      const label2 = createIntegerCaseLabel("2");
      const label3 = createIntegerCaseLabel("3");
      const ctx = createMockSwitchCase(
        [label1, label2, label3],
        [createMockStatement()],
      );
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        statementCode: "handle();",
      });

      const result = generateSwitchCase(ctx, input, state, orchestrator);

      // First two are fall-through labels (no block)
      expect(result.code).toContain("case 1:");
      expect(result.code).toContain("case 2:");
      // Last one has the block
      expect(result.code).toContain("case 3: {");
      expect(result.code).toContain("handle();");
      expect(result.code).toContain("break;");
    });

    it("passes switchEnumType to case label generation", () => {
      const label = createIdentifierCaseLabel("IDLE");
      const ctx = createMockSwitchCase([label], []);
      const input = createMockInput({
        enumMembers: new Map([["State", new Map([["IDLE", 0]])]]),
      });
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateSwitchCase(
        ctx,
        input,
        state,
        orchestrator,
        "State",
      );

      expect(result.code).toContain("case State_IDLE: {");
    });

    it("handles empty block (no statements)", () => {
      const label = createIntegerCaseLabel("0");
      const ctx = createMockSwitchCase([label], []);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateSwitchCase(ctx, input, state, orchestrator);

      expect(result.code).toContain("case 0: {");
      expect(result.code).toContain("break;");
      expect(result.code).toContain("}");
    });

    it("generates multiple statements in block", () => {
      const label = createIntegerCaseLabel("5");
      const ctx = createMockSwitchCase(
        [label],
        [createMockStatement(), createMockStatement(), createMockStatement()],
      );
      const input = createMockInput();
      const state = createMockState();
      let callCount = 0;
      const statementCodes = ["a = 1;", "b = 2;", "c = 3;"];
      const orchestrator = {
        indent: (text: string) => `    ${text}`,
        generateStatement: vi.fn(() => statementCodes[callCount++]),
      } as unknown as IOrchestrator;

      const result = generateSwitchCase(ctx, input, state, orchestrator);

      expect(result.code).toContain("a = 1;");
      expect(result.code).toContain("b = 2;");
      expect(result.code).toContain("c = 3;");
    });
  });

  // ========================================================================
  // Tests - generateDefaultCase
  // ========================================================================

  describe("generateDefaultCase", () => {
    it("generates default case with block", () => {
      const ctx = createMockDefaultCase([createMockStatement()]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        statementCode: "error();",
      });

      const result = generateDefaultCase(ctx, input, state, orchestrator);

      expect(result.code).toContain("default: {");
      expect(result.code).toContain("error();");
      expect(result.code).toContain("break;");
      expect(result.code).toContain("}");
    });

    it("handles empty default block", () => {
      const ctx = createMockDefaultCase([]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateDefaultCase(ctx, input, state, orchestrator);

      expect(result.code).toContain("default: {");
      expect(result.code).toContain("break;");
      expect(result.code).toContain("}");
    });

    it("returns empty effects", () => {
      const ctx = createMockDefaultCase([]);
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateDefaultCase(ctx, input, state, orchestrator);

      expect(result.effects).toEqual([]);
    });
  });

  // ========================================================================
  // Tests - generateSwitch
  // ========================================================================

  describe("generateSwitch", () => {
    it("generates basic switch statement", () => {
      const caseCtx = createMockSwitchCase([createIntegerCaseLabel("1")], []);
      const ctx = createMockSwitchStatement({ cases: [caseCtx] });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ exprCode: "value" });

      const result = generateSwitch(ctx, input, state, orchestrator);

      expect(result.code).toContain("switch (value) {");
      expect(result.code).toContain("case 1: {");
      expect(result.code).toContain("}");
    });

    it("generates switch with multiple cases", () => {
      const case1 = createMockSwitchCase([createIntegerCaseLabel("0")], []);
      const case2 = createMockSwitchCase([createIntegerCaseLabel("1")], []);
      const ctx = createMockSwitchStatement({ cases: [case1, case2] });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ exprCode: "state" });

      const result = generateSwitch(ctx, input, state, orchestrator);

      expect(result.code).toContain("switch (state) {");
      expect(result.code).toContain("case 0: {");
      expect(result.code).toContain("case 1: {");
    });

    it("generates switch with default case", () => {
      const caseCtx = createMockSwitchCase([createIntegerCaseLabel("1")], []);
      const defaultCtx = createMockDefaultCase([]);
      const ctx = createMockSwitchStatement({
        cases: [caseCtx],
        defaultCase: defaultCtx,
      });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ exprCode: "x" });

      const result = generateSwitch(ctx, input, state, orchestrator);

      expect(result.code).toContain("switch (x) {");
      expect(result.code).toContain("case 1: {");
      expect(result.code).toContain("default: {");
    });

    it("calls validateSwitchStatement", () => {
      const ctx = createMockSwitchStatement({ cases: [] });
      const input = createMockInput();
      const state = createMockState();
      const validateSwitchStatement = vi.fn();
      const orchestrator = createMockOrchestrator({ validateSwitchStatement });

      generateSwitch(ctx, input, state, orchestrator);

      expect(validateSwitchStatement).toHaveBeenCalledOnce();
    });

    it("throws when validation fails", () => {
      const ctx = createMockSwitchStatement({ cases: [] });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        validateSwitchStatement: () => {
          throw new Error("Error: switch requires at least one case");
        },
      });

      expect(() => generateSwitch(ctx, input, state, orchestrator)).toThrow(
        "switch requires at least one case",
      );
    });

    it("uses enum type from expression for case resolution (Issue #471)", () => {
      const caseCtx = createMockSwitchCase(
        [createIdentifierCaseLabel("IDLE")],
        [],
      );
      const ctx = createMockSwitchStatement({ cases: [caseCtx] });
      const input = createMockInput({
        enumMembers: new Map([["State", new Map([["IDLE", 0]])]]),
      });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        exprCode: "currentState",
        enumType: "State",
      });

      const result = generateSwitch(ctx, input, state, orchestrator);

      expect(result.code).toContain("switch (currentState) {");
      expect(result.code).toContain("case State_IDLE: {");
    });

    it("calls getExpressionEnumType to determine switch type", () => {
      const ctx = createMockSwitchStatement({ cases: [] });
      const input = createMockInput();
      const state = createMockState();
      const getExpressionEnumType = vi.fn(() => null);
      const orchestrator = {
        generateExpression: vi.fn(() => "x"),
        validateSwitchStatement: vi.fn(),
        getExpressionEnumType,
        indent: (t: string) => `    ${t}`,
      } as unknown as IOrchestrator;

      generateSwitch(ctx, input, state, orchestrator);

      expect(getExpressionEnumType).toHaveBeenCalledOnce();
    });

    it("returns empty effects when no effects from cases", () => {
      const caseCtx = createMockSwitchCase([createIntegerCaseLabel("1")], []);
      const ctx = createMockSwitchStatement({ cases: [caseCtx] });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateSwitch(ctx, input, state, orchestrator);

      expect(result.effects).toEqual([]);
    });
  });
});
