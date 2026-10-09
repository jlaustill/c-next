import invariant from "./invariant";
import type TExpression from "../types/syntax/TExpression";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";

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
    return ExpressionCalls.children(expr).some((child) =>
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

  private static children(expr: TExpression): readonly TExpression[] {
    switch (expr.kind) {
      case "ternary":
        return [expr.condition, expr.whenTrue, expr.whenFalse];
      case "binary":
        return expr.operands;
      case "unary":
      case "cast":
        return [expr.operand];
      case "postfix":
        return [expr.primary, ...expr.ops.flatMap(ExpressionCalls.opChildren)];
      case "parenthesized":
        return [expr.expression];
      case "sizeof":
        return expr.expression === null ? [] : [expr.expression];
      case "structInitializer":
        return expr.fields.map((field) => field.value);
      case "arrayInitializer":
        return expr.fill === null
          ? expr.elements
          : [...expr.elements, expr.fill];
      case "identifier":
      case "root":
      case "literal":
      case "missing":
        return [];
      default:
        return ExpressionCalls.unhandled(expr);
    }
  }

  private static opChildren(op: TPostfixOpSyntax): readonly TExpression[] {
    switch (op.kind) {
      case "subscript":
        return op.indexes;
      case "call":
        return op.arguments;
      case "member":
      case "missing":
        return [];
      default:
        return ExpressionCalls.unhandled(op);
    }
  }

  /** A new expression or op kind is a compile error here until it is walked */
  private static unhandled(value: never): never {
    invariant(
      false,
      `ExpressionCalls walks every kind: ${JSON.stringify(value)}`,
    );
  }
}

export default ExpressionCalls;
