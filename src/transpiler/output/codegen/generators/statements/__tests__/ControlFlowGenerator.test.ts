import { describe, it, expect, vi } from "vitest";
import controlFlowGenerators from "../ControlFlowGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import * as Parser from "../../../../../logic/parser/grammar/CNextParser";

const {
  generateReturn,
  generateIf,
  generateWhile,
  generateDoWhile,
  generateFor,
  generateForVarDecl,
  generateForAssignment,
} = controlFlowGenerators;

// ========================================================================
// Test Helpers - Mock Contexts
// ========================================================================

/**
 * Create a mock expression context. Can be configured to be "simple" or "complex".
 * For simple: navigates down the chain to a simple identifier
 */
function createMockExpression(options?: {
  text?: string;
  isSimple?: boolean;
  identifier?: string;
  hasPostfixOp?: boolean;
  line?: number;
  col?: number;
}): Parser.ExpressionContext {
  const text = options?.text ?? "x";
  const isSimple = options?.isSimple ?? true;
  const identifier = options?.identifier ?? text;

  // Build a mock expression tree that the isSimpleExpression/getSimpleIdentifier functions can navigate
  if (isSimple) {
    const primaryExpr = {
      IDENTIFIER: () => ({ getText: () => identifier }),
      getText: () => text,
    };
    const postfixExpr = {
      primaryExpression: () => primaryExpr,
      postfixOp: () => (options?.hasPostfixOp ? [{}] : []),
    };
    const unaryExpr = { postfixExpression: () => postfixExpr };
    const mulExpr = { unaryExpression: () => [unaryExpr] };
    const addExpr = { multiplicativeExpression: () => [mulExpr] };
    const shiftExpr = { additiveExpression: () => [addExpr] };
    const bandExpr = { shiftExpression: () => [shiftExpr] };
    const bxorExpr = { bitwiseAndExpression: () => [bandExpr] };
    const borExpr = { bitwiseXorExpression: () => [bxorExpr] };
    const relExpr = { bitwiseOrExpression: () => [borExpr] };
    const eqExpr = { relationalExpression: () => [relExpr] };
    const andExpr = { equalityExpression: () => [eqExpr] };
    const orExpr = { andExpression: () => [andExpr] };
    const ternaryExpr = { orExpression: () => [orExpr] };

    return {
      ternaryExpression: () => ternaryExpr,
      getText: () => text,
      start: { line: options?.line ?? 1, column: options?.col ?? 0 },
    } as unknown as Parser.ExpressionContext;
  }

  // Complex expression - multiple operands at some level
  const mulExpr1 = { unaryExpression: () => [{}, {}] }; // Two operands = complex
  const addExpr = { multiplicativeExpression: () => [mulExpr1] };
  const shiftExpr = { additiveExpression: () => [addExpr] };
  const bandExpr = { shiftExpression: () => [shiftExpr] };
  const bxorExpr = { bitwiseAndExpression: () => [bandExpr] };
  const borExpr = { bitwiseXorExpression: () => [bxorExpr] };
  const relExpr = { bitwiseOrExpression: () => [borExpr] };
  const eqExpr = { relationalExpression: () => [relExpr] };
  const andExpr = { equalityExpression: () => [eqExpr] };
  const orExpr = { andExpression: () => [andExpr] };
  const ternaryExpr = { orExpression: () => [orExpr] };

  return {
    ternaryExpression: () => ternaryExpr,
    getText: () => text,
    start: { line: options?.line ?? 1, column: options?.col ?? 0 },
  } as unknown as Parser.ExpressionContext;
}

/**
 * Create a mock return statement context
 */
function createMockReturnStatement(
  expr?: Parser.ExpressionContext,
): Parser.ReturnStatementContext {
  return {
    expression: () => expr ?? null,
  } as unknown as Parser.ReturnStatementContext;
}

/**
 * Create a mock statement context
 */
function createMockStatement(
  blockCtx?: Parser.BlockContext,
): Parser.StatementContext {
  return {
    block: () => blockCtx ?? null,
  } as unknown as Parser.StatementContext;
}

/**
 * Create a mock block context
 */
function createMockBlock(): Parser.BlockContext {
  return {
    statement: () => [],
  } as unknown as Parser.BlockContext;
}

/**
 * Create a mock if statement context
 */
function createMockIfStatement(options?: {
  expr?: Parser.ExpressionContext;
  thenStmt?: Parser.StatementContext;
  elseStmt?: Parser.StatementContext;
}): Parser.IfStatementContext {
  const statements = [options?.thenStmt ?? createMockStatement()];
  if (options?.elseStmt) {
    statements.push(options.elseStmt);
  }
  return {
    expression: () => options?.expr ?? createMockExpression(),
    statement: () => statements,
  } as unknown as Parser.IfStatementContext;
}

/**
 * Create a mock while statement context
 */
function createMockWhileStatement(options?: {
  expr?: Parser.ExpressionContext;
  stmt?: Parser.StatementContext;
}): Parser.WhileStatementContext {
  return {
    expression: () => options?.expr ?? createMockExpression(),
    statement: () => options?.stmt ?? createMockStatement(),
  } as unknown as Parser.WhileStatementContext;
}

/**
 * Create a mock do-while statement context
 */
function createMockDoWhileStatement(options?: {
  expr?: Parser.ExpressionContext;
  block?: Parser.BlockContext;
}): Parser.DoWhileStatementContext {
  return {
    expression: () => options?.expr ?? createMockExpression(),
    block: () => options?.block ?? createMockBlock(),
  } as unknown as Parser.DoWhileStatementContext;
}

/**
 * Create a mock type context
 */
function createMockType(typeName: string): Parser.TypeContext {
  return {
    getText: () => typeName,
  } as unknown as Parser.TypeContext;
}

/**
 * Create a mock for variable declaration context
 */
function createMockForVarDecl(options?: {
  type?: Parser.TypeContext;
  identifier?: string;
  expr?: Parser.ExpressionContext;
  atomicMod?: boolean;
  volatileMod?: boolean;
  arrayDims?: Parser.ArrayDimensionContext[];
}): Parser.ForVarDeclContext {
  return {
    atomicModifier: () => (options?.atomicMod ? {} : null),
    volatileModifier: () => (options?.volatileMod ? {} : null),
    type: () => options?.type ?? createMockType("i32"),
    IDENTIFIER: () => ({ getText: () => options?.identifier ?? "i" }),
    arrayDimension: () => options?.arrayDims ?? [],
    expression: () => options?.expr ?? null,
  } as unknown as Parser.ForVarDeclContext;
}

/**
 * Create a mock assignment target context
 */
function createMockAssignmentTarget(
  text: string,
): Parser.AssignmentTargetContext {
  return {
    getText: () => text,
  } as unknown as Parser.AssignmentTargetContext;
}

/**
 * Create a mock assignment operator context
 */
function createMockAssignmentOperator(
  op: string,
): Parser.AssignmentOperatorContext {
  return {
    getText: () => op,
  } as unknown as Parser.AssignmentOperatorContext;
}

/**
 * Create a mock for assignment context
 */
function createMockForAssignment(options?: {
  target?: Parser.AssignmentTargetContext;
  operator?: Parser.AssignmentOperatorContext;
  expr?: Parser.ExpressionContext;
}): Parser.ForAssignmentContext {
  return {
    assignmentTarget: () => options?.target ?? createMockAssignmentTarget("i"),
    assignmentOperator: () =>
      options?.operator ?? createMockAssignmentOperator("<-"),
    expression: () => options?.expr ?? createMockExpression(),
  } as unknown as Parser.ForAssignmentContext;
}

/**
 * Create a mock for init context
 */
function createMockForInit(options?: {
  varDecl?: Parser.ForVarDeclContext;
  assignment?: Parser.ForAssignmentContext;
}): Parser.ForInitContext {
  return {
    forVarDecl: () => options?.varDecl ?? null,
    forAssignment: () => options?.assignment ?? null,
  } as unknown as Parser.ForInitContext;
}

/**
 * Create a mock for update context
 */
function createMockForUpdate(options?: {
  target?: Parser.AssignmentTargetContext;
  operator?: Parser.AssignmentOperatorContext;
  expr?: Parser.ExpressionContext;
}): Parser.ForUpdateContext {
  return {
    assignmentTarget: () => options?.target ?? createMockAssignmentTarget("i"),
    assignmentOperator: () =>
      options?.operator ?? createMockAssignmentOperator("+<-"),
    expression: () => options?.expr ?? createMockExpression({ text: "1" }),
  } as unknown as Parser.ForUpdateContext;
}

/**
 * Create a mock for statement context
 */
function createMockForStatement(options?: {
  init?: Parser.ForInitContext;
  expr?: Parser.ExpressionContext;
  update?: Parser.ForUpdateContext;
  stmt?: Parser.StatementContext;
}): Parser.ForStatementContext {
  return {
    forInit: () => options?.init ?? null,
    expression: () => options?.expr ?? null,
    forUpdate: () => options?.update ?? null,
    statement: () => options?.stmt ?? createMockStatement(),
  } as unknown as Parser.ForStatementContext;
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
 * Create mock orchestrator for control flow generators.
 */
function createMockOrchestrator(options?: {
  returnType?: string | null;
  exprCode?: string;
  statementCode?: string;
  blockCode?: string;
  typeCode?: string;
  tempDeclarations?: string;
  lengthCacheDecls?: string;
}): IOrchestrator {
  return {
    getCurrentFunctionReturnType: vi.fn(() => options?.returnType ?? null),
    generateExpression: vi.fn(() => options?.exprCode ?? "x"),
    generateExpressionWithExpectedType: vi.fn(() => options?.exprCode ?? "x"),
    generateStatement: vi.fn(() => options?.statementCode ?? "{}"),
    generateBlock: vi.fn(() => options?.blockCode ?? "{ }"),
    generateType: vi.fn(() => options?.typeCode ?? "int"),
    generateAssignmentTarget: vi.fn((ctx) => ctx.getText?.() ?? "target"),
    generateArrayDimensions: vi.fn(() => "[10]"),
    registerLocalVariable: vi.fn(),
    flushPendingTempDeclarations: vi.fn(() => options?.tempDeclarations ?? ""),
    validateConditionNoFunctionCall: vi.fn(),
    validateDoWhileCondition: vi.fn(),
    countStringLengthAccesses: vi.fn(() => new Map()),
    countBlockLengthAccesses: vi.fn(),
    setupLengthCache: vi.fn(() => options?.lengthCacheDecls ?? ""),
    clearLengthCache: vi.fn(),
  } as unknown as IOrchestrator;
}

// ========================================================================
// Tests - generateReturn
// ========================================================================

describe("ControlFlowGenerator", () => {
  describe("generateReturn", () => {
    it("generates simple return without expression", () => {
      const ctx = createMockReturnStatement();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateReturn(ctx, input, state, orchestrator);

      expect(result.code).toBe("return;");
      expect(result.effects).toEqual([]);
    });

    it("generates return with expression", () => {
      const ctx = createMockReturnStatement(
        createMockExpression({ text: "42" }),
      );
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ exprCode: "42" });

      const result = generateReturn(ctx, input, state, orchestrator);

      expect(result.code).toBe("return 42;");
    });

    it("uses expectedType when returning enum value (Issue #477)", () => {
      const ctx = createMockReturnStatement(
        createMockExpression({ text: "IDLE" }),
      );
      const input = createMockInput({
        enumMembers: new Map([["State", new Map([["IDLE", 0]])]]),
      });
      const state = createMockState();
      const generateExpressionWithExpectedType = vi.fn(() => "State_IDLE");
      const orchestrator = {
        ...createMockOrchestrator({ returnType: "State" }),
        generateExpressionWithExpectedType,
      } as unknown as IOrchestrator;

      const result = generateReturn(ctx, input, state, orchestrator);

      expect(generateExpressionWithExpectedType).toHaveBeenCalledWith(
        expect.anything(),
        "State",
      );
      expect(result.code).toBe("return State_IDLE;");
    });

    it("throws for unqualified enum member in non-enum return (Issue #477)", () => {
      const ctx = createMockReturnStatement(
        createMockExpression({ identifier: "IDLE", line: 10, col: 5 }),
      );
      const input = createMockInput({
        enumMembers: new Map([["State", new Map([["IDLE", 0]])]]),
      });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ returnType: "u8" }); // non-enum

      expect(() => generateReturn(ctx, input, state, orchestrator)).toThrow(
        "10:5 error[E0424]: 'IDLE' is not defined; did you mean 'State.IDLE'?",
      );
    });

    it("allows unqualified identifier that is not an enum member", () => {
      const ctx = createMockReturnStatement(
        createMockExpression({ identifier: "count" }),
      );
      const input = createMockInput({
        enumMembers: new Map([["State", new Map([["IDLE", 0]])]]),
      });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        returnType: "u32",
        exprCode: "count",
      });

      const result = generateReturn(ctx, input, state, orchestrator);

      expect(result.code).toBe("return count;");
    });

    it("does not throw for complex expressions containing enum-like identifiers", () => {
      // Complex expression (a + b) should not be checked for enum membership
      const ctx = createMockReturnStatement(
        createMockExpression({ text: "a + IDLE", isSimple: false }),
      );
      const input = createMockInput({
        enumMembers: new Map([["State", new Map([["IDLE", 0]])]]),
      });
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        returnType: "u32",
        exprCode: "a + IDLE",
      });

      // Should not throw because expression is complex
      const result = generateReturn(ctx, input, state, orchestrator);

      expect(result.code).toBe("return a + IDLE;");
    });
  });

  // ========================================================================
  // Tests - generateIf
  // ========================================================================

  describe("generateIf", () => {
    it("generates simple if statement", () => {
      const ctx = createMockIfStatement();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        exprCode: "flag",
        statementCode: "{ x = 1; }",
      });

      const result = generateIf(ctx, input, state, orchestrator);

      expect(result.code).toBe("if (flag) { x = 1; }");
    });

    it("generates if-else statement", () => {
      const ctx = createMockIfStatement({
        thenStmt: createMockStatement(),
        elseStmt: createMockStatement(),
      });
      const input = createMockInput();
      const state = createMockState();
      let stmtCount = 0;
      const orchestrator = {
        ...createMockOrchestrator({ exprCode: "x > 0" }),
        generateStatement: vi.fn(() =>
          stmtCount++ === 0 ? "{ a = 1; }" : "{ a = 2; }",
        ),
      } as unknown as IOrchestrator;

      const result = generateIf(ctx, input, state, orchestrator);

      expect(result.code).toBe("if (x > 0) { a = 1; } else { a = 2; }");
    });

    it("validates no function calls in condition (Issue #254)", () => {
      const expr = createMockExpression();
      const ctx = createMockIfStatement({ expr });
      const input = createMockInput();
      const state = createMockState();
      const validateConditionNoFunctionCall = vi.fn();
      const orchestrator = {
        ...createMockOrchestrator(),
        validateConditionNoFunctionCall,
      } as unknown as IOrchestrator;

      generateIf(ctx, input, state, orchestrator);

      expect(validateConditionNoFunctionCall).toHaveBeenCalledWith(expr, "if");
    });

    it("throws when validation fails (function in condition)", () => {
      const ctx = createMockIfStatement();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = {
        ...createMockOrchestrator(),
        validateConditionNoFunctionCall: () => {
          throw new Error("E0702: Function call not allowed in if condition");
        },
      } as unknown as IOrchestrator;

      expect(() => generateIf(ctx, input, state, orchestrator)).toThrow(
        "Function call not allowed in if condition",
      );
    });

    it("flushes temp declarations before branches (Issue #250)", () => {
      const ctx = createMockIfStatement();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        exprCode: "tmp_1",
        tempDeclarations: "int tmp_1 = getValue();",
        statementCode: "{ use(tmp_1); }",
      });

      const result = generateIf(ctx, input, state, orchestrator);

      expect(result.code).toContain("int tmp_1 = getValue();");
      expect(result.code).toContain("if (tmp_1)");
    });

    it("sets up strlen cache for length optimization", () => {
      const ctx = createMockIfStatement();
      const input = createMockInput();
      const state = createMockState();
      const setupLengthCache = vi.fn(() => "size_t __len_str = strlen(str);\n");
      const orchestrator = {
        ...createMockOrchestrator({ exprCode: "__len_str > 0" }),
        setupLengthCache,
        countStringLengthAccesses: vi.fn(() => new Map([["str", 2]])),
      } as unknown as IOrchestrator;

      const result = generateIf(ctx, input, state, orchestrator);

      expect(setupLengthCache).toHaveBeenCalled();
      expect(result.code).toContain("__len_str");
    });

    it("clears length cache after generating", () => {
      const ctx = createMockIfStatement();
      const input = createMockInput();
      const state = createMockState();
      const clearLengthCache = vi.fn();
      const orchestrator = {
        ...createMockOrchestrator(),
        clearLengthCache,
      } as unknown as IOrchestrator;

      generateIf(ctx, input, state, orchestrator);

      expect(clearLengthCache).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Tests - generateWhile
  // ========================================================================

  describe("generateWhile", () => {
    it("generates simple while loop", () => {
      const ctx = createMockWhileStatement();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        exprCode: "i < 10",
        statementCode: "{ i++; }",
      });

      const result = generateWhile(ctx, input, state, orchestrator);

      expect(result.code).toBe("while (i < 10) { i++; }");
    });

    it("validates no function calls in condition (Issue #254)", () => {
      const expr = createMockExpression();
      const ctx = createMockWhileStatement({ expr });
      const input = createMockInput();
      const state = createMockState();
      const validateConditionNoFunctionCall = vi.fn();
      const orchestrator = {
        ...createMockOrchestrator(),
        validateConditionNoFunctionCall,
      } as unknown as IOrchestrator;

      generateWhile(ctx, input, state, orchestrator);

      expect(validateConditionNoFunctionCall).toHaveBeenCalledWith(
        expr,
        "while",
      );
    });

    it("flushes temp declarations before body (Issue #250)", () => {
      const ctx = createMockWhileStatement();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        exprCode: "tmp_1",
        tempDeclarations: "bool tmp_1 = hasMore();",
        statementCode: "{ process(); }",
      });

      const result = generateWhile(ctx, input, state, orchestrator);

      expect(result.code).toContain("bool tmp_1 = hasMore();");
      expect(result.code).toContain("while (tmp_1)");
    });

    it("returns empty effects", () => {
      const ctx = createMockWhileStatement();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateWhile(ctx, input, state, orchestrator);

      expect(result.effects).toEqual([]);
    });
  });

  // ========================================================================
  // Tests - generateDoWhile
  // ========================================================================

  describe("generateDoWhile", () => {
    it("generates simple do-while loop (ADR-027)", () => {
      const ctx = createMockDoWhileStatement();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        exprCode: "count > 0",
        blockCode: "{ count--; }",
      });

      const result = generateDoWhile(ctx, input, state, orchestrator);

      expect(result.code).toBe("do { count--; } while (count > 0);");
    });

    it("validates do-while condition (E0701)", () => {
      const expr = createMockExpression();
      const ctx = createMockDoWhileStatement({ expr });
      const input = createMockInput();
      const state = createMockState();
      const validateDoWhileCondition = vi.fn();
      const orchestrator = {
        ...createMockOrchestrator(),
        validateDoWhileCondition,
      } as unknown as IOrchestrator;

      generateDoWhile(ctx, input, state, orchestrator);

      expect(validateDoWhileCondition).toHaveBeenCalledWith(expr);
    });

    it("validates no function calls in condition (Issue #254)", () => {
      const expr = createMockExpression();
      const ctx = createMockDoWhileStatement({ expr });
      const input = createMockInput();
      const state = createMockState();
      const validateConditionNoFunctionCall = vi.fn();
      const orchestrator = {
        ...createMockOrchestrator(),
        validateConditionNoFunctionCall,
      } as unknown as IOrchestrator;

      generateDoWhile(ctx, input, state, orchestrator);

      expect(validateConditionNoFunctionCall).toHaveBeenCalledWith(
        expr,
        "do-while",
      );
    });

    it("flushes temp declarations before loop (Issue #250)", () => {
      const ctx = createMockDoWhileStatement();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        exprCode: "tmp_1",
        tempDeclarations: "int tmp_1 = check();",
        blockCode: "{ work(); }",
      });

      const result = generateDoWhile(ctx, input, state, orchestrator);

      expect(result.code).toContain("int tmp_1 = check();");
      expect(result.code).toContain("while (tmp_1);");
    });
  });

  // ========================================================================
  // Tests - generateForVarDecl
  // ========================================================================

  describe("generateForVarDecl", () => {
    it("generates simple variable declaration", () => {
      const ctx = createMockForVarDecl({ identifier: "i" });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ typeCode: "int" });

      const result = generateForVarDecl(ctx, input, state, orchestrator);

      expect(result.code).toBe("int i");
    });

    it("generates declaration with initialization", () => {
      const ctx = createMockForVarDecl({
        identifier: "i",
        expr: createMockExpression({ text: "0" }),
      });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        typeCode: "int",
        exprCode: "0",
      });

      const result = generateForVarDecl(ctx, input, state, orchestrator);

      expect(result.code).toBe("int i = 0");
    });

    it("adds atomic modifier as volatile", () => {
      const ctx = createMockForVarDecl({
        identifier: "count",
        atomicMod: true,
      });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ typeCode: "int" });

      const result = generateForVarDecl(ctx, input, state, orchestrator);

      expect(result.code).toBe("volatile int count");
    });

    it("adds volatile modifier", () => {
      const ctx = createMockForVarDecl({
        identifier: "reg",
        volatileMod: true,
      });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ typeCode: "uint8_t" });

      const result = generateForVarDecl(ctx, input, state, orchestrator);

      expect(result.code).toBe("volatile uint8_t reg");
    });

    it("registers local variable (ADR-016)", () => {
      const ctx = createMockForVarDecl({ identifier: "index" });
      const input = createMockInput();
      const state = createMockState();
      const registerLocalVariable = vi.fn();
      const orchestrator = {
        ...createMockOrchestrator(),
        registerLocalVariable,
      } as unknown as IOrchestrator;

      generateForVarDecl(ctx, input, state, orchestrator);

      expect(registerLocalVariable).toHaveBeenCalledWith("index");
    });

    it("generates array dimensions (ADR-036)", () => {
      const arrayDim = {} as Parser.ArrayDimensionContext;
      const ctx = createMockForVarDecl({
        identifier: "arr",
        arrayDims: [arrayDim],
      });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ typeCode: "int" });

      const result = generateForVarDecl(ctx, input, state, orchestrator);

      expect(result.code).toBe("int arr[10]");
    });
  });

  // ========================================================================
  // Tests - generateForAssignment
  // ========================================================================

  describe("generateForAssignment", () => {
    it("generates simple assignment with <- operator", () => {
      const ctx = createMockForAssignment({
        target: createMockAssignmentTarget("i"),
        operator: createMockAssignmentOperator("<-"),
      });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ exprCode: "0" });

      const result = generateForAssignment(ctx, input, state, orchestrator);

      expect(result.code).toBe("i = 0");
    });

    it("generates compound assignment with +<- operator", () => {
      const ctx = createMockForAssignment({
        target: createMockAssignmentTarget("i"),
        operator: createMockAssignmentOperator("+<-"),
      });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ exprCode: "1" });

      const result = generateForAssignment(ctx, input, state, orchestrator);

      expect(result.code).toBe("i += 1");
    });

    it("maps all assignment operators correctly", () => {
      const operators: [string, string][] = [
        ["<-", "="],
        ["+<-", "+="],
        ["-<-", "-="],
        ["*<-", "*="],
        ["/<-", "/="],
        ["%<-", "%="],
        ["&<-", "&="],
        ["|<-", "|="],
        ["^<-", "^="],
        ["<<<-", "<<="],
        [">><-", ">>="],
      ];

      for (const [cnextOp, cOp] of operators) {
        const ctx = createMockForAssignment({
          target: createMockAssignmentTarget("x"),
          operator: createMockAssignmentOperator(cnextOp),
        });
        const input = createMockInput();
        const state = createMockState();
        const orchestrator = createMockOrchestrator({ exprCode: "1" });

        const result = generateForAssignment(ctx, input, state, orchestrator);

        expect(result.code).toBe(`x ${cOp} 1`);
      }
    });
  });

  // ========================================================================
  // Tests - generateFor
  // ========================================================================

  describe("generateFor", () => {
    it("generates empty for loop (infinite loop)", () => {
      const ctx = createMockForStatement();
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({ statementCode: "{ }" });

      const result = generateFor(ctx, input, state, orchestrator);

      expect(result.code).toBe("for (; ; ) { }");
    });

    it("generates for loop with all parts", () => {
      const ctx = createMockForStatement({
        init: createMockForInit({
          varDecl: createMockForVarDecl({
            identifier: "i",
            expr: createMockExpression({ text: "0" }),
          }),
        }),
        expr: createMockExpression({ text: "i < 10" }),
        update: createMockForUpdate(),
        stmt: createMockStatement(),
      });
      const input = createMockInput();
      const state = createMockState();
      let exprCount = 0;
      const orchestrator = {
        ...createMockOrchestrator({ typeCode: "int" }),
        generateExpression: vi.fn(() => {
          return ["0", "i < 10", "1"][exprCount++] ?? "x";
        }),
        generateStatement: vi.fn(() => "{ body(); }"),
      } as unknown as IOrchestrator;

      const result = generateFor(ctx, input, state, orchestrator);

      expect(result.code).toContain(
        "for (int i = 0; i < 10; i += 1) { body(); }",
      );
    });

    it("generates for loop with assignment init", () => {
      const ctx = createMockForStatement({
        init: createMockForInit({
          assignment: createMockForAssignment({
            target: createMockAssignmentTarget("i"),
            operator: createMockAssignmentOperator("<-"),
          }),
        }),
      });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator({
        exprCode: "0",
        statementCode: "{ }",
      });

      const result = generateFor(ctx, input, state, orchestrator);

      expect(result.code).toContain("for (i = 0;");
    });

    it("validates no function calls in condition (Issue #254)", () => {
      const expr = createMockExpression();
      const ctx = createMockForStatement({ expr });
      const input = createMockInput();
      const state = createMockState();
      const validateConditionNoFunctionCall = vi.fn();
      const orchestrator = {
        ...createMockOrchestrator(),
        validateConditionNoFunctionCall,
      } as unknown as IOrchestrator;

      generateFor(ctx, input, state, orchestrator);

      expect(validateConditionNoFunctionCall).toHaveBeenCalledWith(expr, "for");
    });

    it("flushes temp declarations from all stages (Issue #250)", () => {
      const ctx = createMockForStatement({
        init: createMockForInit({
          varDecl: createMockForVarDecl(),
        }),
        expr: createMockExpression(),
        update: createMockForUpdate(),
      });
      const input = createMockInput();
      const state = createMockState();
      let flushCount = 0;
      const temps = ["int tmp_init;", "int tmp_cond;", "int tmp_update;", ""];
      const orchestrator = {
        ...createMockOrchestrator(),
        flushPendingTempDeclarations: vi.fn(() => temps[flushCount++] ?? ""),
      } as unknown as IOrchestrator;

      const result = generateFor(ctx, input, state, orchestrator);

      // All temps should be prepended before the for loop
      expect(result.code).toContain("int tmp_init;");
      expect(result.code).toContain("int tmp_cond;");
      expect(result.code).toContain("int tmp_update;");
      expect(result.code).toContain("for (");
    });

    it("collects effects from init", () => {
      const ctx = createMockForStatement({
        init: createMockForInit({
          varDecl: createMockForVarDecl(),
        }),
      });
      const input = createMockInput();
      const state = createMockState();
      const orchestrator = createMockOrchestrator();

      const result = generateFor(ctx, input, state, orchestrator);

      // Effects come from generateForVarDecl which returns empty effects
      expect(result.effects).toEqual([]);
    });
  });
});
