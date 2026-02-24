/**
 * Unary Expression Generator (ADR-053 A2)
 *
 * Generates C code for unary expressions:
 * - Prefix operators: !, -, ~, &
 * - Recursive unary (e.g., !!x, --x)
 * - Delegates to postfix for base case
 */
import { UnaryExpressionContext } from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
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
 */
const generateUnaryExpr = (
  node: UnaryExpressionContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  // Base case: no unary operator, delegate to postfix
  if (node.postfixExpression()) {
    // Delegate to orchestrator for postfix expression
    // This allows CodeGenerator to handle postfix until it's extracted
    return {
      code: orchestrator.generatePostfixExpr(node.postfixExpression()!),
      effects: [],
    };
  }

  // Recursive case: unary operator applied
  // Call orchestrator.generateUnaryExpr for the inner expression
  // (this may come back to us or use CodeGenerator's version)
  const inner = orchestrator.generateUnaryExpr(node.unaryExpression()!);
  const text = node.getText();

  // Determine the operator and generate output
  if (text.startsWith("!")) return { code: `!${inner}`, effects: [] };
  if (text.startsWith("-")) {
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
  if (text.startsWith("~")) {
    const innerType = TypeResolver.getUnaryExpressionType(
      node.unaryExpression()!,
    );
    if (innerType && TypeResolver.isUnsignedType(innerType)) {
      const cType = TYPE_MAP[innerType] ?? innerType;
      return { code: CppModeHelper.cast(cType, `~${inner}`), effects: [] };
    }
    return { code: `~${inner}`, effects: [] };
  }
  if (text.startsWith("&")) return { code: `&${inner}`, effects: [] };

  // Fallback (shouldn't happen with valid grammar)
  return { code: inner, effects: [] };
};

export default generateUnaryExpr;
