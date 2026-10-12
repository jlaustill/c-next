/**
 * ADR-051's `safe_div` / `safe_mod` calls, and which argument they write to.
 *
 * #1322: two rules ask the same thing of these calls and they are not the same
 * rule. ADR-051 governs their SHAPE -- four arguments, the first a variable to
 * receive the quotient (E0884/E0885). ADR-013 governs const-ness, and the
 * first argument is written through, so a `const` there is an assignment to a
 * const exactly as `K <- 1` is (E0877).
 *
 * The fact both need -- "argument 0 of this call is an output parameter" -- is
 * a property of these two builtins and belongs in one place. Before it was
 * shared, the const rule could not see the site at all: it walks assignment
 * targets, and this is a call argument. `safe_div(K, 10, 2, 0)` emitted `&K`
 * into a non-const pointer parameter, which gcc rejects with
 * `discards 'const' qualifier`, at exit 0.
 */

import type TExpression from "../../../types/syntax/TExpression";
import ExpressionShape from "../../../utils/ExpressionShape";

const SAFE_DIVISION = new Set(["safe_div", "safe_mod"]);

class SafeDivision {
  /**
   * The call this postfix expression is, when it is one of ADR-051's, with the
   * arguments as written. Null for anything else.
   *
   * The name must be a bare primary identifier followed by exactly one call
   * op: `safe_div(...)`. A member access that happens to end in the same name
   * is a different function.
   */
  static callOf(
    expr: TExpression,
  ): { name: string; args: readonly TExpression[] } | null {
    if (expr.kind !== "postfix" || expr.ops.length !== 1) return null;
    if (expr.primary.kind !== "identifier") return null;
    const name = expr.primary.name;
    const op = expr.ops[0];
    if (!SAFE_DIVISION.has(name) || op.kind !== "call") return null;
    return { name, args: op.arguments };
  }

  static outputName(args: readonly TExpression[]): string | null {
    const first = args[0];
    return first === undefined ? null : ExpressionShape.simpleIdentifier(first);
  }
}

export default SafeDivision;
