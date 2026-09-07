/**
 * ADR-068 loops and ADR-026 break/continue: E0703, E0705, E0707.
 *
 * #1322. Four throws in `output/` -- `CodeGenerator` for `break`/`continue`,
 * `ControlFlowGenerator` for `for (;;)` and for `forever` in a non-void
 * function, `TypeValidator` for an always-true literal condition -- three of
 * them reaching the user as `1:0`. Every one is a fact of the parse tree:
 * which keyword was written, whether a `for` header has a condition, what the
 * enclosing function's declared type is, and what two literals compare to.
 *
 * ## The always-true slice is the LITERAL slice, as it was
 *
 * `while (1 = 1)`, `5 > 3`, `true = true`, `1 != 2`: a single comparison of
 * two integer or boolean literals. Named constants, compound conditions,
 * floats, and always-FALSE conditions are #1076's (the full MISRA 14.3 effort)
 * and are deliberately not decided here; this pass moves the rule, it does not
 * widen it. A leading-zero integer (`0777`) is emitted verbatim and read by C
 * as OCTAL, so it is skipped rather than parsed as decimal -- the verdict has
 * to agree with the generated code's value.
 *
 * E0701 (a condition must be a comparison) runs earlier in the same pass and
 * halts, so a condition reaching the always-true check is already a
 * comparison -- the ordering codegen relied on, kept by the step order.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import REJECTED_KEYWORDS from "../../transpiler/constants/REJECTED_KEYWORDS";
import LiteralUtils from "../../utils/LiteralUtils";
import ParserUtils from "../../utils/ParserUtils";
import ILoopError from "./types/ILoopError";

const FOREVER_HELP = "write 'forever { ... }' for an intentional infinite loop";

/** A single comparison of two compile-time literals. */
interface ILiteralComparison {
  readonly operator: string;
  readonly left: number;
  readonly right: number;
}

class LoopListener extends CNextListener {
  private readonly found: ILoopError[] = [];

  public errors(): ILoopError[] {
    return this.found;
  }

  /** E0703: `break;` and `continue;` parse as a bare identifier expression. */
  override enterPrimaryExpression = (
    ctx: Parser.PrimaryExpressionContext,
  ): void => {
    const id = ctx.IDENTIFIER()?.getText();
    if (id === undefined || !REJECTED_KEYWORDS.has(id)) return;
    this.report(
      ctx,
      "E0703",
      `'${id}' is not supported in C-Next - use structured conditions instead`,
      "ADR-026 rejects `break` and `continue`: an early exit hides the loop's real condition. Fold the exit into the loop condition, or split the body into a function that returns.",
    );
  };

  /** E0705: `forever` never yields a value, so only a void function may hold one. */
  override enterForeverStatement = (
    ctx: Parser.ForeverStatementContext,
  ): void => {
    const returnType = LoopListener.enclosingFunctionType(ctx);
    if (returnType === null || returnType === "void") return;
    this.report(
      ctx,
      "E0705",
      "forever loop in non-void function",
      "a forever loop never returns a value; make the function return void, or use a while loop with an exit condition",
    );
  };

  /** E0707: `for (;;)` is an infinite loop with the wrong spelling. */
  override enterForStatement = (ctx: Parser.ForStatementContext): void => {
    const condition = ctx.expression();
    if (condition === null) {
      this.report(
        ctx,
        "E0707",
        "for-loop has no controlling expression (infinite loop)",
        FOREVER_HELP,
      );
      return;
    }
    this.checkAlwaysTrue(condition);
  };

  override enterWhileStatement = (ctx: Parser.WhileStatementContext): void => {
    this.checkAlwaysTrue(ctx.expression());
  };

  override enterDoWhileStatement = (
    ctx: Parser.DoWhileStatementContext,
  ): void => {
    this.checkAlwaysTrue(ctx.expression());
  };

  /** E0707: an always-true literal comparison as a loop condition. */
  private checkAlwaysTrue(condition: Parser.ExpressionContext): void {
    const comparison = LoopListener.asSingleLiteralComparison(condition);
    if (comparison === null || !LoopListener.isAlwaysTrue(comparison)) return;
    this.report(
      condition,
      "E0707",
      `loop condition '${condition.getText()}' is always true`,
      FOREVER_HELP,
    );
  }

  /** The declared type of the function a statement sits in, or null outside one. */
  private static enclosingFunctionType(node: ParserRuleContext): string | null {
    let cursor: ParserRuleContext | null = node.parent;
    while (cursor) {
      if (cursor instanceof Parser.FunctionDeclarationContext) {
        return cursor.type().getText();
      }
      cursor = cursor.parent;
    }
    return null;
  }

  /**
   * `ctx` as a single comparison of two literal operands -- no `||`/`&&`, no
   * ternary, no chaining -- or null. Anything involving identifiers, floats or
   * sub-expressions is left to #1076.
   */
  private static asSingleLiteralComparison(
    ctx: Parser.ExpressionContext,
  ): ILiteralComparison | null {
    const orExprs = ctx.ternaryExpression().orExpression();
    if (orExprs.length !== 1) return null;
    const andExprs = orExprs[0].andExpression();
    if (andExprs.length !== 1) return null;
    const equalityExprs = andExprs[0].equalityExpression();
    if (equalityExprs.length !== 1) return null;
    const equality = equalityExprs[0];

    const relationalExprs = equality.relationalExpression();
    if (relationalExprs.length === 2) {
      // relExpr ('=' | '!=') relExpr
      return LoopListener.literalComparison(
        equality.getChild(1)?.getText(),
        relationalExprs[0].getText(),
        relationalExprs[1].getText(),
      );
    }
    if (relationalExprs.length === 1) {
      const operands = relationalExprs[0].bitwiseOrExpression();
      if (operands.length === 2) {
        // orExpr ('<' | '>' | '<=' | '>=') orExpr
        return LoopListener.literalComparison(
          relationalExprs[0].getChild(1)?.getText(),
          operands[0].getText(),
          operands[1].getText(),
        );
      }
    }
    return null;
  }

  private static literalComparison(
    operator: string | undefined,
    leftText: string,
    rightText: string,
  ): ILiteralComparison | null {
    const left = LoopListener.literalValue(leftText);
    const right = LoopListener.literalValue(rightText);
    if (operator === undefined || left === null || right === null) return null;
    return { operator, left, right };
  }

  /**
   * Strict literal-to-number: integer literals (decimal, hex, binary, with an
   * optional type suffix) and `true`/`false`. Everything else is not
   * compile-time-known here.
   */
  private static literalValue(text: string): number | null {
    if (text === "true") return 1;
    if (text === "false") return 0;
    if (text.includes(".")) return null;
    // `0777` is octal to C; a decimal parse would disagree with the emitted
    // value, so it is left alone (#1076).
    if (/^0\d/.test(text)) return null;
    const match = /^(0[xX][\da-fA-F]+|0[bB][01]+|\d+)([uUiI]\d+)?$/.exec(text);
    if (match === null) return null;
    return LiteralUtils.parseIntegerLiteral(match[1]) ?? null;
  }

  private static isAlwaysTrue(comparison: ILiteralComparison): boolean {
    const { left, right } = comparison;
    switch (comparison.operator) {
      case "=":
        return left === right;
      case "!=":
        return left !== right;
      case "<":
        return left < right;
      case ">":
        return left > right;
      case "<=":
        return left <= right;
      case ">=":
        return left >= right;
      default:
        return false;
    }
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

class LoopAnalyzer {
  public analyze(tree: Parser.ProgramContext): ILoopError[] {
    const listener = new LoopListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default LoopAnalyzer;
