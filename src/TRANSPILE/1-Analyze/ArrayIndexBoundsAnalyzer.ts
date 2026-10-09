/**
 * ADR-036 constant index bounds: E0854.
 *
 * #1322. Two throws in `TypeValidator.checkArrayBounds`, reached from three
 * codegen paths -- an assignment target, a multi-dimensional target, and (since
 * #1360) a subscript in value position -- all reporting `1:0` with the line
 * smuggled into the message text.
 *
 * ## What is subscripted, at each subscript
 *
 * `grid[i][9]` is bounded by the shape of `grid[i]`, not of `grid`, so the
 * question at every subscript is "what is the type of the chain before it".
 * That is the one operand typer's chain walk (#1668), the same for an
 * expression and an assignment target, where codegen once resolved the
 * array's name three different ways (bare, scope-resolved, and "root or
 * resolved identifier"). Its dimensions are 1.4's, folded where the array is
 * declared, so a local `const N <- 2` sizes `u8[N] buf` at 2 (#1664 box 7).
 *
 * ## One hole closed, probed
 *
 * `s.data[9]` with `u8[4] data` a struct field was never checked, read or
 * written: codegen bounded the ROOT variable's dimensions and `s` has none.
 * The prefix walk carries a field's dimensions, so a field is bounded like a
 * variable.
 *
 * ## What stays silent
 *
 * A runtime index; a dimension this pass cannot size (a C macro); a subscript
 * with no dimension left, which is a bit index and another rule's; and a
 * two-expression subscript, which is a slice or a bit range (ADR-007).
 */

import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import IArrayIndexBoundsError from "./types/IArrayIndexBoundsError";
import ConstantExpression from "./helpers/ConstantExpression";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IOperandType from "../../types/IOperandType";

/** One subscript in a chain: its expressions, and how many ops follow it. */
interface ISubscript {
  readonly expressions: readonly Parser.ExpressionContext[];
  readonly opsAfter: number;
  readonly dimension: number;
  readonly at: ParserRuleContext;
}

class ArrayIndexBoundsListener extends CNextListener {
  private readonly found: IArrayIndexBoundsError[] = [];

  public constructor(private readonly context: IAnalysisContext) {
    super();
  }

  public errors(): IArrayIndexBoundsError[] {
    return this.found;
  }

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    this.checkChain(ctx, ctx.postfixOp());
  };

  override enterAssignmentTarget = (
    ctx: Parser.AssignmentTargetContext,
  ): void => {
    this.checkChain(ctx, ctx.postfixTargetOp());
  };

  /**
   * Each subscript against the value it indexes, as the one operand typer
   * typed the chain. A `this.`/`global.` root consumes its first `.name`, so
   * the typer's steps are the chain's LAST ops, in order.
   */
  private checkChain(
    ctx: Parser.PostfixExpressionContext | Parser.AssignmentTargetContext,
    ops: readonly (Parser.PostfixOpContext | Parser.PostfixTargetOpContext)[],
  ): void {
    const subscripts = ArrayIndexBoundsListener.subscriptsOf(ops);
    if (subscripts.length === 0) return;
    const typing = OperandTyper.chainOf(
      SyntaxLowering.expressionNode(ctx),
      this.context,
    );
    for (const subscript of subscripts) {
      const step = typing.steps.at(-1 - subscript.opsAfter);
      this.check(
        subscript,
        step?.before ?? null,
        ArrayIndexBoundsListener.spelling(ctx, ops, subscript.opsAfter),
      );
    }
  }

  /** E0854 against the leading dimension of what the subscript indexes. */
  private check(
    subscript: ISubscript,
    indexed: IOperandType | null,
    name: string,
  ): void {
    if (indexed === null || subscript.expressions.length !== 1) return;
    // A dimension 1.4 could fold is a number; one it could not (a C macro)
    // is left to the C compiler, as codegen's UNRESOLVED_DIMENSION was
    const bound = indexed.dimensions[0];
    if (typeof bound !== "number") return;
    const index = ConstantExpression.valueAt(
      subscript.expressions[0],
      this.context,
    );
    if (index === null) return;
    const { line, column } = ParserUtils.getPosition(subscript.at);
    if (index < 0) {
      this.found.push({
        code: "E0854",
        line,
        column,
        message: `Array index out of bounds: ${index} is negative for '${name}' dimension ${subscript.dimension}`,
        helpText: "An index counts from zero (ADR-036).",
      });
      return;
    }
    if (bound > 0 && index >= bound) {
      this.found.push({
        code: "E0854",
        line,
        column,
        message: `Array index out of bounds: ${index} >= ${bound} for '${name}' dimension ${subscript.dimension}`,
        helpText: `The last valid index is ${bound - 1} (ADR-036).`,
      });
    }
  }

  /**
   * Every one-or-two-expression subscript op in a chain, with the number of
   * ops after it (so the prefix walk can stop before it) and which dimension
   * of the current base it indexes (subscripts since the last member step).
   */
  private static subscriptsOf(
    ops: readonly (Parser.PostfixOpContext | Parser.PostfixTargetOpContext)[],
  ): ISubscript[] {
    const found: ISubscript[] = [];
    let depth = 0;
    ops.forEach((op, index) => {
      if (op.LBRACKET() === null) {
        depth = 0;
        return;
      }
      depth += 1;
      found.push({
        expressions: op.expression(),
        opsAfter: ops.length - index - 1,
        dimension: depth,
        at: op,
      });
    });
    return found;
  }

  /** The chain as written up to (not including) the op `opsAfter` from the end. */
  private static spelling(
    ctx: ParserRuleContext,
    ops: readonly ParserRuleContext[],
    opsAfter: number,
  ): string {
    const keep = ops.length - opsAfter - 1;
    const full = ctx.getText();
    let cut = full.length;
    for (let i = keep; i < ops.length; i += 1) {
      cut -= ops[i].getText().length;
    }
    return full.slice(0, cut);
  }
}

class ArrayIndexBoundsAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(tree: Parser.ProgramContext): IArrayIndexBoundsError[] {
    const listener = new ArrayIndexBoundsListener(this.context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default ArrayIndexBoundsAnalyzer;
