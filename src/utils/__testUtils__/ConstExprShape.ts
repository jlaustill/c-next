import type TConstExpr from "../../types/TConstExpr";

/**
 * A compact spelling of a `TConstExpr`, so a test can state an expression's
 * shape in one string (#1175). One helper, not a copy per test file.
 */
class ConstExprShape {
  static of(expr: TConstExpr): string {
    switch (expr.kind) {
      case "literal":
        return expr.typeName === null
          ? expr.digits
          : `${expr.digits}:${expr.typeName}`;
      case "name":
        return [...(expr.root === null ? [] : [expr.root]), ...expr.path].join(
          ".",
        );
      case "sizeof":
        return `sizeof(${expr.typeName})`;
      case "cast":
        return `(${expr.typeName})${ConstExprShape.of(expr.operand)}`;
      case "unary":
        return `${expr.op}${ConstExprShape.of(expr.operand)}`;
      case "binary":
        return `(${ConstExprShape.of(expr.left)} ${expr.op} ${ConstExprShape.of(expr.right)})`;
      case "ternary":
        return `(${ConstExprShape.of(expr.condition)} ? ${ConstExprShape.of(expr.whenTrue)} : ${ConstExprShape.of(expr.whenFalse)})`;
      case "other":
        return `<${expr.what} ${expr.spelling}>`;
    }
  }

  /** Each slot's shape, or null where 1.3 already knew the size */
  static list(
    exprs: ReadonlyArray<TConstExpr | null> | undefined,
  ): (string | null)[] | undefined {
    return exprs?.map((expr) =>
      expr === null ? null : ConstExprShape.of(expr),
    );
  }
}

export default ConstExprShape;
