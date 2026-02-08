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
import ExpressionUtils from "../../../../../utils/ExpressionUtils";
import ASSIGNMENT_OPERATOR_MAP from "../../../../../utils/constants/AssignmentOperators";

/**
 * Issue #477: Check if a simple identifier is an unqualified enum member.
 * Throws an error with helpful suggestion if found.
 */
function rejectUnqualifiedEnumInReturn(
  simpleId: string,
  symbols: IGeneratorInput["symbols"],
  exprCtx: ExpressionContext,
): void {
  if (!symbols) return;

  for (const [enumName, members] of symbols.enumMembers) {
    if (members.has(simpleId)) {
      const line = exprCtx.start?.line ?? 0;
      const col = exprCtx.start?.column ?? 0;
      throw new Error(
        `${line}:${col} error[E0424]: '${simpleId}' is not defined; did you mean '${enumName}.${simpleId}'?`,
      );
    }
  }
}

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

  if (!node.expression()) {
    return { code: "return;", effects };
  }

  // Issue #477: Get function return type for enum inference
  const returnType = orchestrator.getCurrentFunctionReturnType();
  const exprCtx = node.expression()!;
  const returnTypeIsEnum =
    returnType && input.symbols?.knownEnums.has(returnType);

  // Issue #477: Validate unqualified enum in non-enum return context
  // Use ExpressionUtils to check for simple identifier (no binary ops, no postfix)
  if (!returnTypeIsEnum) {
    const simpleId = ExpressionUtils.extractIdentifier(exprCtx);
    if (simpleId) {
      rejectUnqualifiedEnumInReturn(simpleId, input.symbols, exprCtx);
    }
  }

  // Set expectedType if return type is enum (enables unqualified enum returns)
  const expr = returnTypeIsEnum
    ? orchestrator.generateExpressionWithExpectedType(exprCtx, returnType)
    : orchestrator.generateExpression(exprCtx);

  return { code: `return ${expr};`, effects };
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
