/**
 * Binary Expression Generator
 *
 * Generates C code for binary expressions in the operator precedence chain:
 * - Logical: || (or), && (and)
 * - Equality: = (becomes ==), != with ADR-017 enum safety and ADR-045 string strcmp
 * - Relational: <, >, <=, >=
 * - Bitwise: |, ^, &
 * - Shift: <<, >> with validation
 * - Arithmetic: +, -, *, /, %
 *
 * Issue #235: Includes constant folding for compile-time constant expressions.
 */
import * as Parser from "../../../../../transpiler/logic/parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import BinaryExprUtils from "./BinaryExprUtils";
import { ParserRuleContext } from "antlr4ng";
import TypeResolver from "../../TypeResolver";
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";
import AdrProvenance from "../../../../../transpiler/state/AdrProvenance";
import CodeGenState from "../../../../../transpiler/state/CodeGenState";

/**
 * Generator context passed to child generators.
 */
interface IGeneratorContext {
  input: IGeneratorInput;
  state: IGeneratorState;
  orchestrator: IOrchestrator;
}

/**
 * Generic child expression generator function type
 */
type TChildGenerator<T> = (
  child: T,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
) => IGeneratorOutput;

/**
 * Accumulate binary expressions with operators into a single result.
 * Handles the common pattern of: first + (op + rest)*
 */
function accumulateBinaryExprs<T>(
  exprs: T[],
  operators: string[],
  defaultOp: string,
  generateChild: TChildGenerator<T>,
  ctx: IGeneratorContext,
  mapOperator?: (op: string) => string,
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [];
  const { input, state, orchestrator } = ctx;

  const firstResult = generateChild(exprs[0], input, state, orchestrator);
  effects.push(...firstResult.effects);
  let result = firstResult.code;

  for (let i = 1; i < exprs.length; i++) {
    const rawOp = operators[i - 1] || defaultOp;
    const op = mapOperator ? mapOperator(rawOp) : rawOp;

    const exprResult = generateChild(exprs[i], input, state, orchestrator);
    effects.push(...exprResult.effects);
    result += ` ${op} ${exprResult.code}`;
  }

  return { code: result, effects };
}

/**
 * Generate C code for an OR expression (lowest precedence binary op).
 */
const generateOrExpr = (
  node: Parser.OrExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const parts: string[] = [];

  for (const andExpr of node.andExpression()) {
    const result = generateAndExpr(andExpr, input, state, orchestrator);
    parts.push(result.code);
    effects.push(...result.effects);
  }

  return { code: parts.join(" || "), effects };
};

/**
 * Generate C code for an AND expression.
 */
const generateAndExpr = (
  node: Parser.AndExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const parts: string[] = [];

  for (const eqExpr of node.equalityExpression()) {
    const result = generateEqualityExpr(eqExpr, input, state, orchestrator);
    parts.push(result.code);
    effects.push(...result.effects);
  }

  return { code: parts.join(" && "), effects };
};

/**
 * Generate C code for an equality expression.
 * ADR-001: = becomes == in C
 * ADR-017: Enum type safety validation
 * ADR-045: String comparison via strcmp()
 * Issue #1032: Clear expectedType for comparison operands
 */
const generateEqualityExpr = (
  node: Parser.EqualityExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const exprs = node.relationalExpression();

  if (exprs.length === 1) {
    return generateRelationalExpr(exprs[0], input, state, orchestrator);
  }

  // #1302: read the operator from the parse tree, not from the text of the
  // whole comparison. `node.getText()` includes both operands, so a string
  // literal CONTAINING "!=" selected inequality -- `t = "a!=b"` generated
  // `strcmp(t, "a!=b") != 0`, compiling clean with the condition inverted.
  //
  // Issue #152: extracted in order, so index N is the operator between operand
  // N and N+1.
  const operators = orchestrator.getOperatorsFromChildren(node);

  // ADR-001 (#1585): `=` means equality -- the decision this ADR exists for.
  // Recorded once, ABOVE the string/non-string split, because both branches
  // below render that one decision: `strcmp(...) == 0` and `==`. Recording in
  // each would be two sites for one decision, which is what the assignment
  // half needed `AssignmentOperatorMapper` to stop doing.
  //
  // `!=` is unchanged from C and is not ADR-001's doing, so an expression
  // using only `!=` records nothing -- occupancy must not be invented for a
  // cell where this ADR's rule never fired.
  if (operators.includes("=")) {
    AdrProvenance.record("001", node.start?.line);
  }

  // #1322: ADR-017's comparison rule is E0434 in pass 2.1. It was three throws
  // here, fed by an enum-type resolver and an integer test that split the
  // operands' SOURCE TEXT -- so a bool, an f32 and a non-enum call all compared
  // equal to an enum without complaint.
  if (exprs.length >= 2) {
    // ADR-045: Check for string comparison
    const leftIsString = orchestrator.isStringExpression(exprs[0]);
    const rightIsString = orchestrator.isStringExpression(exprs[1]);

    if (leftIsString || rightIsString) {
      // Generate strcmp for string comparison - needs string.h
      effects.push({ type: "include", header: "string" });

      // Issue #1032: Clear expectedType for equality comparisons.
      // Use CodeGenState.withoutExpectedType() to clear the global state that
      // generators read via getState(). The passed state is not used for
      // expectedType lookup - generators read from CodeGenState directly.
      const [leftResult, rightResult] = CodeGenState.withoutExpectedType(() => [
        generateRelationalExpr(exprs[0], input, state, orchestrator),
        generateRelationalExpr(exprs[1], input, state, orchestrator),
      ]);
      effects.push(...leftResult.effects, ...rightResult.effects);

      // #1302: the operator comes from the parse tree (hoisted above), never
      // from `node.getText()`, which includes both operands.
      const isNotEqual = operators[0] === "!=";

      return {
        code: BinaryExprUtils.generateStrcmpCode(
          leftResult.code,
          rightResult.code,
          isNotEqual,
        ),
        effects,
      };
    }
  }

  // ADR-001: C-Next uses = for equality, transpile to ==
  // Issue #1032: Clear expectedType for equality comparisons.
  // The U suffix for MISRA 7.2 compliance applies to assignments, not comparisons.
  // Use CodeGenState.withoutExpectedType() to clear the global state that
  // generators read via getState(). The passed state is not used for
  // expectedType lookup - generators read from CodeGenState directly.
  return CodeGenState.withoutExpectedType(() =>
    accumulateBinaryExprs(
      exprs,
      operators,
      "=",
      generateRelationalExpr,
      { input, state, orchestrator },
      BinaryExprUtils.mapEqualityOperator,
    ),
  );
};

/**
 * Generate C code for a relational expression.
 * Issue #1032: Clear expectedType for comparison operands - MISRA 7.2 suffix
 * should not apply to comparisons, only to assignments. This prevents
 * `i32 < 0` from becoming `signedIdx < 0U` which changes comparison semantics.
 */
const generateRelationalExpr = (
  node: Parser.RelationalExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const exprs = node.bitwiseOrExpression();

  if (exprs.length === 1) {
    return generateBitwiseOrExpr(exprs[0], input, state, orchestrator);
  }

  // Issue #152: Extract operators in order from parse tree children
  const operators = orchestrator.getOperatorsFromChildren(node);

  // Issue #1032: Clear expectedType for relational comparisons.
  // The U suffix for MISRA 7.2 compliance applies to assignments, not comparisons.
  // Comparing `i32 < 0` should NOT generate `signedIdx < 0U` because that
  // changes semantics due to C's integer promotion rules.
  // Use CodeGenState.withoutExpectedType() to clear the global state that
  // generators read via getState(). The passed state is not used for
  // expectedType lookup - generators read from CodeGenState directly.
  return CodeGenState.withoutExpectedType(() =>
    accumulateBinaryExprs(exprs, operators, "<", generateBitwiseOrExpr, {
      input,
      state,
      orchestrator,
    }),
  );
};

/**
 * Generate C code for a bitwise OR expression.
 */
const generateBitwiseOrExpr = (
  node: Parser.BitwiseOrExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const parts: string[] = [];

  for (const xorExpr of node.bitwiseXorExpression()) {
    const result = generateBitwiseXorExpr(xorExpr, input, state, orchestrator);
    parts.push(result.code);
    effects.push(...result.effects);
  }

  return { code: parts.join(" | "), effects };
};

/**
 * Generate C code for a bitwise XOR expression.
 */
const generateBitwiseXorExpr = (
  node: Parser.BitwiseXorExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const parts: string[] = [];

  for (const andExpr of node.bitwiseAndExpression()) {
    const result = generateBitwiseAndExpr(andExpr, input, state, orchestrator);
    parts.push(result.code);
    effects.push(...result.effects);
  }

  return { code: parts.join(" ^ "), effects };
};

/**
 * Generate C code for a bitwise AND expression.
 */
const generateBitwiseAndExpr = (
  node: Parser.BitwiseAndExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const parts: string[] = [];

  for (const shiftExpr of node.shiftExpression()) {
    const result = generateShiftExpr(shiftExpr, input, state, orchestrator);
    parts.push(result.code);
    effects.push(...result.effects);
  }

  return { code: parts.join(" & "), effects };
};

/**
 * Generate C code for a shift expression.
 * Includes validation of shift amounts.
 */
const generateShiftExpr = (
  node: Parser.ShiftExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const exprs = node.additiveExpression();

  if (exprs.length === 1) {
    return generateAdditiveExpr(exprs[0], input, state, orchestrator);
  }

  // Issue #152: Extract operators in order from parse tree children
  const operators = orchestrator.getOperatorsFromChildren(node);
  const firstResult = generateAdditiveExpr(
    exprs[0],
    input,
    state,
    orchestrator,
  );
  effects.push(...firstResult.effects);
  let result = firstResult.code;

  // #1322: the shift amount (MISRA 12.2, E0873) is checked in pass 2.1.
  for (let i = 1; i < exprs.length; i++) {
    const op = operators[i - 1] || "<<";

    const exprResult = generateAdditiveExpr(
      exprs[i],
      input,
      state,
      orchestrator,
    );
    effects.push(...exprResult.effects);
    result += ` ${op} ${exprResult.code}`;
  }

  return { code: result, effects };
};

/**
 * Issue #1152: C-Next operators that have a saturating helper.
 *
 * Only `+ - *` can overflow into a helper. Unsigned division and modulo cannot
 * overflow at all, and the sole signed case (`INT_MIN / -1`) is left to the
 * existing safe-division path rather than folded in here.
 */
// Partial: an operator outside this map yields undefined, which the chain
// guard below relies on. Typing it as a total Record made that lookup appear
// to always produce a string, so the guard read as dead code (S7765).
const CLAMP_HELPER_FOR_OPERATOR: Readonly<Partial<Record<string, string>>> = {
  "+": "add",
  "-": "sub",
  "*": "mul",
};

/**
 * Issue #1152: Fold a chain of operands into saturating helper calls when the
 * expression's operands are of a `clamp` integer type.
 *
 * `clamp` is C-Next's default overflow behavior (ADR-044), but it used to apply
 * only to compound assignment (`+<-`), so `c <- a + b` wrapped while
 * `c +<- b` saturated -- and `wrap` was indistinguishable from `clamp` in every
 * expression. Routing here makes the modifier mean the same thing wherever the
 * arithmetic is written, which is what lets a bounds guard built from
 * saturating values be trusted (#231).
 *
 * Returns null when the expression should be emitted as plain C: a float or
 * other natively-handled type, a `wrap` type, or operands whose type cannot be
 * resolved.
 */
const tryClampOperands = (
  node: ParserRuleContext,
  operandCodes: readonly string[],
  operators: readonly string[],
  defaultOperator: string,
  effects: TGeneratorEffect[],
): string | null => {
  const cnxType = TypeResolver.getCompositeIntegerType(node);
  if (cnxType === null) return null;
  if (TypeCheckUtils.usesNativeArithmetic(cnxType)) return null;
  if (TypeResolver.getCompositeOverflowBehavior(node) !== "clamp") return null;

  // Every operator in the chain must have a helper; a mixed chain such as
  // `a * b / c` is left alone rather than clamped in part, which would be
  // harder to reason about than not clamping at all.
  const chain = operandCodes.slice(1).map((_, index) => {
    return CLAMP_HELPER_FOR_OPERATOR[operators[index] ?? defaultOperator];
  });
  if (chain.includes(undefined)) {
    return null;
  }

  // #1241: ADR-044's rule -- a `clamp` integer expression is lowered to
  // saturating helper calls rather than plain C arithmetic -- has fired by this
  // point: the type resolved, it is not natively handled, the operands are
  // clamping, and every operator in the chain has a helper. Recorded here, at
  // the last gate, so a chain that bails out above does not claim a cell it
  // never reached.
  AdrProvenance.record("044", node.start?.line);

  let code = operandCodes[0];
  chain.forEach((helperOperation, index) => {
    effects.push({
      type: "helper",
      operation: helperOperation!,
      cnxType,
    });
    code = `cnx_clamp_${helperOperation}_${cnxType}(${code}, ${operandCodes[index + 1]})`;
  });
  return code;
};

/**
 * Fold, clamp, or join a chain of operands -- the tail both the additive and
 * multiplicative generators end with, differing only in which operator fills a
 * gap in the chain.
 *
 * #1450: `analyze:duplication` reported the two as a nine-line clone. Sharing
 * it also settles an inconsistency that was correct only by coincidence: the
 * multiplicative copy returned a fresh `[]` on the fold and join paths while
 * handing `effects` to `tryClampOperands`, so any effect that function recorded
 * before bailing out would have been dropped there and kept in the additive
 * copy. It records none -- every `return null` in it precedes the first
 * `effects.push` -- so the two agreed. They now agree by construction.
 *
 * @param defaultOperator fills a gap in `operators`, which the parse tree can
 *   leave shorter than the operand list. Pre-existing and unexercised: passing
 *   `"+"` for the multiplicative chain leaves 1247/1247 green, and a probe on
 *   the fallback never fires while one on the surrounding loop fires with both
 *   `'+'` and `'*'`. So the loop runs and `operators` is always fully
 *   populated. Kept rather than dropped -- both copies had it, and removing a
 *   defense because no fixture reaches it is the argument #1143 records
 *   against.
 */
const foldClampOrJoin = (
  node: ParserRuleContext,
  operandCodes: string[],
  operators: string[],
  defaultOperator: string,
  effects: TGeneratorEffect[],
): IGeneratorOutput => {
  // Issue #235: Try constant folding for compile-time constant expressions
  const foldedResult = BinaryExprUtils.tryFoldConstants(
    operandCodes,
    operators,
  );
  if (foldedResult !== undefined) {
    return { code: String(foldedResult), effects };
  }

  // Issue #1152: saturate when the operands are of a clamp integer type
  const clamped = tryClampOperands(
    node,
    operandCodes,
    operators,
    defaultOperator,
    effects,
  );
  if (clamped !== null) {
    return { code: clamped, effects };
  }

  // Fall back to standard code generation
  let result = operandCodes[0];
  for (let index = 1; index < operandCodes.length; index++) {
    const operator = operators[index - 1] || defaultOperator;
    result += ` ${operator} ${operandCodes[index]}`;
  }
  return { code: result, effects };
};

/**
 * Generate C code for an additive expression.
 * Issue #235: Includes constant folding for compile-time constant expressions.
 */
const generateAdditiveExpr = (
  node: Parser.AdditiveExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const exprs = node.multiplicativeExpression();

  if (exprs.length === 1) {
    return generateMultiplicativeExpr(exprs[0], input, state, orchestrator);
  }

  // Issue #152: Extract operators in order from parse tree children
  const operators = orchestrator.getOperatorsFromChildren(node);

  // Generate code for all operands
  const operandResults = exprs.map((expr) =>
    generateMultiplicativeExpr(expr, input, state, orchestrator),
  );
  const operandCodes = operandResults.map((r) => r.code);
  operandResults.forEach((r) => effects.push(...r.effects));

  return foldClampOrJoin(node, operandCodes, operators, "+", effects);
};

/**
 * Generate C code for a multiplicative expression.
 * This is the bottom of the binary chain - delegates to unary via orchestrator.
 * Issue #235: Includes constant folding for compile-time constant expressions.
 */
const generateMultiplicativeExpr = (
  node: Parser.MultiplicativeExpressionContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const exprs = node.unaryExpression();

  if (exprs.length === 1) {
    // Delegate to orchestrator for unary expression
    // This allows CodeGenerator to handle unary until it's extracted
    return { code: orchestrator.generateUnaryExpr(exprs[0]), effects: [] };
  }

  // Issue #152: Extract operators in order from parse tree children
  const operators = orchestrator.getOperatorsFromChildren(node);

  // Generate code for all operands
  const operandCodes = exprs.map((expr) =>
    orchestrator.generateUnaryExpr(expr),
  );

  return foldClampOrJoin(node, operandCodes, operators, "*", []);
};

/**
 * `generateOrExpr` is the only entry point, and it is exported DIRECTLY.
 *
 * The other nine used to be exported here too, reached solely by
 * `CodeGenerator`'s expression registrations -- which nothing dispatched
 * (#1445). They are the precedence ladder and are called from `generateOrExpr`
 * downward inside this module, so exporting them published nine names with no
 * consumer. knip could not see that: members of an exported object literal are
 * not analyzed, so the surface stayed green either way.
 *
 * Which is why the wrapper object went with them. Keeping a one-member literal
 * would have preserved the exact affordance that let nine dead names
 * accumulate -- a tenth key costs nothing and is reported by nothing. A plain
 * default export satisfies oxlint's `no-named-export` and puts this module
 * back under knip.
 */
export default generateOrExpr;
