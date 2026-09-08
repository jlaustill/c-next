/**
 * ADR-024 integer conversions: E0868 and E0869.
 *
 * #1322. Six rules across `TypeResolver` and `CodeGenerator`, reached through
 * three entry points -- a declaration's initializer, an assignment, a cast --
 * and two rethrow WRAPPERS that caught the message and prefixed `${line}:${col}`
 * onto it. The wrappers are why the assignment fixtures already showed a real
 * position while the cast fixtures showed `1:0`: the same rule, smuggling its
 * position through the message on one path and not the other.
 *
 * ## The rule, once
 *
 * A literal must fit the target's range. A non-literal integer source must not
 * be wider than the target, and must agree with it on signedness. That is the
 * whole of it, whichever of the three spellings reaches it -- which is why it
 * is one analyzer with three listener methods rather than three checks.
 *
 * ## What is deliberately NOT typed
 *
 * A lone bit extraction, `large[0, 8]`, is ADR-024's explicit reinterpret --
 * the escape hatch the rule tells the author to use. Typing it would make the
 * sanctioned form fail the very check it exists to satisfy; codegen's
 * declaration path declined for that reason, and this pass declines for all
 * three. A composite is typed the way codegen typed it: category from the first
 * integer operand, width from the widest.
 *
 * ## Two holes codegen had, both closed
 *
 * A COMPOSITE source was typed on a declaration and not on an assignment, and
 * an assignment was checked against the ROOT variable's declared type rather
 * than the type the value actually lands in. The second is the sharper one:
 * `c.col <- wide` emitted `c.col = wide;`, a u32 truncated into a u8 field with
 * no diagnostic, because the lookup found `c` -- a struct -- and skipped.
 * Reading the chain to the field is what `typeOfAssignmentTarget` already did
 * for ADR-036's bounds rule, so both holes closed by asking the question that
 * was already being asked next door.
 *
 * ## A third hole this closes
 *
 * `u8 narrow <- this.wide;` inside a scope compiled clean, while the identical
 * line at top level was rejected -- codegen's text-keyed lookup did not resolve
 * the `this.` spelling, so the source read as untyped and untyped never
 * rejects. The lexical frames resolve it, so the rule now holds in the scope
 * contexts too. Measured against the corpus before relying on it.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";
import ParserUtils from "../../utils/ParserUtils";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import TypeText from "./helpers/TypeText";
import IIntegerConversionError from "./types/IIntegerConversionError";
import IScopeFrame from "./types/IScopeFrame";
import OperandTypeResolver from "./OperandTypeResolver";
import ScopeFrameResolver from "./ScopeFrameResolver";

const INTEGER_LITERAL = /^-?(?:\d+|0[xX][0-9a-fA-F]+|0[bB][01]+)$/;

class IntegerConversionListener extends CNextListener {
  private readonly found: IIntegerConversionError[] = [];
  private readonly types: OperandTypeResolver;

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
    this.types = new OperandTypeResolver(scopes);
  }

  public errors(): IIntegerConversionError[] {
    return this.found;
  }

  // --- The three spellings that reach the one rule --------------------------

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    const value = ctx.expression();
    if (!value) return;
    const target = ctx.type().getText();
    if (!TypeCheckUtils.isInteger(target)) return;
    this.check(target, value, "assign", this.scopes.frameFor(ctx), true);
  };

  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    // A compound operator is arithmetic at the operands' width, which ADR-044
    // governs; only a plain `<-` is a conversion.
    if (!ctx.assignmentOperator().ASSIGN()) return;
    const value = ctx.expression();
    if (!value) return;
    const target = ctx.assignmentTarget();
    // A two-expression subscript is a slice or a bit range (ADR-007): a SPAN of
    // the buffer, not an element, with rules of its own.
    if (target.postfixTargetOp().some((op) => op.expression().length === 2)) {
      return;
    }
    const frame = this.scopes.frameFor(ctx);
    // The type the value actually lands in -- following the chain to the
    // field or element, not the root variable's own type. See the class
    // comment for what reading the root instead let through.
    const targetType = TypeText.withoutDimensions(
      this.types.typeOfAssignmentTarget(ctx.assignmentTarget(), frame) ?? "",
    );
    if (!TypeCheckUtils.isInteger(targetType)) return;
    this.check(targetType, value, "assign", frame, true);
  };

  override enterCastExpression = (ctx: Parser.CastExpressionContext): void => {
    const target = ctx.type().getText();
    if (!TypeCheckUtils.isInteger(target)) return;
    const frame = this.scopes.frameFor(ctx);
    // Composites are not typed for a cast either: codegen asked only the

    // direct type, and `(u8)(a + b)` is the author saying which width they mean.

    const source = this.sourceTypeOf(ctx.unaryExpression(), frame, false);
    if (source !== null) this.checkConversion(target, source, ctx, "cast");
  };

  // --- The one rule --------------------------------------------------------

  /**
   * `typeComposites` is `true` everywhere now, and the parameter survives only
   * because a CAST still declines: `(u8)(a + b)` is the author saying which
   * width they mean.
   *
   * It existed to reproduce a divergence codegen had. A composite source
   * (`a + b` -- category from the first integer operand, width from the widest)
   * was typed on a DECLARATION's initializer and never on an assignment
   * statement, so `u8 s <- large + 1;` was rejected while
   * `matrix2d[i][j] <- i * 10 + j;` was accepted. #1322 preserved that and
   * raised it; the language owner ruled it a bug, and it is closed.
   */
  private check(
    target: string,
    value: Parser.ExpressionContext,
    kind: "assign" | "cast",
    frame: IScopeFrame,
    typeComposites: boolean,
  ): void {
    const text = value.getText().trim();
    if (INTEGER_LITERAL.test(text)) {
      this.checkLiteral(target, text, value);
      return;
    }
    const source = this.sourceTypeOf(value, frame, typeComposites);
    if (source !== null) this.checkConversion(target, source, value, kind);
  }

  private checkLiteral(
    target: string,
    text: string,
    at: ParserRuleContext,
  ): void {
    // BigInt, not parseInt: a u64 bound is past 2^53, where a double stops
    // being exact and `0xFFFFFFFFFFFFFFFF` would round into range.
    const value = text.startsWith("-") ? -BigInt(text.slice(1)) : BigInt(text);
    const width = BigInt(TYPE_WIDTH[target]);

    if (TypeCheckUtils.isUnsigned(target) && value < 0n) {
      this.report(
        at,
        "E0868",
        `Negative value ${text} cannot be assigned to unsigned type ${target}`,
        `An unsigned type holds no negative values; use a signed type such as i${TYPE_WIDTH[target]}.`,
      );
      return;
    }
    const [min, max] = TypeCheckUtils.isUnsigned(target)
      ? [0n, (1n << width) - 1n]
      : [-(1n << (width - 1n)), (1n << (width - 1n)) - 1n];
    if (value < min || value > max) {
      this.report(
        at,
        "E0868",
        `Value ${text} exceeds ${target} range (${min} to ${max})`,
        "Widen the target type, or narrow the value.",
      );
    }
  }

  private checkConversion(
    target: string,
    source: string,
    at: ParserRuleContext,
    kind: "assign" | "cast",
  ): void {
    if (source === target || !TypeCheckUtils.isInteger(source)) return;
    const verb = kind === "cast" ? "cast" : "assign";
    const subject = kind === "cast" ? "expr" : "value";
    const targetWidth = TYPE_WIDTH[target];

    if (TYPE_WIDTH[source] > targetWidth) {
      this.report(
        at,
        "E0869",
        `Cannot ${verb} ${source} to ${target} (narrowing)`,
        `Use bit indexing to say which bits you mean: ${subject}[0, ${targetWidth}]`,
      );
      return;
    }
    if (TypeCheckUtils.isSigned(source) !== TypeCheckUtils.isSigned(target)) {
      this.report(
        at,
        "E0869",
        `Cannot ${verb} ${source} to ${target} (sign change)`,
        `Use bit indexing to reinterpret the bits explicitly: ${subject}[0, ${targetWidth}]`,
      );
    }
  }

  // --- What type a source is ------------------------------------------------

  /**
   * The integer type of a source expression, or null.
   *
   * A directly resolvable operand answers by declaration. A composite answers
   * the way codegen answered: category from the first integer operand, width
   * from the widest. A lone bit extraction answers nothing, on purpose.
   */
  private sourceTypeOf(
    expr: ParserRuleContext,
    frame: IScopeFrame,
    typeComposites: boolean,
  ): string | null {
    // A ternary is untyped here. `typeOfOperand` types one for the Boolean
    // rule, where a ternary of bools IS a bool; for a conversion the branches
    // are what matter, and `(val > 0) ? 1 : -1` has literal branches with no
    // declared type at all. Codegen did not type it, and a `test-no-warnings`
    // execution fixture asserts that `i32 sign <- (val > 0) ? 1 : -1` is fine.
    if (IntegerConversionListener.isTernary(expr)) return null;
    const direct = this.types.typeOfOperand(expr, frame);
    if (direct !== null)
      return TypeCheckUtils.isInteger(direct) ? direct : null;
    if (!typeComposites) return null;

    const leaves = IntegerConversionListener.postfixLeaves(expr);
    if (leaves.length < 2) return null; // a lone operand codegen declined to type

    let category: "i" | "u" | null = null;
    let width = 0;
    for (const leaf of leaves) {
      const type = this.leafType(leaf, frame);
      const match = type ? /^([iu])(8|16|32|64)$/.exec(type) : null;
      if (!match) continue;
      category ??= match[1] as "i" | "u";
      width = Math.max(width, Number.parseInt(match[2], 10));
    }
    return category && width > 0 ? `${category}${width}` : null;
  }

  /** A composite's operand: a bit extraction is the unsigned type of its width. */
  private leafType(
    leaf: Parser.PostfixExpressionContext,
    frame: IScopeFrame,
  ): string | null {
    const ops = leaf.postfixOp();
    // A bit-RANGE (`v[start, width]`) types by its width; anything else does
    // not. Written out rather than as `last?.LBRACKET() !== null`, which was
    // TRUE for an empty chain -- `undefined !== null` -- and reached the right
    // answer only because the next optional call also produced `undefined`.
    const last = ops.at(-1);
    const widthExpr =
      last !== undefined && last.LBRACKET() !== null
        ? last.expression(1)
        : null;
    if (widthExpr) {
      const width = IntegerConversionListener.literalValue(widthExpr);
      if (width !== null) {
        for (const candidate of [8, 16, 32, 64]) {
          if (width <= candidate) return `u${candidate}`;
        }
      }
      return null;
    }
    return this.types.typeOfOperand(leaf, frame);
  }

  /** Whether the expression, past its single-child levels, is a real ternary. */
  private static isTernary(expr: ParserRuleContext): boolean {
    let node: ParserRuleContext = expr;
    while (node.getChildCount() === 1) {
      const child = node.getChild(0);
      if (!(child instanceof ParserRuleContext)) break;
      node = child;
    }
    return (
      node instanceof Parser.TernaryExpressionContext && node.COLON() !== null
    );
  }

  private static literalValue(expr: Parser.ExpressionContext): number | null {
    const text = expr.getText().trim();
    return /^\d+$/.test(text) ? Number.parseInt(text, 10) : null;
  }

  /** Every postfix expression under a node, in source order. */
  private static postfixLeaves(
    node: ParserRuleContext,
  ): Parser.PostfixExpressionContext[] {
    if (node instanceof Parser.PostfixExpressionContext) return [node];
    const found: Parser.PostfixExpressionContext[] = [];
    for (let i = 0; i < node.getChildCount(); i += 1) {
      const child = node.getChild(i);
      if (child instanceof ParserRuleContext) {
        found.push(...IntegerConversionListener.postfixLeaves(child));
      }
    }
    return found;
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

class IntegerConversionAnalyzer {
  public analyze(tree: Parser.ProgramContext): IIntegerConversionError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new IntegerConversionListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default IntegerConversionAnalyzer;
