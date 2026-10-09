import type TExpression from "../types/syntax/TExpression";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";
import type IChainHead from "../types/IChainHead";

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

  /**
   * A chain's head. A `this.`/`global.` root consumes the chain's first op, and
   * only a member op names it (`this[0]` names nothing). The typer, render's
   * subscript base and `UndeclaredValueAnalyzer` all ask this one function, for
   * expressions and assignment targets alike (#1932).
   */
  static headOf(chain: TExpression): IChainHead {
    const view = ExpressionShape.postfixView(chain);
    const primary = view?.primary ?? chain;
    const ops = view?.ops ?? [];
    if (primary.kind === "root") {
      const first = ops[0];
      const identifier =
        first?.kind === "member"
          ? { name: first.name, span: first.nameSpan }
          : null;
      return { primary, root: primary.root, identifier, ops, opsConsumed: 1 };
    }
    const identifier =
      primary.kind === "identifier"
        ? { name: primary.name, span: primary.span }
        : null;
    return { primary, root: null, identifier, ops, opsConsumed: 0 };
  }

  /**
   * The two operands of a two-operand `+`, or null for anything else: the
   * shape of an ADR-045 concatenation. Subtraction is rejected on the
   * operator, not the text, because a name or a string literal may contain a
   * hyphen (#1445).
   */
  static additionOperands(
    expr: TExpression,
  ): readonly [TExpression, TExpression] | null {
    if (
      expr.kind !== "binary" ||
      expr.level !== "additive" ||
      expr.operands.length !== 2 ||
      expr.operators[0] !== "+"
    ) {
      return null;
    }
    return [expr.operands[0], expr.operands[1]];
  }

  /**
   * An identifier with exactly one subscript applied, `s[i]` or `s[i, n]`:
   * the shape of an ADR-045 substring. The sibling of `simpleIdentifier`.
   */
  static subscriptedIdentifier(expr: TExpression): {
    readonly name: string;
    readonly indexes: readonly TExpression[];
  } | null {
    if (expr.kind !== "postfix" || expr.primary.kind !== "identifier") {
      return null;
    }
    const [op, ...rest] = expr.ops;
    if (op?.kind !== "subscript" || rest.length > 0) return null;
    return { name: expr.primary.name, indexes: op.indexes };
  }
}

export default ExpressionShape;
