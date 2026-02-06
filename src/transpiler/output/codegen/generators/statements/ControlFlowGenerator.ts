/**
 * Control Flow Statement Generators (ADR-053 A3)
 *
 * Generates C code for control flow statements:
 * - return statements
 * - if/else statements
 * - while loops
 * - do-while loops
 * - for loops
 */
import {
  ReturnStatementContext,
  IfStatementContext,
  WhileStatementContext,
  DoWhileStatementContext,
  ForStatementContext,
  ForVarDeclContext,
  ForAssignmentContext,
  ExpressionContext,
} from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import VariableModifierBuilder from "../../helpers/VariableModifierBuilder";

/**
 * Maps C-Next assignment operators to C assignment operators
 */
const ASSIGNMENT_OPERATOR_MAP: Record<string, string> = {
  "<-": "=",
  "+<-": "+=",
  "-<-": "-=",
  "*<-": "*=",
  "/<-": "/=",
  "%<-": "%=",
  "&<-": "&=",
  "|<-": "|=",
  "^<-": "^=",
  "<<<-": "<<=",
  ">><-": ">>=",
};

/**
 * Generate C code for a return statement.
 * Issue #477: Uses function return type as expected type for enum inference.
 */
const generateReturn = (
  node: ReturnStatementContext,
  input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  if (node.expression()) {
    // Issue #477: Get function return type for enum inference
    const returnType = orchestrator.getCurrentFunctionReturnType();
    const exprCtx = node.expression()!;
    const isSimpleExpr = isSimpleExpression(exprCtx);
    const returnTypeIsEnum =
      returnType && input.symbols?.knownEnums.has(returnType);

    // Issue #477: Validate unqualified enum in non-enum return context
    // If return type is NOT an enum AND expression is a simple identifier
    // AND that identifier is an unqualified enum member → reject
    if (isSimpleExpr && !returnTypeIsEnum && input.symbols) {
      const simpleId = getSimpleIdentifier(exprCtx);
      if (simpleId) {
        // Check if this identifier is an enum member
        for (const [enumName, members] of input.symbols.enumMembers) {
          if (members.has(simpleId)) {
            const line = exprCtx.start?.line ?? 0;
            const col = exprCtx.start?.column ?? 0;
            throw new Error(
              `${line}:${col} error[E0424]: '${simpleId}' is not defined; did you mean '${enumName}.${simpleId}'?`,
            );
          }
        }
      }
    }

    // Set expectedType if return type is enum (enables unqualified enum returns)
    const expr = returnTypeIsEnum
      ? orchestrator.generateExpressionWithExpectedType(exprCtx, returnType)
      : orchestrator.generateExpression(exprCtx);

    return { code: `return ${expr};`, effects };
  }

  return { code: "return;", effects };
};

/**
 * Issue #477: Get the simple identifier from an expression if it's just an identifier.
 * Returns null for complex expressions, qualified types (Enum.VALUE), or expressions with postfix ops.
 */
const getSimpleIdentifier = (expr: ExpressionContext): string | null => {
  if (!isSimpleExpression(expr)) return null;

  // Navigate down the chain to get the primary expression
  const ternary = expr.ternaryExpression();
  if (!ternary) return null;

  const orExprs = ternary.orExpression();
  if (orExprs.length !== 1) return null;

  const andExprs = orExprs[0].andExpression();
  if (andExprs.length !== 1) return null;

  const eqExprs = andExprs[0].equalityExpression();
  if (eqExprs.length !== 1) return null;

  const relExprs = eqExprs[0].relationalExpression();
  if (relExprs.length !== 1) return null;

  const borExprs = relExprs[0].bitwiseOrExpression();
  if (borExprs.length !== 1) return null;

  const bxorExprs = borExprs[0].bitwiseXorExpression();
  if (bxorExprs.length !== 1) return null;

  const bandExprs = bxorExprs[0].bitwiseAndExpression();
  if (bandExprs.length !== 1) return null;

  const shiftExprs = bandExprs[0].shiftExpression();
  if (shiftExprs.length !== 1) return null;

  const addExprs = shiftExprs[0].additiveExpression();
  if (addExprs.length !== 1) return null;

  const mulExprs = addExprs[0].multiplicativeExpression();
  if (mulExprs.length !== 1) return null;

  const unaryExprs = mulExprs[0].unaryExpression();
  if (unaryExprs.length !== 1) return null;

  const postfix = unaryExprs[0].postfixExpression();
  if (!postfix) return null;

  // If there are postfix operations (like .member or [index]), not a simple identifier
  if (postfix.postfixOp().length > 0) return null;

  const primary = postfix.primaryExpression();
  if (!primary) return null;

  // Check if it's just an identifier (not a qualified type like Enum.VALUE)
  // A qualified type has the form: IDENTIFIER.IDENTIFIER (e.g., Color.RED)
  // For simple identifier, we check there's an IDENTIFIER and the text doesn't contain '.'
  const id = primary.IDENTIFIER();
  if (id && !primary.getText().includes(".")) {
    return id.getText();
  }

  return null;
};

/**
 * Issue #477: Check if an expression is "simple" (no binary operators).
 * Simple expressions: identifiers, literals, qualified types, parenthesized simple exprs
 * Complex expressions: comparisons (a = b), arithmetic (a + b), etc.
 */
const isSimpleExpression = (expr: ExpressionContext): boolean => {
  // Get the chain down to the primary expression
  // expression → ternaryExpression → orExpression → andExpression → ...

  // Check for ternary operator
  const ternaryExpr = expr.ternaryExpression();
  if (!ternaryExpr) return false;

  // If there's a ternary operator (has multiple orExpression children), not simple
  const orExprs = ternaryExpr.orExpression();
  if (orExprs.length > 1) return false;

  const orExpr = orExprs[0];
  if (!orExpr || orExpr.andExpression().length > 1) return false;

  const andExpr = orExpr.andExpression()[0];
  if (!andExpr || andExpr.equalityExpression().length > 1) return false;

  const eqExpr = andExpr.equalityExpression()[0];
  // If there's an equality operator (=, !=), it's a comparison
  if (!eqExpr || eqExpr.relationalExpression().length > 1) return false;

  // Continue down the chain - any binary operators make it non-simple
  const relExpr = eqExpr.relationalExpression()[0];
  if (!relExpr || relExpr.bitwiseOrExpression().length > 1) return false;

  const borExpr = relExpr.bitwiseOrExpression()[0];
  if (!borExpr || borExpr.bitwiseXorExpression().length > 1) return false;

  const bxorExpr = borExpr.bitwiseXorExpression()[0];
  if (!bxorExpr || bxorExpr.bitwiseAndExpression().length > 1) return false;

  const bandExpr = bxorExpr.bitwiseAndExpression()[0];
  if (!bandExpr || bandExpr.shiftExpression().length > 1) return false;

  const shiftExpr = bandExpr.shiftExpression()[0];
  if (!shiftExpr || shiftExpr.additiveExpression().length > 1) return false;

  const addExpr = shiftExpr.additiveExpression()[0];
  if (!addExpr || addExpr.multiplicativeExpression().length > 1) return false;

  const mulExpr = addExpr.multiplicativeExpression()[0];
  if (!mulExpr || mulExpr.unaryExpression().length > 1) return false;

  // If we get here, it's a simple unary/primary expression
  return true;
};

/**
 * Generate C code for an if statement.
 * Includes strlen optimization for repeated .length accesses.
 */
const generateIf = (
  node: IfStatementContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const statements = node.statement();

  // Analyze condition and body for repeated .length accesses (strlen optimization)
  const lengthCounts = orchestrator.countStringLengthAccesses(
    node.expression(),
  );

  // Also count in the then branch if it's a block
  const thenStmt = statements[0];
  if (thenStmt.block()) {
    orchestrator.countBlockLengthAccesses(thenStmt.block()!, lengthCounts);
  }

  // Set up cache and generate declarations
  const cacheDecls = orchestrator.setupLengthCache(lengthCounts);

  // Issue #254: Validate no function calls in condition (E0702)
  orchestrator.validateConditionNoFunctionCall(node.expression(), "if");

  // Generate with cache enabled
  const condition = orchestrator.generateExpression(node.expression());

  // Issue #250: Flush any temp vars from condition BEFORE generating branches
  const conditionTemps = orchestrator.flushPendingTempDeclarations();

  const thenBranch = orchestrator.generateStatement(thenStmt);

  let result = `if (${condition}) ${thenBranch}`;

  if (statements.length > 1) {
    const elseBranch = orchestrator.generateStatement(statements[1]);
    result += ` else ${elseBranch}`;
  }

  // Clear cache after generating
  orchestrator.clearLengthCache();

  // Prepend condition temps and cache declarations
  if (conditionTemps) {
    result = conditionTemps + "\n" + result;
  }
  if (cacheDecls) {
    result = cacheDecls + result;
  }

  return { code: result, effects };
};

/**
 * Generate C code for a while statement.
 */
const generateWhile = (
  node: WhileStatementContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // Issue #254: Validate no function calls in condition (E0702)
  orchestrator.validateConditionNoFunctionCall(node.expression(), "while");

  const condition = orchestrator.generateExpression(node.expression());

  // Issue #250: Flush any temp vars from condition BEFORE generating body
  // Otherwise they end up inside the loop body, causing "not declared" errors
  const conditionTemps = orchestrator.flushPendingTempDeclarations();

  const body = orchestrator.generateStatement(node.statement());
  let result = `while (${condition}) ${body}`;

  // Prepend condition temps before the while statement
  if (conditionTemps) {
    result = conditionTemps + "\n" + result;
  }

  return { code: result, effects };
};

/**
 * Generate C code for a do-while statement (ADR-027).
 */
const generateDoWhile = (
  node: DoWhileStatementContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // Validate the condition is a boolean expression (E0701)
  orchestrator.validateDoWhileCondition(node.expression());

  // Issue #254: Validate no function calls in condition (E0702)
  orchestrator.validateConditionNoFunctionCall(node.expression(), "do-while");

  const body = orchestrator.generateBlock(node.block());
  const condition = orchestrator.generateExpression(node.expression());

  // Issue #250: Flush any temp vars from condition
  // For do-while, condition is evaluated after body, but temps must be declared before
  const conditionTemps = orchestrator.flushPendingTempDeclarations();

  let result = `do ${body} while (${condition});`;

  if (conditionTemps) {
    result = conditionTemps + "\n" + result;
  }

  return { code: result, effects };
};

/**
 * Generate variable declaration for for loop init (no trailing semicolon).
 */
const generateForVarDecl = (
  node: ForVarDeclContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  // Issue #696: Use shared modifier builder
  const modifiers = VariableModifierBuilder.buildSimple(node);
  const typeName = orchestrator.generateType(node.type());
  const name = node.IDENTIFIER().getText();

  // ADR-016: Track local variables (allowed as bare identifiers inside scopes)
  orchestrator.registerLocalVariable(name);

  let result = `${modifiers.atomic}${modifiers.volatile}${typeName} ${name}`;

  // ADR-036: Handle array dimensions (now returns array for multi-dim support)
  const arrayDims = node.arrayDimension();
  if (arrayDims.length > 0) {
    result = `${typeName} ${name}${orchestrator.generateArrayDimensions(arrayDims)}`;
  }

  // Handle initialization
  if (node.expression()) {
    const value = orchestrator.generateExpression(node.expression()!);
    result += ` = ${value}`;
  }

  return { code: result, effects };
};

/**
 * Generate assignment for for loop init/update (no trailing semicolon).
 */
const generateForAssignment = (
  node: ForAssignmentContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const target = orchestrator.generateAssignmentTarget(node.assignmentTarget());
  const value = orchestrator.generateExpression(node.expression());
  const operatorCtx = node.assignmentOperator();
  const cnextOp = operatorCtx.getText();
  const cOp = ASSIGNMENT_OPERATOR_MAP[cnextOp] || "=";
  return { code: `${target} ${cOp} ${value}`, effects };
};

/**
 * Generate C code for a for statement.
 *
 * Note: Issue #250 - temps from condition/update are hoisted before the for loop.
 * This means the expression is evaluated once, not on each iteration.
 * This is a known limitation; if the value changes inside the loop,
 * the user should capture it in a variable explicitly.
 */
const generateFor = (
  node: ForStatementContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  let init = "";
  const forInit = node.forInit();
  if (forInit) {
    if (forInit.forVarDecl()) {
      const result = generateForVarDecl(
        forInit.forVarDecl()!,
        input,
        state,
        orchestrator,
      );
      init = result.code;
      effects.push(...result.effects);
    } else if (forInit.forAssignment()) {
      const result = generateForAssignment(
        forInit.forAssignment()!,
        input,
        state,
        orchestrator,
      );
      init = result.code;
      effects.push(...result.effects);
    }
  }

  // Issue #250: Flush temps from init before generating condition
  const initTemps = orchestrator.flushPendingTempDeclarations();

  let condition = "";
  if (node.expression()) {
    // Issue #254: Validate no function calls in condition (E0702)
    orchestrator.validateConditionNoFunctionCall(node.expression()!, "for");
    condition = orchestrator.generateExpression(node.expression()!);
  }

  // Issue #250: Flush temps from condition before generating update
  const conditionTemps = orchestrator.flushPendingTempDeclarations();

  let update = "";
  const forUpdate = node.forUpdate();
  if (forUpdate) {
    const target = orchestrator.generateAssignmentTarget(
      forUpdate.assignmentTarget(),
    );
    const value = orchestrator.generateExpression(forUpdate.expression());
    const operatorCtx = forUpdate.assignmentOperator();
    const cnextOp = operatorCtx.getText();
    const cOp = ASSIGNMENT_OPERATOR_MAP[cnextOp] || "=";
    update = `${target} ${cOp} ${value}`;
  }

  // Issue #250: Flush temps from update before generating body
  const updateTemps = orchestrator.flushPendingTempDeclarations();

  const body = orchestrator.generateStatement(node.statement());

  let result = `for (${init}; ${condition}; ${update}) ${body}`;

  // Prepend all temps before the for statement
  const allTemps = [initTemps, conditionTemps, updateTemps]
    .filter(Boolean)
    .join("\n");
  if (allTemps) {
    result = allTemps + "\n" + result;
  }

  return { code: result, effects };
};

// Export all control flow generators
const controlFlowGenerators = {
  generateReturn,
  generateIf,
  generateWhile,
  generateDoWhile,
  generateFor,
  generateForVarDecl,
  generateForAssignment,
};

export default controlFlowGenerators;
