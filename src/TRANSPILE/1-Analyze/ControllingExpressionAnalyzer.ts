/**
 * ADR-022's controlling-expression rule: E0701 and E0702.
 *
 * #1322. Four throws in `TypeValidator`, all reaching the user as `1:0`, across
 * nineteen fixtures that assert that position.
 *
 * The rule itself is purely SYNTACTIC -- every leaf operand of a controlling
 * expression, after decomposing `||` and `&&`, must be an equality or
 * relational comparison. It reads the parse tree and nothing else, which makes
 * this the second family in a row that needed no capability 2.1 did not already
 * have. Only the help text asks a type question, and it asks it of the lexical
 * frames rather than of codegen's registry.
 *
 * ## The enumeration, named because it is the risk
 *
 * Five productions carry a controlling expression: `if`, `while`, `do-while`,
 * `for` and the ternary. There is no way to ask the grammar "which rules have
 * one" -- they are five listener methods, and a sixth production added later
 * would be silently unchecked. That is exactly how E0853 came to miss `switch`.
 *
 * Two things are done about it rather than hoped about it. The five delegate to
 * ONE check, so only the collection is enumerated and never the decision. And
 * `controlling-expression-every-kind-error` exercises all five in one file, so
 * its expected output carries five diagnostics: a kind that stops being visited
 * drops the count and fails the fixture. `forever` is deliberately absent from
 * the list -- it has no controlling expression, which is the point of it.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import ExpressionUtils from "../../utils/ExpressionUtils";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import IControllingExpressionError from "./types/IControllingExpressionError";
import IScopeFrame from "./types/IScopeFrame";
import OperandTypeResolver from "./OperandTypeResolver";
import ScopeFrameResolver from "./ScopeFrameResolver";

const CALL_HELP = "Store the function result in a variable first.";

class ControllingExpressionListener extends CNextListener {
  private readonly found: IControllingExpressionError[] = [];
  private readonly types: OperandTypeResolver;

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
    this.types = new OperandTypeResolver(scopes);
  }

  public errors(): IControllingExpressionError[] {
    return this.found;
  }

  // --- The five productions that carry a controlling expression -------------
  // Each one only NAMES its expression; the rule itself lives in `check`.

  override enterIfStatement = (ctx: Parser.IfStatementContext): void => {
    this.check(ctx.expression(), "if");
  };

  override enterWhileStatement = (ctx: Parser.WhileStatementContext): void => {
    this.check(ctx.expression(), "while");
  };

  override enterDoWhileStatement = (
    ctx: Parser.DoWhileStatementContext,
  ): void => {
    this.check(ctx.expression(), "do-while");
  };

  override enterForStatement = (ctx: Parser.ForStatementContext): void => {
    // `for (;;)` has no controlling expression at all -- that is E0707's case
    // (a disguised infinite loop), not this rule's.
    const condition = ctx.expression();
    if (condition) this.check(condition, "for");
  };

  override enterTernaryExpression = (
    ctx: Parser.TernaryExpressionContext,
  ): void => {
    if (ctx.COLON() === null) return;
    const condition = ctx.orExpression(0);
    // Addressed through `orExpression(0)`, never `getChild(0)`: the condition
    // is parenthesised, so child 0 is the `(` (CLAUDE.md).
    if (condition) this.checkOrExpression(condition, "ternary");
  };

  // --- The one decision -----------------------------------------------------

  private check(ctx: Parser.ExpressionContext, kind: string): void {
    if (ExpressionUtils.hasFunctionCall(ctx)) {
      this.reportCall(ctx, kind);
      return;
    }

    const orExprs = ctx.ternaryExpression().orExpression();
    if (orExprs.length !== 1) {
      // The controlling expression is itself a ternary.
      const { line, column } = ParserUtils.getPosition(ctx);
      this.found.push({
        code: "E0701",
        line,
        column,
        message: `${kind} condition must be a comparison, not a ternary`,
        helpText:
          "MISRA C:2012 Rule 14.4: lift the ternary into a variable and compare that.",
      });
      return;
    }

    this.checkComparison(orExprs[0], kind);
  }

  private checkOrExpression(
    ctx: Parser.OrExpressionContext,
    kind: string,
  ): void {
    if (ExpressionUtils.hasFunctionCallInOr(ctx)) {
      this.reportCall(ctx, kind);
      return;
    }
    this.checkComparison(ctx, kind);
  }

  /**
   * Every leaf operand, after decomposing `||` and `&&`, has to carry a
   * comparison operator of its own.
   *
   * A bare value, a bare bool, a literal or a negation is rejected: `!ready` is
   * not a comparison, and MISRA C:2012 Rule 14.4 wants the intent written out.
   */
  private checkComparison(
    orExpr: Parser.OrExpressionContext,
    kind: string,
  ): void {
    const andExprs = orExpr.andExpression();
    if (andExprs.length === 0) {
      this.reportNotComparison(orExpr, kind);
      return;
    }

    for (const andExpr of andExprs) {
      const equalityExprs = andExpr.equalityExpression();
      if (equalityExprs.length === 0) {
        this.reportNotComparison(orExpr, kind);
        return;
      }

      for (const equalityExpr of equalityExprs) {
        // An equality operator (`=`, `!=`) makes this operand a comparison.
        if (equalityExpr.relationalExpression().length > 1) continue;

        const relational = equalityExpr.relationalExpression(0);
        if (!relational) {
          this.reportNotComparison(orExpr, kind);
          return;
        }
        // A relational operator (`<`, `>`, `<=`, `>=`) does too.
        if (relational.bitwiseOrExpression().length > 1) continue;

        this.reportNotComparison(equalityExpr, kind);
        return;
      }
    }
  }

  private reportNotComparison(
    node: Parser.OrExpressionContext | Parser.EqualityExpressionContext,
    kind: string,
  ): void {
    const text = node.getText();
    const { line, column } = ParserUtils.getPosition(node);
    this.found.push({
      code: "E0701",
      line,
      column,
      message: `${kind} condition must be a comparison, not '${text}'`,
      helpText: `MISRA C:2012 Rule 14.4: ${this.suggestionFor(node, text)}`,
    });
  }

  private reportCall(
    node: Parser.ExpressionContext | Parser.OrExpressionContext,
    kind: string,
  ): void {
    const { line, column } = ParserUtils.getPosition(node);
    this.found.push({
      code: "E0702",
      line,
      column,
      message: `${kind} condition may not call a function: '${node.getText()}'`,
      helpText: `MISRA C:2012 Rule 13.5: ${CALL_HELP}`,
    });
  }

  /**
   * What to write instead.
   *
   * A `bool` gets `x = true` and anything else gets `x > 0`, so the suggestion
   * is asked of the operand's DECLARED type. It reads the lexical frames rather
   * than codegen's type registry -- the registry does not exist yet when this
   * pass runs, and the frames also honour shadowing, which the registry's flat
   * name lookup does not.
   */
  private suggestionFor(node: ParserRuleContext, text: string): string {
    const negated = text.startsWith("!");
    const base = negated ? text.slice(1) : text;
    const frame: IScopeFrame = this.scopes.frameFor(node);
    if (this.scopes.typeOfName(base, frame) === "bool") {
      return `write it out, e.g. ${base} = ${negated ? "false" : "true"}`;
    }
    return `write it out, e.g. ${text} > 0 or ${text} != 0`;
  }
}

class ControllingExpressionAnalyzer {
  public analyze(tree: Parser.ProgramContext): IControllingExpressionError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new ControllingExpressionListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default ControllingExpressionAnalyzer;
