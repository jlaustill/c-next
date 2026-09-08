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

import * as Parser from "../../../transpiler/logic/parser/grammar/CNextParser";
import ExpressionUnwrapper from "../../../utils/ExpressionUnwrapper";

/** The two ADR-051 builtins, which share a signature. */
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
  static callOf(ctx: Parser.PostfixExpressionContext): {
    name: string;
    args: Parser.ExpressionContext[];
  } | null {
    const primary = ctx.primaryExpression();
    const ops = ctx.postfixOp();
    if (!primary || ops.length !== 1) return null;
    const name = primary.IDENTIFIER()?.getText();
    if (name === undefined || !SAFE_DIVISION.has(name)) return null;
    if (ops[0].LPAREN() === null) return null;
    return { name, args: ops[0].argumentList()?.expression() ?? [] };
  }

  /**
   * The name the call writes its result to, or null when the first argument is
   * not a plain variable name. ADR-051 needs a storage location: the helper
   * takes its address.
   */
  static outputName(args: readonly Parser.ExpressionContext[]): string | null {
    const first = args[0];
    return first === undefined
      ? null
      : ExpressionUnwrapper.getSimpleIdentifier(first);
  }
}

export default SafeDivision;
