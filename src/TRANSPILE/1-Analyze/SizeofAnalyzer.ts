/**
 * ADR-023's `sizeof` operand: E0601, E0602.
 *
 * #1322. Two throws in `SizeofResolver`, both carrying their code inside the
 * message text (`Error[E0601]: …`) and reaching the user as `1:0` -- a code
 * spelled into prose is not a code the tooling can see, which is why neither
 * appeared in `docs/error-codes.md` under its own row until now.
 *
 * ## E0601: the same spelling, opposite answers
 *
 * `sizeof(data)` measures the array when `data` is a local, and a POINTER when
 * it is a parameter -- ADR-006 passes arrays by reference, so the parameter is
 * a pointer whatever its declared dimensions say. The rule is therefore about
 * where the name is DECLARED, not about its type, which is why it asks
 * `EnclosingFunction.parameterOf` rather than the frames: a local array of the
 * same name and shape is fine.
 *
 * ## E0602: what a side effect actually is
 *
 * MISRA C:2012 Rule 13.6. Codegen tested the operand's TEXT for each of eleven
 * assignment operators before walking the tree for a call. Assignment is a
 * STATEMENT in this grammar, so none of those eleven could ever appear inside
 * a `sizeof` operand and all eleven were dead -- eleven lines that read as a
 * rule. A call is the only side effect an expression can have, and that is the
 * whole check here.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import ExpressionUnwrapper from "../../utils/ExpressionUnwrapper";
import ParserUtils from "../../utils/ParserUtils";
import EnclosingFunction from "./helpers/EnclosingFunction";
import ISizeofError from "./types/ISizeofError";

class SizeofListener extends CNextListener {
  private readonly found: ISizeofError[] = [];

  public errors(): ISizeofError[] {
    return this.found;
  }

  override enterSizeofExpression = (
    ctx: Parser.SizeofExpressionContext,
  ): void => {
    // The grammar is `sizeof '(' (type | expression) ')'` and tries TYPE
    // first, so a bare name -- which is what `sizeof(data)` is -- arrives as a
    // `userType` rather than as an expression. Both branches are read here for
    // that reason: reading only `expression()` finds nothing for the exact
    // spelling E0601 exists to reject.
    const bareName =
      ctx.type()?.userType() !== null && ctx.type() !== null
        ? ctx.type()!.getText()
        : null;
    const expr = ctx.expression();
    const name =
      bareName ??
      (expr === null ? null : ExpressionUnwrapper.getSimpleIdentifier(expr));

    if (name !== null) {
      const parameter = EnclosingFunction.parameterOf(name, ctx);
      if (parameter !== null && EnclosingFunction.isArrayParameter(parameter)) {
        this.report(
          ctx,
          "E0601",
          `sizeof() on array parameter '${name}' measures a pointer, not the array`,
          `An array parameter is passed by reference (ADR-006), so its size is the pointer's. Use ${name}.element_count for the count, or sizeof(elementType) * ${name}.element_count for the bytes.`,
        );
        return;
      }
    }

    if (expr !== null && SizeofListener.containsCall(expr)) {
      this.report(
        expr,
        "E0602",
        "sizeof() operand must not have side effects",
        "MISRA C:2012 Rule 13.6: `sizeof` does not evaluate its operand, so a call inside it never runs. Compute the value first and take the size of that.",
      );
    }
  };

  /**
   * Whether a call appears anywhere in the operand.
   *
   * A call is the only side effect an expression can have here: assignment is
   * a statement, and increment and decrement are not expressions either.
   */
  private static containsCall(node: ParserRuleContext): boolean {
    if (node instanceof Parser.PostfixExpressionContext) {
      if (node.postfixOp().some((op) => op.LPAREN() !== null)) return true;
    }
    for (let index = 0; index < node.getChildCount(); index += 1) {
      const child = node.getChild(index);
      if (
        child instanceof ParserRuleContext &&
        SizeofListener.containsCall(child)
      ) {
        return true;
      }
    }
    return false;
  }

  private report(
    at: ParserRuleContext,
    code: string,
    message: string,
    helpText: string,
  ): void {
    const { line, column } = ParserUtils.getPosition(at);
    this.found.push({ code, line, column, message, helpText });
  }
}

class SizeofAnalyzer {
  public analyze(tree: Parser.ProgramContext): ISizeofError[] {
    const listener = new SizeofListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default SizeofAnalyzer;
