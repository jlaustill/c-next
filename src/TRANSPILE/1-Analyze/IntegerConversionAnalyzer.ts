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
 * three. A composite is typed by `CompositeType.integerOf` over the typer's
 * value leaves -- category from the first integer operand, width from the
 * widest -- the one rule 2.2 sizes its clamp helper by (#1668).
 *
 * ## Two holes codegen had, both closed
 *
 * A COMPOSITE source was typed on a declaration and not on an assignment, and
 * an assignment was checked against the ROOT variable's declared type rather
 * than the type the value actually lands in. The second is the sharper one:
 * `c.col <- wide` emitted `c.col = wide;`, a u32 truncated into a u8 field with
 * no diagnostic, because the lookup found `c` -- a struct -- and skipped.
 * Reading the chain to the field is what ADR-036's bounds rule already did,
 * so both holes closed by asking the question that was already being asked
 * next door -- now the one operand typer's `typeOfTarget` (#1668).
 *
 * ## A third hole this closes
 *
 * `u8 narrow <- this.wide;` inside a scope compiled clean, while the identical
 * line at top level was rejected -- codegen's text-keyed lookup did not resolve
 * the `this.` spelling, so the source read as untyped and untyped never
 * rejects. The lexical frames resolve it, so the rule now holds in the scope
 * contexts too. Measured against the corpus before relying on it.
 *
 * ## Typed by the one operand typer (#1668)
 *
 * Source and target come from `OperandTyper`, so a suffixed literal is its
 * suffix's type (`u8 x <- 300u16` narrows), `-w` is `w`'s type, a cast inside
 * a composite counts at the type it names, a bit range's const width folds,
 * and a C or C++ header's integer -- a source, or the field a value lands in
 * -- has its width on this target. Every assignment site is read, `for`
 * headers included (#1726).
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";
import invariant from "../../utils/invariant";
import ParserUtils from "../../utils/ParserUtils";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import OperandTyper from "../../utils/OperandTyper";
import CompositeType from "../../utils/CompositeType";
import AssignmentSiteListener from "./AssignmentSiteListener";
import IIntegerConversionError from "./types/IIntegerConversionError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IOperandType from "../../transpiler/types/IOperandType";
import type TAssignmentSite from "./types/TAssignmentSite";

const INTEGER_LITERAL = /^-?(?:\d+|0[xX][0-9a-fA-F]+|0[bB][01]+)$/;

class IntegerConversionListener extends CNextListener {
  private readonly found: IIntegerConversionError[] = [];

  public constructor(private readonly context: IAnalysisContext) {
    super();
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
    this.check(target, value, "assign", true);
  };

  /** An assignment, in a statement or a `for` header (#1726) */
  public checkSite(site: TAssignmentSite): void {
    // A compound operator is arithmetic at the operands' width, which ADR-044
    // governs; only a plain `<-` is a conversion.
    if (!site.assignmentOperator().ASSIGN()) return;
    const value = site.expression();
    const target = site.assignmentTarget();
    // A two-expression subscript is a slice or a bit range (ADR-007): a SPAN of
    // the buffer, not an element, with rules of its own.
    if (target.postfixTargetOp().some((op) => op.expression().length === 2)) {
      return;
    }
    // The type the value actually lands in -- following the chain to the
    // field or element, not the root variable's own type. See the class
    // comment for what reading the root instead let through.
    const targetType =
      OperandTyper.typeOfTarget(target, this.context)?.typeName ?? "";
    if (!TypeCheckUtils.isInteger(targetType)) return;
    this.check(targetType, value, "assign", true);
  }

  override enterCastExpression = (ctx: Parser.CastExpressionContext): void => {
    const target = ctx.type().getText();
    if (!TypeCheckUtils.isInteger(target)) return;
    // Composites are not typed for a cast: `(u8)(a + b)` is the author saying
    // which width they mean.
    const source = this.conversionSource(ctx.unaryExpression(), false);
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
    typeComposites: boolean,
  ): void {
    const text = value.getText().trim();
    if (INTEGER_LITERAL.test(text)) {
      this.checkLiteral(target, text, value);
      return;
    }
    const source = this.conversionSource(value, typeComposites);
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

    if (TypeCheckUtils.isUnsigned(target) && value < 0n) {
      this.report(
        at,
        "E0868",
        `Negative value ${text} cannot be assigned to unsigned type ${target}`,
        `An unsigned type holds no negative values; use a signed type such as i${TYPE_WIDTH[target]}.`,
      );
      return;
    }
    const range = TypeCheckUtils.integerRange(target);
    invariant(range, `every caller checks that ${target} is an integer`);
    const [min, max] = range;
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
   * The integer type a source converts from, as a C-Next integer name, or
   * null when the rule does not judge it (#1668, the design's §5 row):
   *
   * - a top-level ternary: its branches are what matter, and
   *   `(val > 0) ? 1 : -1` has literal branches with no declared type (a
   *   `test-no-warnings` execution fixture asserts it is fine);
   * - a lone bit extraction, `large[0, 8]`: ADR-024's explicit reinterpret,
   *   the form this rule tells the author to use;
   * - a composite, `a + b`: `CompositeType.integerOf` over its value leaves,
   *   the one rule 2.2 sizes its clamp helper by -- unless `composites` is
   *   false, as for a cast;
   * - anything else: the typer's type, a C or C++ integer included, at its
   *   width on this target; a suffixed literal is its suffix's type.
   */
  private conversionSource(
    expr: ParserRuleContext,
    composites: boolean,
  ): string | null {
    if (IntegerConversionListener.isTernary(expr)) return null;
    const t = OperandTyper.typeOf(expr, this.context);
    if (t === null) return null;
    if (t.form.kind === "composite") {
      return composites
        ? CompositeType.integerOf(OperandTyper.valueLeaves(expr, this.context))
        : null;
    }
    if (t.form.kind === "bitRange" || t.form.kind === "bitIndex") return null;
    return IntegerConversionListener.integerName(t);
  }

  /** `u8`/`i32`... for an integer of known width, else null */
  private static integerName(t: IOperandType): string | null {
    if (t.dimensions.length > 0 || t.bitWidth === null) return null;
    if (t.category === "signed") return `i${t.bitWidth}`;
    if (t.category === "unsigned") return `u${t.bitWidth}`;
    return null;
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
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(tree: Parser.ProgramContext): IIntegerConversionError[] {
    const listener = new IntegerConversionListener(this.context);
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

export default IntegerConversionAnalyzer;
