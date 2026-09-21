/**
 * Control Flow Statement Generators
 *
 * Generates C code for control flow statements:
 * - return statements
 * - if/else statements
 * - while loops
 * - do-while loops
 * - for loops
 *
 * ## It renders plans; it does not read a tree (#1445 box 3)
 *
 * Every question these eight used to ask of a parse node -- does this `return`
 * carry an expression, does this `if` have an else, is this `for` init a
 * declaration or an assignment -- is answered by a `plan*` method on
 * `CodeGenerator` and arrives as a record.
 *
 * ## What did NOT move, and why: the flush points
 *
 * Almost every field on these plans is a THUNK, and the reason is Issue #250
 * rather than conditionality. Rendering a clause can queue a temp declaration
 * into `pendingTempDeclarations`, and these generators hoist those temps out in
 * front of the statement by flushing BETWEEN clauses: a `for` flushes after its
 * init, after its condition and after its update, so each clause's temps land in
 * the right group and none of them lands inside the loop body where the header
 * that reads it cannot see it.
 *
 * Rendering a clause at plan time would collapse those flush points into one --
 * the first flush would return everything. So the interleaving stays here, in
 * the generator, where the statement's shape is legible, and the planner hands
 * over unevaluated renders rather than strings.
 *
 * The one eager field is `IPlannedIf.lengthCounts`: counting repeated
 * `.char_count` reads walks the tree and emits nothing, so asking at plan time
 * costs what asking at render time cost.
 */
import ComplianceAnnotations from "../../../../2-Plan/ComplianceAnnotations";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import IPlannedFor from "../../types/IPlannedFor";
import IPlannedForAssignment from "../../types/IPlannedForAssignment";
import IPlannedForVarDecl from "../../types/IPlannedForVarDecl";
import IPlannedForever from "../../types/IPlannedForever";
import IPlannedIf from "../../types/IPlannedIf";
import IPlannedLoop from "../../types/IPlannedLoop";
import TPlannedReturn from "../../types/TPlannedReturn";
import AssignmentOperatorMapper from "../../helpers/AssignmentOperatorMapper";

/**
 * Generate C code for a return statement.
 * Issue #477: Uses function return type as expected type for enum inference.
 */
const generateReturn = (
  plan: TPlannedReturn,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  if (plan.kind === "void") {
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
  // only.
  //
  // The return type is asked for HERE rather than captured in the plan: it
  // belongs to the enclosing function, not to this node, and the generator is
  // what holds that context.
  //
  // The measured consequence is wider than #1277: `return 1;` from a function
  // returning `u8` emits `return 1U;`, the MISRA C:2012 Rule 7.2 suffix that
  // the identical literal already received in `u8 x <- 1;`. The rule did not
  // reach a return statement only because the type did not.
  const expr = plan.render(orchestrator.getCurrentFunctionReturnType());

  return { code: `return ${expr};`, effects };
};

/**
 * Generate C code for an if statement.
 * Includes strlen optimization for repeated .char_count accesses.
 */
const generateIf = (
  plan: IPlannedIf,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // Set up cache and generate declarations
  const cacheDecls = orchestrator.setupLengthCache(plan.lengthCounts);

  // Generate with cache enabled
  const condition = plan.renderCondition();

  // Issue #250: Flush any temp vars from condition BEFORE generating branches
  const conditionTemps = orchestrator.flushPendingTempDeclarations();

  const thenBranch = plan.renderThen();

  let result = `if (${condition}) ${thenBranch}`;

  if (plan.renderElse) {
    result += ` else ${plan.renderElse()}`;
  }

  // Clear cache after generating.
  //
  // #1645: this nulls the cache unconditionally while `setupLengthCache` only
  // WRITES it when it emitted a declaration, so a nested statement clears its
  // parent's cache on the way out and one expression renders two ways in one
  // block. Pre-existing, output-visible, and deliberately preserved here --
  // fixing it changes emitted C, and this slice's oracle is a byte-identical
  // corpus.
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
  plan: IPlannedLoop,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // #1322: E0701/E0702 and the always-true check (E0707) are authored in
  // pass 2.1, which halts before this runs.

  const condition = plan.renderCondition();

  // Issue #250: Flush any temp vars from condition BEFORE generating body
  // Otherwise they end up inside the loop body, causing "not declared" errors
  const conditionTemps = orchestrator.flushPendingTempDeclarations();

  const body = plan.renderBody();
  let result = `while (${condition}) ${body}`;

  // Prepend condition temps before the while statement
  if (conditionTemps) {
    result = conditionTemps + "\n" + result;
  }

  return { code: result, effects };
};

/**
 * Generate C code for a do-while statement (ADR-027).
 *
 * The body renders FIRST -- the same two thunks as `while`, called in the
 * other order, because that is the order the source reads.
 */
const generateDoWhile = (
  plan: IPlannedLoop,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  const body = plan.renderBody();
  const condition = plan.renderCondition();

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
  plan: IPlannedForVarDecl,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // ADR-016: Track local variables (allowed as bare identifiers inside scopes).
  // ADR-057: registration hands back the emitted name -- a `for` variable that
  // shadows a file-scope name moves, so `global.x` inside the loop body still
  // reaches the global rather than the counter. It happens before the
  // dimensions and the initializer render, which is why those two are thunks.
  const name = orchestrator.registerLocalVariable(plan.declaredName);

  let result = `${plan.atomic}${plan.volatile}${plan.typeName} ${name}`;

  // ADR-036: Handle array dimensions (now returns array for multi-dim support).
  //
  // #1646: this REASSIGNS rather than appends, so it drops the two modifiers
  // above -- and it is reached only by the C-style `u32 a[2]` spelling that
  // E0874 rejects everywhere except here, because the prefix `u32[2] a` form
  // puts its dimensions in the TYPE and loses them entirely (emitting C that
  // gcc refuses to compile). All three are pre-existing and preserved exactly:
  // this slice's oracle is a byte-identical corpus, and every one of those
  // fixes changes emitted C.
  if (plan.renderArrayDimensions) {
    result = `${plan.typeName} ${name}${plan.renderArrayDimensions()}`;
  }

  // Handle initialization
  if (plan.renderInitializer) {
    // #1277: a `for` header declares a variable like any other, so its
    // initializer is typed by the declared type through the same mechanism a
    // block-level declaration uses. Without it a struct literal here was
    // rejected as "Cannot infer struct type".
    result += ` = ${plan.renderInitializer(plan.typeName)}`;
  }

  return { code: result, effects };
};

/**
 * Generate an assignment in a `for` header, for the init and the update alike.
 *
 * #1445: ONE renderer, where there were two. `generateFor` open-coded the
 * update form inline with the same three reads and the same
 * `AssignmentOperatorMapper` call, which is the duplicate-code-path
 * anti-pattern at its smallest -- a change to the operator mapping needed two
 * edits and nothing said so.
 *
 * #1647: it is still a THIRD path beside the one a statement assignment takes.
 * Concatenating target, operator and value skips ADR-065's classification, so
 * ADR-044's overflow lowering and MISRA C:2012 Rule 7.2's literal suffix never
 * run here -- `i +<- 10` on a `u8` saturates as a statement and WRAPS in a
 * `for` update, which turns a terminating loop into an infinite one.
 * Pre-existing and preserved exactly: this slice's oracle is a byte-identical
 * corpus, and that fix changes the emitted C of every `for` header.
 */
const generateForAssignment = (
  plan: IPlannedForAssignment,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const target = plan.renderTarget();
  const value = plan.renderValue();
  const cOp = AssignmentOperatorMapper.toCOperator(
    plan.operatorText,
    plan.operatorLine,
  );
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
  plan: IPlannedFor,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // #1322: `for (;;)` and an always-true condition are E0707 in pass 2.1
  // (ADR-068). A header with no condition never reaches this generator, which
  // is why `renderCondition` is not nullable.

  let init = "";
  if (plan.init) {
    const result =
      plan.init.kind === "varDecl"
        ? generateForVarDecl(plan.init.plan, input, state, orchestrator)
        : generateForAssignment(plan.init.plan, input, state, orchestrator);
    init = result.code;
    effects.push(...result.effects);
  }

  // Issue #250: Flush temps from init before generating condition
  const initTemps = orchestrator.flushPendingTempDeclarations();

  const condition = plan.renderCondition();

  // Issue #250: Flush temps from condition before generating update
  const conditionTemps = orchestrator.flushPendingTempDeclarations();

  let update = "";
  if (plan.update) {
    const result = generateForAssignment(
      plan.update,
      input,
      state,
      orchestrator,
    );
    update = result.code;
    effects.push(...result.effects);
  }

  // Issue #250: Flush temps from update before generating body
  const updateTemps = orchestrator.flushPendingTempDeclarations();

  const body = plan.renderBody();

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
  plan: IPlannedForever,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // #1322: `forever` in a non-void function is E0705 in pass 2.1 (ADR-068).

  const body = plan.renderBody();
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
