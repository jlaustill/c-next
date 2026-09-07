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
 * That is the prefix walk `OperandTypeResolver` already gives an expression
 * and, since #1322, an assignment target -- one walker for both positions,
 * where codegen resolved the array's name three different ways (bare,
 * scope-resolved, and "root or resolved identifier").
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

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";
import CodeGenState from "../../transpiler/state/CodeGenState";
import ArrayDimensionParser from "../../utils/ArrayDimensionParser";
import LiteralUtils from "../../utils/LiteralUtils";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import IArrayIndexBoundsError from "./types/IArrayIndexBoundsError";
import OperandTypeResolver from "./OperandTypeResolver";
import ScopeFrameResolver from "./ScopeFrameResolver";
import TypeText from "./helpers/TypeText";

/** One subscript in a chain: its expressions, and how many ops follow it. */
interface ISubscript {
  readonly expressions: readonly Parser.ExpressionContext[];
  readonly opsAfter: number;
  readonly dimension: number;
  readonly at: ParserRuleContext;
}

class ArrayIndexBoundsListener extends CNextListener {
  private readonly found: IArrayIndexBoundsError[] = [];
  private readonly types: OperandTypeResolver;

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
    this.types = new OperandTypeResolver(scopes);
  }

  public errors(): IArrayIndexBoundsError[] {
    return this.found;
  }

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const frame = this.scopes.frameFor(ctx);
    const ops = ctx.postfixOp();
    for (const subscript of ArrayIndexBoundsListener.subscriptsOf(ops)) {
      this.check(
        subscript,
        this.types.typeOfPostfixPrefix(ctx, frame, subscript.opsAfter + 1),
        ArrayIndexBoundsListener.spelling(ctx, ops, subscript.opsAfter),
      );
    }
  };

  override enterAssignmentTarget = (
    ctx: Parser.AssignmentTargetContext,
  ): void => {
    const frame = this.scopes.frameFor(ctx);
    const ops = ctx.postfixTargetOp();
    for (const subscript of ArrayIndexBoundsListener.subscriptsOf(ops)) {
      this.check(
        subscript,
        this.types.typeOfAssignmentTargetPrefix(
          ctx,
          frame,
          subscript.opsAfter + 1,
        ),
        ArrayIndexBoundsListener.spelling(ctx, ops, subscript.opsAfter),
      );
    }
  };

  /** E0854 against the leading dimension of what the subscript indexes. */
  private check(
    subscript: ISubscript,
    prefixType: string | null,
    name: string,
  ): void {
    if (prefixType === null || subscript.expressions.length !== 1) return;
    const bound = ArrayIndexBoundsListener.leadingDimension(prefixType);
    if (bound === null) return;
    const index = ArrayIndexBoundsListener.constantOf(subscript.expressions[0]);
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

  /** The first `[N]` of a type text as a size, or null when not sizable here. */
  private static leadingDimension(typeText: string): number | null {
    const inner = TypeText.firstDimension(typeText);
    if (inner === null) return null;
    if (inner === "") return null;
    // A literal in any spelling (`16`, `0x10`, `0b10000`) is its value; a
    // named dimension is a const when the program knows one, and otherwise a
    // C macro, which is left to the C compiler as codegen's
    // UNRESOLVED_DIMENSION was.
    const literal = LiteralUtils.parseIntegerLiteral(inner);
    if (literal !== undefined) return literal;
    return CodeGenState.program?.constValue(inner) ?? null;
  }

  private static constantOf(expr: Parser.ExpressionContext): number | null {
    return (
      ArrayDimensionParser.parseSingleDimension(expr, {
        constValues: new Map(CodeGenState.program?.constValues() ?? []),
        typeWidths: TYPE_WIDTH,
      }) ?? null
    );
  }
}

class ArrayIndexBoundsAnalyzer {
  public analyze(tree: Parser.ProgramContext): IArrayIndexBoundsError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new ArrayIndexBoundsListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default ArrayIndexBoundsAnalyzer;
