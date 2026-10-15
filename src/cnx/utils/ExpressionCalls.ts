import type TExpression from "../types/syntax/TExpression";

/** Where an expression calls a function (#254, #366) */
class ExpressionCalls {
  /**
   * Whether a call is one of an expression's own operations: through its
   * operators, unary prefixes and brackets, not into a call's arguments or a
   * subscript (#254, #366). A bracketed call is still a call: `(isValid())`
   * runs exactly as `isValid()` does (#1195). E0890's side-effect check and
   * MISRA 13.5's controlling-expression check (E0702) both ask this one
   * function.
   */
  static callsAtTop(expr: TExpression): boolean {
    switch (expr.kind) {
      case "ternary":
        return [expr.condition, expr.whenTrue, expr.whenFalse].some((arm) =>
          ExpressionCalls.callsAtTop(arm),
        );
      case "binary":
        return expr.operands.some((operand) =>
          ExpressionCalls.callsAtTop(operand),
        );
      case "unary":
        return ExpressionCalls.callsAtTop(expr.operand);
      case "parenthesized":
        return ExpressionCalls.callsAtTop(expr.expression);
      case "postfix":
        return expr.ops.some((op) => op.kind === "call");
      default:
        return false;
    }
  }
}

export default ExpressionCalls;
