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

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../transpiler/state/CodeGenState";
import ExpressionUnwrapper from "../../utils/ExpressionUnwrapper";
import ParserUtils from "../../utils/ParserUtils";
import ScopeUtils from "../../utils/ScopeUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import EnclosingFunction from "./helpers/EnclosingFunction";
import FunctionReference from "./helpers/FunctionReference";
import SafeDivision from "./helpers/SafeDivision";
import IConstAssignmentError from "./types/IConstAssignmentError";
import IScopeFrame from "./types/IScopeFrame";
import ScopeFrameResolver from "./ScopeFrameResolver";

/** What kind of const binding a name is, or null when it is not const. */
type TConstKind = "parameter" | "variable" | null;

class ConstAssignmentListener extends CNextListener {
  private readonly found: IConstAssignmentError[] = [];

  public constructor(private readonly scopes: ScopeFrameResolver) {
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
    const frame = this.scopes.frameFor(ctx);
    const kind = ctx.GLOBAL()
      ? this.constKindAtFileScope(name, frame)
      : this.constKind(name, ctx, frame);
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
  private checkSafeDivisionOutput(
    ctx: Parser.PostfixExpressionContext,
    frame: IScopeFrame,
  ): void {
    const call = SafeDivision.callOf(ctx);
    if (call === null) return;
    const output = SafeDivision.outputName(call.args);
    if (output === null) return; // not a variable at all -- E0885's to report
    const kind = this.constKind(output, ctx, frame);
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
    const frame = this.scopes.frameFor(ctx);
    this.checkSafeDivisionOutput(ctx, frame);
    const callee = FunctionReference.ofCall(ctx, frame.scopePath);
    if (callee === null) return;
    const args = call.argumentList()?.expression() ?? [];
    args.forEach((arg, index) => {
      const param = callee.parameters[index];
      if (param === undefined || param.isConst) return;
      const argName = this.constArgumentName(arg, frame);
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
  private constArgumentName(
    arg: Parser.ExpressionContext,
    frame: IScopeFrame,
  ): string | null {
    const bare = ExpressionUnwrapper.getSimpleIdentifier(arg);
    if (bare !== null) {
      return this.constKind(bare, arg, frame) === null ? null : bare;
    }
    const postfix = ExpressionUnwrapper.getPostfixExpression(arg);
    const primary = postfix?.primaryExpression();
    const ops = postfix?.postfixOp() ?? [];
    if (!postfix || !primary || ops.length !== 1 || ops[0].DOT() === null)
      return null;
    const name = ops[0].IDENTIFIER()?.getText();
    if (name === undefined) return null;
    if (primary.THIS()) {
      return this.constKind(name, arg, frame) === null ? null : `this.${name}`;
    }
    if (primary.GLOBAL()) {
      return this.constKindAtFileScope(name, frame) === null
        ? null
        : `global.${name}`;
    }
    return null;
  }

  /**
   * Whether `name`, as seen from `at`, is a const parameter, a const variable,
   * or neither. The frames answer first (a local shadows everything); a name
   * they do not hold may be a const declared in another file, which the
   * program's symbols answer.
   */
  private constKind(
    name: string,
    at: ParserRuleContext,
    frame: IScopeFrame,
  ): TConstKind {
    const declared = this.scopes.declarationOfNameLexical(name, frame);
    if (declared !== null) {
      if (!declared.isConst) return null;
      return EnclosingFunction.parameterOf(name, at) !== null
        ? "parameter"
        : "variable";
    }
    return ConstAssignmentListener.constSymbol(name, frame.scopePath);
  }

  /** `global.name`: the file-scope declaration only, never a scope member. */
  private constKindAtFileScope(name: string, frame: IScopeFrame): TConstKind {
    let root: IScopeFrame = frame;
    while (root.parent !== null) root = root.parent;
    const declared = root.vars.get(name);
    if (declared !== undefined) return declared.isConst ? "variable" : null;
    return ConstAssignmentListener.constSymbol(name, "");
  }

  /** A const the program declares under this name -- here, or in an include. */
  private static constSymbol(name: string, scopePath: string): TConstKind {
    const program = CodeGenState.program;
    if (!program) return null;
    const candidates = [name];
    if (scopePath !== "") {
      candidates.unshift(ScopeUtils.getTranspiledCName({ scopePath, name }));
    }
    for (const cName of candidates) {
      const symbol = program.symbolByCName(cName);
      if (symbol?.kind === "variable")
        return symbol.isConst ? "variable" : null;
    }
    return null;
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
  public analyze(tree: Parser.ProgramContext): IConstAssignmentError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new ConstAssignmentListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default ConstAssignmentAnalyzer;
