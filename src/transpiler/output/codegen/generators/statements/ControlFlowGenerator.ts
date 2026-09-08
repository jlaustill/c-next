/**
 * Control Flow Statement Generators
 *
 * Generates C code for control flow statements:
 * - return statements
 * - if/else statements
 * - while loops
 * - do-while loops
 * - for loops
 */
import ComplianceAnnotations from "../../../../../TRANSPILE/2-Plan/ComplianceAnnotations";
import {
  ReturnStatementContext,
  IfStatementContext,
  WhileStatementContext,
  DoWhileStatementContext,
  ForStatementContext,
  ForeverStatementContext,
  ForVarDeclContext,
  ForAssignmentContext,
} from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import VariableModifierBuilder from "../../helpers/VariableModifierBuilder";
import ASSIGNMENT_OPERATOR_MAP from "../../../../../utils/constants/OperatorMappings";

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

  // Issue #477 / #1277: a `return` expression is expected to be the function's
  // declared return type, and that is the whole rule -- the type is threaded
  // for EVERY return, not only an enum one.
  //
  // #1277: the enum-only condition that stood here is why
  // `return { x: 1, y: 2 };` was rejected as "Cannot infer struct type" while
  // the identical literal assigned to a local first compiled. A struct literal
  // takes its type from the position it stands in, and a return statement is
  // such a position; restricting the mechanism to enums made it one for enums
  // only. `expectedType` means "what this position expects", so the condition
  // was describing the consumers rather than the fact.
  const returnType = orchestrator.getCurrentFunctionReturnType();
  const exprCtx = node.expression()!;

  // #1322: a bare enum member returned from a non-enum function is E0424 in
  // pass 2.1 (ADR-017), and a struct literal that no position types is E0357.
  // Threaded for EVERY return type, not only the ones whose literals cannot be
  // written without it. A `return` expression is expected to be the declared
  // return type -- that is the fact, and `expectedType` is the mechanism that
  // carries it. Restricting it to enums (which is what stood here) described
  // the consumers rather than the fact, and that is why #1277 existed.
  //
  // The measured consequence is wider than #1277: `return 1;` from a function
  // returning `u8` now emits `return 1U;`, the MISRA C:2012 Rule 7.2 suffix
  // that the identical literal already received in `u8 x <- 1;`. The rule did
  // not reach a return statement only because the type did not. 505 fixtures
  // move, every one of them adding a suffix or a cast that the declaration
  // form already had.
  const expr = returnType
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

  // #1322: E0701/E0702 and the always-true check (E0707) are authored in
  // pass 2.1, which halts before this runs.

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
  // #1484: a `for` init declares a variable like any other, including one
  // typed by an ADR-029 function-as-type.
  const typeName = orchestrator.generateDeclaredType(node.type());
  const declaredName = node.IDENTIFIER().getText();

  // ADR-016: Track local variables (allowed as bare identifiers inside scopes).
  // ADR-057: registration hands back the emitted name -- a `for` variable that
  // shadows a file-scope name moves, so `global.x` inside the loop body still
  // reaches the global rather than the counter.
  const name = orchestrator.registerLocalVariable(declaredName);

  let result = `${modifiers.atomic}${modifiers.volatile}${typeName} ${name}`;

  // ADR-036: Handle array dimensions (now returns array for multi-dim support)
  const arrayDims = node.arrayDimension();
  if (arrayDims.length > 0) {
    result = `${typeName} ${name}${orchestrator.generateArrayDimensions(arrayDims)}`;
  }

  // Handle initialization
  if (node.expression()) {
    // #1277: a `for` header declares a variable like any other, so its
    // initializer is typed by the declared type through the same mechanism a
    // block-level declaration uses. Without it a struct literal here was
    // rejected as "Cannot infer struct type".
    const value = orchestrator.generateExpressionWithExpectedType(
      node.expression()!,
      typeName,
    );
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

  // #1322: `for (;;)` and an always-true condition are E0707 in pass 2.1
  // (ADR-068). A header with no condition never reaches this generator.

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

  // `for (;;)` is E0707 in pass 2.1, so the controlling expression is
  // guaranteed present here.
  const conditionExpr = node.expression()!;

  const condition = orchestrator.generateExpression(conditionExpr);

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

/**
 * Generate C code for a forever statement (ADR-068).
 *
 * Lowers to the MISRA C:2012 Rule 14.3-compliant infinite-loop idiom `for (;;)`
 * (the carve-out that rule explicitly permits — no controlling expression to be
 * flagged as invariant). A `forever` loop may appear only in a void function
 * (E0705): a value-returning function can never honor its return type if it
 * loops forever.
 */
const generateForever = (
  node: ForeverStatementContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // #1322: `forever` in a non-void function is E0705 in pass 2.1 (ADR-068).

  const body = orchestrator.generateBlock(node.block());
  const comment = ComplianceAnnotations.render(
    ComplianceAnnotations.FOREVER_LOOP,
  );

  return { code: `${comment}\nfor (;;) ${body}`, effects };
};

// Export all control flow generators
const controlFlowGenerators = {
  generateReturn,
  generateIf,
  generateWhile,
  generateDoWhile,
  generateFor,
  generateForever,
  generateForVarDecl,
  generateForAssignment,
};

export default controlFlowGenerators;
