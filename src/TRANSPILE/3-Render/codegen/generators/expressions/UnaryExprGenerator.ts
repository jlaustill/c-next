/**
 * Unary Expression Generator
 *
 * Generates C code for unary expressions:
 * - Prefix operators: !, -, ~, &
 * - Recursive unary (e.g., !!x, --x)
 * - Delegates to postfix for base case
 */
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import TypeResolver from "../../TypeResolver";
import TYPE_MAP from "../../types/TYPE_MAP";
import CppModeHelper from "../../helpers/CppModeHelper";

/**
 * Problematic negative literals that overflow their signed types in C.
 * -2147483648 is parsed as -(2147483648) where 2147483648 > INT32_MAX.
 * These need to be rewritten to avoid the overflow issue.
 */
const INT32_MIN_LITERAL = "2147483648";
const INT64_MIN_LITERAL = "9223372036854775808";

/**
 * Generate C code for a unary expression.
 *
 * Handles prefix operators (!, -, ~, &) and delegates to postfix
 * expression for the base case (no prefix operator).
 *
 * #1445 box 3: takes the operator and the operand's ALREADY-GENERATED code,
 * not the node. The node was read for three things and inspected for none of
 * them -- `postfixExpression()` and `unaryExpression()` were handed straight
 * back to the orchestrator, and `getText()` only ever had its first character
 * examined. The recursion stays with the caller, which is the tree-walker.
 */
interface IPlannedUnary {
  /**
   * The prefix operator, or null when there is none.
   *
   * Null covers BOTH shapes that return the operand unchanged: the base case
   * (the operand is a postfix expression) and the grammar-impossible fallback
   * the old code kept. They produced identical output before, so collapsing
   * them loses nothing -- stated because it looks like two cases becoming one.
   */
  readonly operator: "!" | "-" | "~" | "&" | null;

  /** The operand's generated C. */
  readonly operandCode: string;

  /**
   * The operand's resolved type. LAZY: only `~` consults it, and resolving it
   * eagerly would do strictly more work than the node-taking version did.
   */
  readonly operandType: () => string | null;
}

const generateUnaryExpr: TGeneratorFn<IPlannedUnary> = (
  unary: IPlannedUnary,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const inner = unary.operandCode;

  if (unary.operator === "!") return { code: `!${inner}`, effects: [] };
  if (unary.operator === "-") {
    // MISRA 10.3: Handle problematic negative literals that overflow in C
    // -2147483648 is parsed as -(2147483648) where 2147483648 > INT32_MAX
    // Must use INT32_MIN or INT64_MIN to avoid the overflow
    // Cast is needed because INT32_MIN has type 'int', not 'int32_t'
    const effects: TGeneratorEffect[] = [];
    if (inner === INT32_MIN_LITERAL) {
      effects.push({ type: "include", header: "limits" });
      return { code: "(int32_t)INT32_MIN", effects };
    }
    if (inner === INT64_MIN_LITERAL || inner === INT64_MIN_LITERAL + "LL") {
      effects.push({ type: "include", header: "limits" });
      return { code: "(int64_t)INT64_MIN", effects };
    }
    return { code: `-${inner}`, effects };
  }
  if (unary.operator === "~") {
    const innerType = unary.operandType();
    if (innerType && TypeResolver.isUnsignedType(innerType)) {
      const cType = TYPE_MAP[innerType] ?? innerType;
      return { code: CppModeHelper.cast(cType, `~${inner}`), effects: [] };
    }
    return { code: `~${inner}`, effects: [] };
  }
  if (unary.operator === "&") return { code: `&${inner}`, effects: [] };

  // No operator: the base case, and the grammar-impossible fallback.
  return { code: inner, effects: [] };
};

export default generateUnaryExpr;
