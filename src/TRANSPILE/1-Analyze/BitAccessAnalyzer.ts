/**
 * ADR-007 bit indexing: E0856, E0888.
 *
 * #1322. Two throws, both reported as `1:0` after building a position into
 * their own message text (`Error at line N: …`) -- a position carried as prose
 * rather than by the diagnostic.
 *
 * ## E0856: how many subscripts a base allows
 *
 * ADR-036 gives an array one subscript per dimension; ADR-007 gives a
 * bit-indexable scalar one more, for the bit. So `arr[i][b]` is the last legal
 * form for a one-dimensional array and `arr[i][b][x]` indexes a value that is
 * not an array.
 *
 * Only integer and float bases are checked, as codegen did: a string is a char
 * array with its own rules, a bitmap rejects bracket indexing under E0883, and
 * a struct is reached through member access instead.
 *
 * ## E0888: a float bit range needs somewhere to put the union
 *
 * Reading `f[start, width]` on a float is lowered to a union copy (MISRA
 * C:2012 Rule 21.15 forbids the pointer cast), and a union copy is a
 * statement. At file scope there is no statement to emit it into. This is the
 * one rule here that is about WHERE the access is written rather than what it
 * is written on.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import ChainRoot from "./helpers/ChainRoot";
import EnclosingFunction from "./helpers/EnclosingFunction";
import TypeText from "./helpers/TypeText";
import IDeclaredVar from "./types/IDeclaredVar";
import IBitAccessError from "./types/IBitAccessError";
import TChainRoot from "./types/TChainRoot";
import ScopeFrameResolver from "./ScopeFrameResolver";

/** The floats a bit range is lowered through a union for. */
const FLOAT_TYPES = new Set(["f32", "f64"]);

class BitAccessListener extends CNextListener {
  private readonly found: IBitAccessError[] = [];

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
  }

  public errors(): IBitAccessError[] {
    return this.found;
  }

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const primary = ctx.primaryExpression();
    if (!primary) return;

    // `this.x[…]` names the declaration in its first op; a bare `x[…]` in the
    // primary. Anything else is not a name this rule can measure.
    const ops = ctx.postfixOp();
    const root = ChainRoot.ofPrimary(primary);
    const name = BitAccessListener.nameOf(primary, ops, root);
    if (name === undefined) return;

    this.checkChain(name, ops.slice(root === null ? 0 : 1), ctx, root);
  };

  /**
   * The declared name a postfix chain leads with. A rooted chain spends its
   * primary on the keyword and puts the name in the first op, so the two
   * shapes read from different offsets -- and a rooted chain whose first op is
   * a subscript rather than a `.name` names nothing this rule can measure.
   */
  private static nameOf(
    primary: Parser.PrimaryExpressionContext,
    ops: readonly Parser.PostfixOpContext[],
    root: TChainRoot,
  ): string | undefined {
    if (root === null) return primary.IDENTIFIER()?.getText();
    const first = ops[0];
    if (first === undefined || first.DOT() === null) return undefined;
    return first.IDENTIFIER()?.getText();
  }

  /**
   * A target is not an expression. `flags[4][3] <- 5` is an
   * `assignmentTarget`, whose ops are `postfixTargetOp` -- a different node
   * type that `enterPostfixExpression` never sees. Both fixtures for E0856 are
   * writes, so a rule reading only expressions caught neither of them.
   */
  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    const target = ctx.assignmentTarget();
    const name = target.IDENTIFIER()?.getText();
    if (name === undefined) return;
    // A target carries its root as its own token, so the name is always the
    // target's IDENTIFIER and no op is consumed.
    this.checkChain(
      name,
      target.postfixTargetOp(),
      target,
      ChainRoot.ofTarget(target),
    );
  };

  private checkChain(
    name: string,
    subscripts: readonly (
      | Parser.PostfixOpContext
      | Parser.PostfixTargetOpContext
    )[],
    at: ParserRuleContext,
    root: TChainRoot,
  ): void {
    const declared = this.declarationFor(name, at, root);
    if (declared === null) return; // not a declaration this pass can measure

    const spelling = root === null ? name : `${root}.${name}`;
    const baseType = TypeText.withoutDimensions(declared.typeText);
    this.checkFloatRangeScope(subscripts, baseType, spelling, at);
    this.checkDepth(
      subscripts,
      declared.dimensions.length,
      baseType,
      spelling,
      at,
    );
  }

  /**
   * The declaration a spelling names.
   *
   * #1322 review: this had its own answer, and it was wrong for `this.`. It
   * gave `global.` a file-scope arm and sent `this.` down the same outward walk
   * as a bare name, so a local shadowing a scope member captured it -- and the
   * `invariant()` that replaced codegen's throw then fired, telling the user
   * 2.1 had rejected a program it had silently let through. One resolver now.
   */
  private declarationFor(
    name: string,
    at: ParserRuleContext,
    root: TChainRoot,
  ): IDeclaredVar | null {
    return this.scopes.declarationFor(root, name, this.scopes.frameFor(at));
  }

  /**
   * E0888: a float bit RANGE read outside a function body. A single bit index
   * is not lowered through a union, so it is not restricted.
   */
  private checkFloatRangeScope(
    subscripts: readonly (
      | Parser.PostfixOpContext
      | Parser.PostfixTargetOpContext
    )[],
    baseType: string,
    name: string,
    at: ParserRuleContext,
  ): void {
    if (!FLOAT_TYPES.has(baseType)) return;
    if (EnclosingFunction.of(at) !== null) return;
    const range = subscripts.find(
      (op) => op.LBRACKET() !== null && op.expression().length === 2,
    );
    if (range === undefined) return;
    const bounds = range.expression().map((e) => e.getText());
    this.report(
      at,
      "E0888",
      `Float bit range '${name}[${bounds.join(", ")}]' cannot be read at file scope`,
      "Reading a float's bits copies it through a union (MISRA C:2012 Rule 21.15 forbids the pointer cast), and a copy is a statement -- there is none at file scope. Read it inside a function.",
    );
  }

  /**
   * E0856: ADR-036 allows one subscript per array dimension and ADR-007 one
   * more for a bit index. Only a bit-indexable scalar element has that extra
   * one, which is why the base type decides.
   */
  private checkDepth(
    subscripts: readonly (
      | Parser.PostfixOpContext
      | Parser.PostfixTargetOpContext
    )[],
    dimensions: number,
    baseType: string,
    name: string,
    at: ParserRuleContext,
  ): void {
    if (TYPE_WIDTH[baseType] === undefined) return; // not a bit-indexable scalar
    let leading = 0;
    for (const op of subscripts) {
      if (op.LBRACKET() === null) break;
      leading += 1;
    }
    const allowed = dimensions + 1;
    if (leading <= allowed) return;

    const shape =
      dimensions === 0
        ? `a scalar '${baseType}'`
        : `a ${dimensions}-dimensional '${baseType}' array`;
    this.report(
      at,
      "E0856",
      `too many subscripts on '${name}': it is ${shape}, so it allows at most ${allowed}`,
      `${dimensions} for the array ${dimensions === 1 ? "dimension" : "dimensions"} plus one optional bit index (ADR-036/ADR-007). Indexing further indexes a value that is not an array. Did you mean the bit range '${name}[start, width]'?`,
    );
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

class BitAccessAnalyzer {
  public analyze(tree: Parser.ProgramContext): IBitAccessError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);
    const listener = new BitAccessListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default BitAccessAnalyzer;
