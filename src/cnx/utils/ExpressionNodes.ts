import type TExpression from "../types/syntax/TExpression";
import type TSyntaxPart from "../types/syntax/TSyntaxPart";
import ExpressionChildren from "./ExpressionChildren";
import TypeParts from "./TypeParts";

/**
 * Every expression in one part of 1.2's syntax, nested ones included, through
 * the types an expression names (a cast's, a `sizeof`'s) and the dimensions
 * those types carry (#1991). A rule that asks "is there an X anywhere here"
 * reads this instead of walking the parse tree.
 */
class ExpressionNodes {
  static of(part: TSyntaxPart): readonly TExpression[] {
    return part.kind === "type"
      ? TypeParts.of(part.type).flatMap(ExpressionNodes.of)
      : ExpressionNodes.expression(part.expression);
  }

  private static expression(expr: TExpression): readonly TExpression[] {
    return [
      expr,
      ...ExpressionChildren.of(expr).flatMap(ExpressionNodes.expression),
      ...ExpressionNodes.namedTypes(expr).flatMap(ExpressionNodes.of),
    ];
  }

  private static namedTypes(expr: TExpression): readonly TSyntaxPart[] {
    if (expr.kind === "cast") return [{ kind: "type", type: expr.type }];
    if (expr.kind === "sizeof" && expr.type !== null) {
      return [{ kind: "type", type: expr.type }];
    }
    return [];
  }
}

export default ExpressionNodes;
