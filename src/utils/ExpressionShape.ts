import type TExpression from "../types/syntax/TExpression";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";

/**
 * Shape questions over a lowered expression, asked by 2.1 Analyze (which lowers
 * at the call) and by render alike, so the two cannot disagree (#1932).
 */
class ExpressionShape {
  /**
   * The expression as a primary and its postfix operations, when it is one --
   * no unary, binary or ternary operator at its top.
   */
  static postfixView(expr: TExpression): {
    readonly primary: TExpression;
    readonly ops: readonly TPostfixOpSyntax[];
  } | null {
    switch (expr.kind) {
      case "ternary":
      case "binary":
      case "unary":
      case "missing":
        return null;
      case "postfix":
        return { primary: expr.primary, ops: expr.ops };
      default:
        return { primary: expr, ops: [] };
    }
  }

  /** The identifier a postfix chain starts from, or null */
  static rootName(expr: TExpression): string | null {
    const view = ExpressionShape.postfixView(expr);
    return view?.primary.kind === "identifier" ? view.primary.name : null;
  }

  /**
   * The name an expression IS -- a bare identifier, no member, subscript or
   * call -- or null. Render's `sizeof` plan and E0601, the call-argument plan
   * and SafeDivision/ConstAssignment ask this one function (#1445, #1932).
   */
  static simpleIdentifier(expr: TExpression): string | null {
    const view = ExpressionShape.postfixView(expr);
    return view?.ops.length === 0 ? ExpressionShape.rootName(expr) : null;
  }
}

export default ExpressionShape;
