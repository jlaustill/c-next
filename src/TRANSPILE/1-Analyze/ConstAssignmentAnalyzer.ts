/**
 * ADR-013 const enforcement: E0877, E0878.
 *
 * #1322. Four throws in `output/` -- three in `AssignmentValidator` (a
 * simple target, an array element, a member access, each asking
 * `TypeValidator.checkConstAssignment` about the ROOT name) and one in
 * `CallExprGenerator` for a const value passed to a non-const parameter --
 * every one reaching the user as `1:0`, across twenty-six fixtures that
 * assert that position.
 *
 * ## The root of the target is the whole question
 *
 * `CONFIG <- 5`, `table[0] <- 1`, `cfg.x <- 2`, `this.K +<- 1`: whatever the
 * form, the target is reached through one declared name, and that name's
 * const-ness decides (ADR-013 "every assignment form, one decision"). The
 * name is a parameter or a variable of the enclosing frames, a scope member
 * through `this.`, or -- a const declared in an included file -- a symbol of
 * the program.
 *
 * ## Two holes closed, probed
 *
 * A `for` header's assignment and update (`for (K <- 0; …; K +<- 1)`) never
 * reached `AssignmentValidator`, so `K += 1` was emitted against a `const`
 * and the C compiler rejected it. They carry an `assignmentTarget` like any
 * statement and are checked here on the same terms.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import ExpressionUnwrapper from "../../utils/ExpressionUnwrapper";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import ChainRoot from "../../utils/ChainRoot";
import FunctionReference from "./helpers/FunctionReference";
import BoundDeclaration from "./helpers/BoundDeclaration";
import SafeDivision from "./helpers/SafeDivision";
import IConstAssignmentError from "./types/IConstAssignmentError";
import TChainRoot from "../../types/TChainRoot";
import type IAnalysisContext from "./types/IAnalysisContext";

/** What kind of const binding a name is, or null when it is not const. */
type TConstKind = "parameter" | "variable" | null;

class ConstAssignmentListener extends CNextListener {
  private readonly found: IConstAssignmentError[] = [];

  public constructor(private readonly context: IAnalysisContext) {
    super();
  }

  public errors(): IConstAssignmentError[] {
    return this.found;
  }

  /** Every assignment form -- a statement, a `for` init, a `for` update. */
  override enterAssignmentTarget = (
    ctx: Parser.AssignmentTargetContext,
  ): void => {
    const name = ctx.IDENTIFIER().getText();
    const kind = this.constKind(ChainRoot.ofTarget(ctx), name, ctx);
    if (kind === null) return;

    const suffix = ConstAssignmentListener.targetSuffix(ctx.postfixTargetOp());
    this.report(
      ctx,
      "E0877",
      `cannot assign to const ${kind} '${name}'${suffix}`,
      kind === "parameter"
        ? "A const parameter is read-only for the whole function (ADR-013); remove `const` from the parameter if the function must change it."
        : "A const binding is read-only after its declaration (ADR-013); remove `const` if the value must change.",
    );
  };

  /** How the target's shape is named in E0877's message. */
  private static targetSuffix(
    ops: readonly Parser.PostfixTargetOpContext[],
  ): string {
    if (ops.some((op) => op.LBRACKET() !== null)) return " (array element)";
    if (ops.some((op) => op.DOT() !== null)) return " (member access)";
    return "";
  }

  /**
   * E0877 at a site that is not an assignment: ADR-051's `safe_div`/`safe_mod`
   * write their result through the FIRST argument, so a const there is written
   * to exactly as `K <- 1` writes to one.
   *
   * The const rule walks assignment targets and a call argument is not one, so
   * this site was invisible to it: `safe_div(K, 10, 2, 0)` emitted `&K` into a
   * non-const pointer parameter and reached the C compiler as
   * `discards 'const' qualifier`, at exit 0. Which argument is the output is
   * ADR-051's fact and is asked of `SafeDivision`, so this rule does not carry
   * a second opinion about the builtins' signature.
   */
  private checkSafeDivisionOutput(ctx: Parser.PostfixExpressionContext): void {
    const call = SafeDivision.callOf(ctx);
    if (call === null) return;
    const output = SafeDivision.outputName(call.args);
    if (output === null) return; // not a variable at all -- E0885's to report
    // Always a BARE name: `outputName` accepts only a plain identifier, so a
    // `this.`-rooted first argument returns null above and is E0885's to report.
    const kind = this.constKind(null, output, ctx);
    if (kind === null) return;
    this.report(
      call.args[0],
      "E0877",
      `cannot assign to const ${kind} '${output}' (${call.name} output)`,
      `${call.name} writes its result through its first argument, so a const cannot receive it; remove \`const\`, or pass a mutable variable (ADR-013).`,
    );
  }

  /** E0878: a const value passed where the callee may write. */
  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const call = ctx.postfixOp().find((op) => op.LPAREN() !== null);
    if (call === undefined) return;
    this.checkSafeDivisionOutput(ctx);
    const callee = FunctionReference.ofCall(
      ctx,
      OperandTyper.scopePathAt(ParserUtils.getPosition(ctx), this.context),
      this.context,
    );
    if (callee === null) return;
    const args = call.argumentList()?.expression() ?? [];
    args.forEach((arg, index) => {
      const param = callee.parameters[index];
      if (param === undefined || param.isConst) return;
      const argName = this.constArgumentName(arg);
      if (argName === null) return;
      this.report(
        arg,
        "E0878",
        `cannot pass const '${argName}' to non-const parameter '${param.name}' of function '${callee.name}'`,
        "The callee may write through that parameter; declare it `const` in the callee, or pass a mutable copy (ADR-013).",
      );
    });
  };

  // --- The facts -----------------------------------------------------------

  /**
   * The name of a const binding an argument IS -- `K`, `this.K`, `global.K`
   * -- or null for anything else (an expression has no binding to protect).
   */
  private constArgumentName(arg: Parser.ExpressionContext): string | null {
    const bare = ExpressionUnwrapper.getSimpleIdentifier(arg);
    if (bare !== null) {
      return this.constKind(null, bare, arg) === null ? null : bare;
    }
    const postfix = ExpressionUnwrapper.getPostfixExpression(arg);
    const primary = postfix?.primaryExpression();
    const ops = postfix?.postfixOp() ?? [];
    if (!postfix || !primary || ops.length !== 1 || ops[0].DOT() === null)
      return null;
    const name = ops[0].IDENTIFIER()?.getText();
    if (name === undefined) return null;
    const root = ChainRoot.ofPrimary(primary);
    if (root === null) return null;
    return this.constKind(root, name, arg) === null ? null : `${root}.${name}`;
  }

  /**
   * Whether the spelling `root.name`, as seen from `at`, is a const parameter,
   * a const variable, or neither.
   *
   * Which declaration the spelling binds to is Program's one binder's
   * decision (#1668), not this rule's: a local, a parameter, a scope member
   * or a global, this file's or an included one's, in ADR-057's order with
   * `this.` and `global.` stating where. #1322 review: this file once had its
   * own, with a `global.` arm and no `this.` arm -- so `this.STEP <- 5` with a
   * local `STEP` shadowing the const member resolved to the local, lost E0877,
   * and emitted `Board__STEP = 5U;` at exit 0.
   */
  private constKind(
    root: TChainRoot,
    name: string,
    at: ParserRuleContext,
  ): TConstKind {
    const binding = this.context.program.bindValue(
      this.context.sourceFile,
      root,
      name,
      ParserUtils.getPosition(at),
    );
    const declared = BoundDeclaration.of(binding);
    if (!declared?.isConst) return null;
    return declared.isParameter ? "parameter" : "variable";
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

class ConstAssignmentAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(tree: Parser.ProgramContext): IConstAssignmentError[] {
    const listener = new ConstAssignmentListener(this.context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default ConstAssignmentAnalyzer;
