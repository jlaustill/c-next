import type TExpression from "../types/syntax/TExpression";
import ExpressionChildren from "./ExpressionChildren";

/**
 * Whether a call appears anywhere in an expression (MISRA C:2012 Rule 13.6).
 *
 * A call is the only side effect a C-Next expression can have: assignment is
 * a statement, and increment and decrement are not expressions. E0602 in 2.1
 * and `sizeof`'s render invariant ask this one question, so the two cannot
 * disagree about what a side effect is (#1932).
 */
class ExpressionCalls {
  static containsCall(expr: TExpression): boolean {
    if (expr.kind === "postfix" && expr.ops.some((op) => op.kind === "call")) {
      return true;
    }
    return ExpressionChildren.of(expr).some((child) =>
      ExpressionCalls.containsCall(child),
    );
  }

  /**
   * Whether a call is one of an expression's own operations: through its
   * operators and unary prefixes, not into a parenthesized expression or a
   * call's arguments (#254, #366). E0890's side-effect check and MISRA
   * 13.5's controlling-expression check (E0702) both ask this one function.
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
      case "postfix":
        return expr.ops.some((op) => op.kind === "call");
      default:
        return false;
    }
  }
}

export default ExpressionCalls;
