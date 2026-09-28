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
 *
 * ## E0890: a read-modify-write evaluates its target twice
 *
 * A bit, bit-range or bitmap-field write keeps the other bits, so it reads the
 * target and stores it back: every subscript in the target, and the bit index
 * with it, is evaluated twice. A call or a volatile read there runs twice, and
 * the store can land on a different element than the read. Owner ruling
 * (#1760 review): reject it, as E0702 rejects a call in a condition. A
 * write-1 register member is composed without a read (ADR-004), so it is
 * evaluated once and is not restricted.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import ChainRoot from "../../utils/ChainRoot";
import EnclosingFunction from "./helpers/EnclosingFunction";
import AssignmentSiteListener from "./AssignmentSiteListener";
import IBitAccessError from "./types/IBitAccessError";
import TChainRoot from "../../transpiler/types/TChainRoot";
import RegisterAccessMode from "../../utils/RegisterAccessMode";
import RegisterMemberReference from "./helpers/RegisterMemberReference";
import type TAssignmentSite from "./types/TAssignmentSite";
import SHARED_FLOAT_TYPES from "../../transpiler/types/FLOAT_TYPES";
import type IAnalysisContext from "./types/IAnalysisContext";

/**
 * The floats a bit range is lowered through a union for.
 *
 * #1450: built from ADR-024's shared list rather than respelling it. The two
 * agreed, which is exactly why nothing would have failed when a new float width
 * was added to one of them.
 */
const FLOAT_TYPES = new Set<string>(SHARED_FLOAT_TYPES);

class BitAccessListener extends CNextListener {
  private readonly found: IBitAccessError[] = [];

  public constructor(private readonly context: IAnalysisContext) {
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
  public checkSite(site: TAssignmentSite): void {
    const target = site.assignmentTarget();
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
    this.checkSingleEvaluation(site);
  }

  /** E0890: each subscript of a read-modify-write target with a side effect */
  private checkSingleEvaluation(site: TAssignmentSite): void {
    // A compound operator on a bit is E0857's; on a whole location it is one
    // C compound assignment, which evaluates its target once
    if (site.assignmentOperator().getText() !== "<-") return;
    const target = site.assignmentTarget();
    if (!this.isReadModifyWrite(target)) return;
    const indices = target.postfixTargetOp().flatMap((op) => op.expression());
    for (const index of indices) {
      if (!OperandTyper.hasSideEffect(index, this.context)) continue;
      this.report(
        index,
        "E0890",
        `'${index.getText()}' would be evaluated twice: '${target.getText()}' is read and then written back`,
        "A bit, bit-range or bitmap-field write keeps the other bits, so it reads its target and stores it back, and every subscript in the target runs twice. Store the index in a variable first (ADR-007).",
      );
    }
  }

  /** Whether writing `target` reads it back first to keep the other bits */
  private isReadModifyWrite(target: Parser.AssignmentTargetContext): boolean {
    const last = OperandTyper.chainOf(target, this.context).steps.at(-1);
    if (last === undefined) return false;
    const writesBits =
      last.subscript === "bit_single" || last.subscript === "bit_range";
    const writesBitmapField =
      last.subscript === null && (last.before?.bitmapTypeName ?? null) !== null;
    if (!writesBits && !writesBitmapField) return false;
    const register = RegisterMemberReference.ofTarget(target, this.context);
    return !RegisterAccessMode.isWriteOne(register?.access);
  }

  private checkChain(
    name: string,
    subscripts: readonly (
      | Parser.PostfixOpContext
      | Parser.PostfixTargetOpContext
    )[],
    at: Parser.PostfixExpressionContext | Parser.AssignmentTargetContext,
    root: TChainRoot,
  ): void {
    // The declaration the spelling names, as the typer binds it: the type
    // its first subscript applies to (#1668). A `this.` root has spent its
    // `.name`, so the typer's steps begin at the subscripts in both shapes.
    const declared =
      OperandTyper.chainOf(at, this.context).steps[0]?.before ?? null;
    if (declared === null) return; // not a declaration this pass can measure

    const spelling = root === null ? name : `${root}.${name}`;
    const baseType = declared.typeName ?? "";
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
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(tree: Parser.ProgramContext): IBitAccessError[] {
    const listener = new BitAccessListener(this.context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    ParseTreeWalker.DEFAULT.walk(
      new AssignmentSiteListener((site) => listener.checkSite(site)),
      tree,
    );
    // Reported in source order, as the one walk these replace did
    return listener
      .errors()
      .sort((a, b) => a.line - b.line || a.column - b.column);
  }
}

export default BitAccessAnalyzer;
