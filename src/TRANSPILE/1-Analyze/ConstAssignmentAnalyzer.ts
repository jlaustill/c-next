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
import QualifiedCName from "../../utils/QualifiedCName";
import ScopeUtils from "../../utils/ScopeUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
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

    const ops = ctx.postfixTargetOp();
    const suffix = ops.some((op) => op.LBRACKET() !== null)
      ? " (array element)"
      : ops.some((op) => op.DOT() !== null)
        ? " (member access)"
        : "";
    this.report(
      ctx,
      "E0877",
      `cannot assign to const ${kind} '${name}'${suffix}`,
      kind === "parameter"
        ? "A const parameter is read-only for the whole function (ADR-013); remove `const` from the parameter if the function must change it."
        : "A const binding is read-only after its declaration (ADR-013); remove `const` if the value must change.",
    );
  };

  /** E0878: a const value passed where the callee may write. */
  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const call = ConstAssignmentListener.callOf(ctx);
    if (call === null) return;
    const frame = this.scopes.frameFor(ctx);
    const callee = this.calleeParameters(ctx, frame);
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
      return ConstAssignmentListener.isParameterOf(name, at)
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

  /** Whether `name` is a parameter of the function enclosing `at`. */
  private static isParameterOf(name: string, at: ParserRuleContext): boolean {
    let cursor: ParserRuleContext | null = at.parent;
    while (cursor) {
      if (cursor instanceof Parser.FunctionDeclarationContext) {
        return (
          cursor
            .parameterList()
            ?.parameter()
            .some((p) => p.IDENTIFIER().getText() === name) ?? false
        );
      }
      cursor = cursor.parent;
    }
    return false;
  }

  /** The `(args)` op of a call chain whose callee is a name, or null. */
  private static callOf(
    ctx: Parser.PostfixExpressionContext,
  ): Parser.PostfixOpContext | null {
    const ops = ctx.postfixOp();
    const last = ops[ops.length - 1];
    if (!last || last.LPAREN() === null) return null;
    // Every op before the call must be a `.name` step: `f(...)`, `this.f(...)`,
    // `Scope.f(...)`. A subscript or a second call is not a named callee.
    return ops.slice(0, -1).every((op) => op.DOT() !== null) ? last : null;
  }

  /**
   * The C-Next function a call names, with its parameters, or null for a
   * foreign function (no const facts) or an unresolvable name.
   */
  private calleeParameters(
    ctx: Parser.PostfixExpressionContext,
    frame: IScopeFrame,
  ): {
    name: string;
    parameters: readonly { name: string; isConst: boolean }[];
  } | null {
    const program = CodeGenState.program;
    const primary = ctx.primaryExpression();
    if (!program || !primary) return null;
    const steps = ctx
      .postfixOp()
      .slice(0, -1)
      .map((op) => op.IDENTIFIER()?.getText() ?? "");
    const here = frame.scopePath;
    let candidates: string[];
    if (primary.THIS()) {
      candidates =
        here === ""
          ? []
          : [
              ScopeUtils.getTranspiledCName({
                scopePath: here,
                name: steps[0],
              }),
            ];
    } else if (primary.GLOBAL()) {
      candidates = [QualifiedCName.fromParts(steps)];
    } else {
      const head = primary.IDENTIFIER()?.getText();
      if (head === undefined) return null;
      const parts = [head, ...steps];
      candidates = [QualifiedCName.fromParts(parts)];
      if (parts.length === 1 && here !== "") {
        candidates.unshift(
          ScopeUtils.getTranspiledCName({ scopePath: here, name: head }),
        );
      }
    }
    for (const cName of candidates) {
      const symbol = program.symbolByCName(cName);
      if (symbol?.kind === "function") {
        return { name: symbol.name, parameters: symbol.parameters };
      }
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
