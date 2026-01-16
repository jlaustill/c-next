/**
 * Unary Expression Generator (ADR-053 A2)
 *
 * Generates C code for unary expressions:
 * - Prefix operators: !, -, ~, &
 * - Recursive unary (e.g., !!x, --x)
 * - Delegates to postfix for base case
 */
import { UnaryExpressionContext } from "../../../parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";

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
  if (text.startsWith("-")) return { code: `-${inner}`, effects: [] };
  if (text.startsWith("~")) return { code: `~${inner}`, effects: [] };
  if (text.startsWith("&")) return { code: `&${inner}`, effects: [] };

  // Fallback (shouldn't happen with valid grammar)
  return { code: inner, effects: [] };
};

export default generateUnaryExpr;
