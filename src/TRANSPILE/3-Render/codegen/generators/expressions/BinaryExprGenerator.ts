/**
 * Binary Expression Generator
 *
 * Renders the binary precedence ladder:
 * - Logical: || (or), && (and)
 * - Equality: = (becomes ==), != with ADR-017 enum safety and ADR-045 string strcmp
 * - Relational: <, >, <=, >=
 * - Bitwise: |, ^, &
 * - Shift: <<, >> with validation
 * - Arithmetic: +, -, *, /, %
 *
 * Issue #235: Includes constant folding for compile-time constant expressions.
 *
 * ## It renders a plan; it does not read a tree (#1445 box 3)
 *
 * This was ten generators, one per grammar precedence level, recursing into
 * each other. They reduce to FOUR renderings plus a leaf: the levels differ in
 * which separator, which default operator and which extra rule applies, not in
 * what they do. `CodeGenerator.planBinaryExpr` walks the ladder and collapses
 * the single-child pass-through levels -- which is most levels of most expressions --
 * so a plan is only as deep as the expression's real operator nesting.
 *
 * ## The window is opened HERE, around thunks the planner did not evaluate
 *
 * `CodeGenState.withoutExpectedType` is a dynamic scope over the whole operand
 * subtree, not a parameter: it clears `expectedType` and
 * `suppressBareEnumResolution` for the duration of a callback, and a leaf reads
 * them live at the instant it renders. So an operand nested any distance under
 * a comparison must render inside the window, which is why the PLANNER is lazy
 * rather than only the top thunk. Issue #1032 is the cost of getting it wrong:
 * `i32 < 0` emitting `signedIdx < 0U`, promoted to unsigned by C's usual
 * arithmetic conversions, and the test is dead.
 */
import AdrProvenance from "../../../../../transpiler/state/AdrProvenance";
import BinaryExprUtils from "./BinaryExprUtils";
import CodeGenState from "../../../../../transpiler/state/CodeGenState";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorOutput from "../IGeneratorOutput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import TGeneratorEffect from "../TGeneratorEffect";
import TPlannedBinaryExpr from "../../types/TPlannedBinaryExpr";
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";

/**
 * Render every operand, collecting their effects.
 */
const renderOperands = (
  operands: readonly (() => IGeneratorOutput)[],
  effects: TGeneratorEffect[],
): string[] =>
  operands.map((render) => {
    const result = render();
    effects.push(...result.effects);
    return result.code;
  });

/**
 * Join operand codes with the operator between each pair.
 *
 * `defaultOperator` fills a gap in `operators`, which the parse tree can leave
 * shorter than the operand list. Pre-existing and unexercised -- a probe on the
 * fallback never fires while one on the surrounding loop fires -- and kept
 * rather than dropped, because removing a defense because no fixture reaches it
 * is the argument #1143 records against.
 */
const joinWithOperators = (
  operandCodes: readonly string[],
  operators: readonly string[],
  defaultOperator: string,
  mapOperator: ((operator: string) => string) | null,
): string => {
  let result = operandCodes[0];
  for (let index = 1; index < operandCodes.length; index++) {
    const raw = operators[index - 1] || defaultOperator;
    const operator = mapOperator ? mapOperator(raw) : raw;
    result += ` ${operator} ${operandCodes[index]}`;
  }
  return result;
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
  plan: Extract<TPlannedBinaryExpr, { kind: "arithmetic" }>,
  operandCodes: readonly string[],
  effects: TGeneratorEffect[],
): string | null => {
  const cnxType = plan.clampType();
  if (cnxType === null) return null;
  if (TypeCheckUtils.usesNativeArithmetic(cnxType)) return null;
  if (plan.clampBehavior() !== "clamp") return null;

  // Every operator in the chain must have a helper; a mixed chain such as
  // `a * b / c` is left alone rather than clamped in part, which would be
  // harder to reason about than not clamping at all.
  const chain = operandCodes.slice(1).map((_, index) => {
    return CLAMP_HELPER_FOR_OPERATOR[
      plan.operators[index] ?? plan.defaultOperator
    ];
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
  AdrProvenance.record("044", plan.adrLine);

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
 * Fold, clamp, or join an arithmetic chain.
 *
 * #1450: `analyze:duplication` reported the additive and multiplicative tails
 * as a nine-line clone. One arm serves both now, differing only in the
 * `defaultOperator` the plan carries.
 */
const renderArithmetic = (
  plan: Extract<TPlannedBinaryExpr, { kind: "arithmetic" }>,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const operandCodes = renderOperands(plan.renderOperands, effects);

  // Issue #235: Try constant folding for compile-time constant expressions
  const foldedResult = BinaryExprUtils.tryFoldConstants(operandCodes, [
    ...plan.operators,
  ]);
  if (foldedResult !== undefined) {
    return { code: String(foldedResult), effects };
  }

  // Issue #1152: saturate when the operands are of a clamp integer type
  const clamped = tryClampOperands(plan, operandCodes, effects);
  if (clamped !== null) {
    return { code: clamped, effects };
  }

  return {
    code: joinWithOperators(
      operandCodes,
      plan.operators,
      plan.defaultOperator,
      null,
    ),
    effects,
  };
};

/**
 * Render an equality or relational comparison.
 */
const renderComparison = (
  plan: Extract<TPlannedBinaryExpr, { kind: "comparison" }>,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // ADR-001 (#1585): `=` means equality -- the decision this ADR exists for.
  // Recorded once, ABOVE the string/non-string split, because both branches
  // below render that one decision: `strcmp(...) == 0` and `==`. `!=` is
  // unchanged from C and is not ADR-001's doing, so the planner leaves
  // `adrLine` undefined for a comparison that uses only `!=` -- occupancy must
  // not be invented for a cell where this ADR's rule never fired.
  AdrProvenance.record("001", plan.adrLine);

  if (plan.strcmp) {
    // ADR-045: string comparison lowers to strcmp, which needs <string.h>.
    // Raised HERE rather than carried on the plan: a plan that pre-registered
    // it would drag the header into every file containing a comparison.
    effects.push({ type: "include", header: "string" });

    // #1649: only the FIRST TWO operands are rendered, and the code below is
    // the entire result -- so `s = t = u` emits `strcmp(s, t) == 0` and drops
    // `= u` silently. Pre-existing and preserved exactly: this slice's oracle
    // is a byte-identical corpus, and the fix needs a language decision about
    // chained comparison that #1649 records.
    const [left, right] = CodeGenState.withoutExpectedType(() =>
      renderOperands(plan.renderOperands.slice(0, 2), effects),
    );

    return {
      code: BinaryExprUtils.generateStrcmpCode(
        left,
        right,
        plan.strcmp.isNotEqual,
      ),
      effects,
    };
  }

  // Issue #1032: the operands render with expectedType CLEARED. MISRA 7.2's U
  // suffix applies to assignments, not comparisons -- `i32 < 0` becoming
  // `signedIdx < 0U` changes semantics under C's integer promotion.
  const operandCodes = CodeGenState.withoutExpectedType(() =>
    renderOperands(plan.renderOperands, effects),
  );

  return {
    code: joinWithOperators(
      operandCodes,
      plan.operators,
      plan.defaultOperator,
      plan.mapOperator,
    ),
    effects,
  };
};

/**
 * Render the binary expression a plan describes.
 */
const generateBinaryExpr = (
  plan: TPlannedBinaryExpr,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  switch (plan.kind) {
    case "leaf":
      return { code: plan.render(), effects: [] };

    case "join": {
      const effects: TGeneratorEffect[] = [];
      const operandCodes = renderOperands(plan.renderOperands, effects);
      return { code: operandCodes.join(plan.separator), effects };
    }

    case "comparison":
      return renderComparison(plan);

    case "shift": {
      // #1322: the shift amount (MISRA 12.2, E0873) is checked in pass 2.1.
      const effects: TGeneratorEffect[] = [];
      const operandCodes = renderOperands(plan.renderOperands, effects);
      return {
        code: joinWithOperators(operandCodes, plan.operators, "<<", null),
        effects,
      };
    }

    case "arithmetic":
      return renderArithmetic(plan);
  }
};

export default generateBinaryExpr;
