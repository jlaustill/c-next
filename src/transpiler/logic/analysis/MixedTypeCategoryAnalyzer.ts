/**
 * Mixed Type Category Analyzer
 *
 * Detects binary operators whose two operands have different essential type
 * categories (signed vs unsigned) at compile time.
 *
 * MISRA C:2012 Rule 10.4: "Both operands of an operator in which the usual
 * arithmetic conversions are performed shall have the same essential type
 * category." Combining a signed and an unsigned value (e.g. `u32 + i32`) relies
 * on C's usual arithmetic conversions, whose result can be surprising (ADR-024).
 *
 * To combine values of different categories, the developer reinterprets one
 * operand's bits to the other's category with bit indexing (ADR-007), e.g.
 * `a + b[0, 32]`, making the conversion explicit.
 *
 * Integer literals are exempt: a bare literal has no fixed essential category —
 * it is contextually typed to the other operand (ADR-052), so `a + 5` is fine.
 * The rule fires only when BOTH operands resolve to concrete, fixed-width
 * integer types of different category.
 *
 * Two-pass analysis:
 * 1. Collect declarations into per-scope frames (function / named scope), so a
 *    name is resolved against ITS scope — a same-named variable of a different
 *    category in another function never poisons the lookup (Issue #1085 review).
 * 2. Walk each binary-operator level and compare adjacent operand categories,
 *    resolving each operand within its enclosing scope frame.
 */

import { ParseTreeWalker, ParserRuleContext } from "antlr4ng";
import type { ParseTree } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IMixedTypeCategoryError from "./types/IMixedTypeCategoryError";
import ParserUtils from "../../../utils/ParserUtils";
import TypeConstants from "../../../utils/constants/TypeConstants";

/** Essential type category of an operand, or null when it cannot be resolved. */
type Category = "signed" | "unsigned" | null;

/**
 * Declarations directly in one lexical scope (a function or a named scope),
 * with a link to the enclosing scope. Resolution searches outward to the global
 * frame, so inner declarations shadow outer ones.
 */
interface ScopeFrame {
  readonly vars: Map<string, string>;
  readonly parent: ScopeFrame | null;
}

/**
 * First pass: build per-scope frames. Frames are anchored to the function /
 * scope context node so the second pass can find an operand's frame by walking
 * up its parent chain — no shared walk state between the passes.
 */
class ScopeCollector extends CNextListener {
  private readonly globalFrame: ScopeFrame = { vars: new Map(), parent: null };

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly frameOf: Map<ParserRuleContext, ScopeFrame> = new Map();

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly stack: ScopeFrame[] = [this.globalFrame];

  public getGlobalFrame(): ScopeFrame {
    return this.globalFrame;
  }

  public getFrameOf(): Map<ParserRuleContext, ScopeFrame> {
    return this.frameOf;
  }

  private top(): ScopeFrame {
    return this.stack.at(-1) ?? this.globalFrame;
  }

  private pushFrame(node: ParserRuleContext): void {
    const frame: ScopeFrame = { vars: new Map(), parent: this.top() };
    this.frameOf.set(node, frame);
    this.stack.push(frame);
  }

  private popFrame(): void {
    this.stack.pop();
  }

  private record(
    typeCtx: Parser.TypeContext | null,
    identifier: { getText(): string } | null,
  ): void {
    if (!typeCtx || !identifier) return;
    this.top().vars.set(identifier.getText(), typeCtx.getText());
  }

  override enterFunctionDeclaration = (
    ctx: Parser.FunctionDeclarationContext,
  ): void => {
    this.pushFrame(ctx);
  };

  override exitFunctionDeclaration = (): void => {
    this.popFrame();
  };

  override enterScopeDeclaration = (
    ctx: Parser.ScopeDeclarationContext,
  ): void => {
    this.pushFrame(ctx);
  };

  override exitScopeDeclaration = (): void => {
    this.popFrame();
  };

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    this.record(ctx.type(), ctx.IDENTIFIER());
  };

  override enterParameter = (ctx: Parser.ParameterContext): void => {
    this.record(ctx.type(), ctx.IDENTIFIER());
  };

  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    this.record(ctx.type(), ctx.IDENTIFIER());
  };
}

/**
 * Second pass: detect binary operators combining mixed essential categories.
 */
class MixedCategoryListener extends CNextListener {
  private readonly analyzer: MixedTypeCategoryAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly globalFrame: ScopeFrame;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly frameOf: Map<ParserRuleContext, ScopeFrame>;

  constructor(
    analyzer: MixedTypeCategoryAnalyzer,
    globalFrame: ScopeFrame,
    frameOf: Map<ParserRuleContext, ScopeFrame>,
  ) {
    super();
    this.analyzer = analyzer;
    this.globalFrame = globalFrame;
    this.frameOf = frameOf;
  }

  /** The scope frame enclosing an operand: nearest function/scope ancestor. */
  private frameFor(ctx: ParserRuleContext): ScopeFrame {
    let node: ParserRuleContext | null = ctx;
    while (node) {
      const frame = this.frameOf.get(node);
      if (frame) return frame;
      node = node.parent;
    }
    return this.globalFrame;
  }

  /** Map a known variable name to its essential type category within a scope. */
  private categoryOfName(name: string, frame: ScopeFrame): Category {
    let current: ScopeFrame | null = frame;
    while (current) {
      const typeName = current.vars.get(name);
      if (typeName) {
        if (TypeConstants.SIGNED_TYPES.includes(typeName)) return "signed";
        if (TypeConstants.UNSIGNED_INT_TYPES.includes(typeName)) {
          return "unsigned";
        }
        return null;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * Drill any binary-operator-level context down to its leftmost unary
   * expression. Each level is `subLevel (op subLevel)*`, so the first child is
   * always the next level down until a unary expression is reached.
   */
  private firstUnary(
    ctx: ParserRuleContext,
  ): Parser.UnaryExpressionContext | null {
    let current: ParserRuleContext | null = ctx;
    while (current && !(current instanceof Parser.UnaryExpressionContext)) {
      const child: ParseTree | null =
        current.getChildCount() > 0 ? current.getChild(0) : null;
      current = child instanceof ParserRuleContext ? child : null;
    }
    return current instanceof Parser.UnaryExpressionContext ? current : null;
  }

  /**
   * Resolve the essential category of a unary expression. Conservative:
   * anything not a bare variable (or a parenthesized one) returns null so the
   * rule never fires on an operand it cannot positively classify — in
   * particular a bit-extraction `x[0, 32]` (a postfix suffix) is exempt, which
   * is exactly the sanctioned cross-category form.
   */
  private categoryOfUnary(
    ctx: Parser.UnaryExpressionContext,
    frame: ScopeFrame,
  ): Category {
    // Prefix operators. `-` and `~` preserve the operand's essential category,
    // but `!` (logical negation) yields an essentially-Boolean result and `&`
    // (address-of, ADR-006) yields an address — neither carries the operand's
    // signed/unsigned category, so classifying by it would falsely reject e.g.
    // `!a = !b` where a and b differ in signedness (Issue #1085 review).
    const inner = ctx.unaryExpression();
    if (inner) {
      const op = ctx.getChild(0)?.getText();
      if (op === "!" || op === "&") return null;
      return this.categoryOfUnary(inner, frame);
    }

    const postfix = ctx.postfixExpression();
    if (!postfix) return null;
    // A postfix suffix (member access, call, indexing, bit-extraction) cannot be
    // positively classified here — be conservative and exempt it.
    if (postfix.getChildCount() > 1) return null;

    const primary = postfix.primaryExpression();
    if (!primary) return null;

    const parenthesized = primary.expression();
    if (parenthesized) {
      const unary = this.firstUnary(parenthesized);
      return unary ? this.categoryOfUnary(unary, frame) : null;
    }

    const identifier = primary.IDENTIFIER();
    if (identifier) return this.categoryOfName(identifier.getText(), frame);

    return null; // literal or otherwise unclassifiable
  }

  /** Category of one operand of a binary-operator level. */
  private categoryOf(ctx: ParserRuleContext, frame: ScopeFrame): Category {
    const unary = this.firstUnary(ctx);
    return unary ? this.categoryOfUnary(unary, frame) : null;
  }

  /**
   * Compare adjacent operands at one binary-operator level and report any pair
   * whose categories are both resolved and differ.
   */
  private checkLevel(operands: ParserRuleContext[]): void {
    if (operands.length < 2) return;
    const frame = this.frameFor(operands[0]);
    for (let i = 0; i < operands.length - 1; i += 1) {
      const left = this.categoryOf(operands[i], frame);
      const right = this.categoryOf(operands[i + 1], frame);
      if (left && right && left !== right) {
        const { line, column } = ParserUtils.getPosition(operands[i + 1]);
        this.analyzer.addError(line, column);
      }
    }
  }

  override enterMultiplicativeExpression = (
    ctx: Parser.MultiplicativeExpressionContext,
  ): void => {
    this.checkLevel(ctx.unaryExpression());
  };

  override enterAdditiveExpression = (
    ctx: Parser.AdditiveExpressionContext,
  ): void => {
    this.checkLevel(ctx.multiplicativeExpression());
  };

  override enterShiftExpression = (
    ctx: Parser.ShiftExpressionContext,
  ): void => {
    this.checkLevel(ctx.additiveExpression());
  };

  override enterBitwiseAndExpression = (
    ctx: Parser.BitwiseAndExpressionContext,
  ): void => {
    this.checkLevel(ctx.shiftExpression());
  };

  override enterBitwiseXorExpression = (
    ctx: Parser.BitwiseXorExpressionContext,
  ): void => {
    this.checkLevel(ctx.bitwiseAndExpression());
  };

  override enterBitwiseOrExpression = (
    ctx: Parser.BitwiseOrExpressionContext,
  ): void => {
    this.checkLevel(ctx.bitwiseXorExpression());
  };

  override enterRelationalExpression = (
    ctx: Parser.RelationalExpressionContext,
  ): void => {
    this.checkLevel(ctx.bitwiseOrExpression());
  };

  override enterEqualityExpression = (
    ctx: Parser.EqualityExpressionContext,
  ): void => {
    this.checkLevel(ctx.relationalExpression());
  };
}

/**
 * Analyzer that detects binary operations mixing essential type categories.
 */
class MixedTypeCategoryAnalyzer {
  private errors: IMixedTypeCategoryError[] = [];

  /**
   * Analyze the parse tree for mixed-category binary operations.
   */
  public analyze(tree: Parser.ProgramContext): IMixedTypeCategoryError[] {
    this.errors = [];

    const collector = new ScopeCollector();
    ParseTreeWalker.DEFAULT.walk(collector, tree);

    const listener = new MixedCategoryListener(
      this,
      collector.getGlobalFrame(),
      collector.getFrameOf(),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Add a mixed-category error.
   */
  public addError(line: number, column: number): void {
    this.errors.push({
      code: "E0810",
      line,
      column,
      message:
        "Binary operator combines operands of different essential type categories (signed and unsigned)",
      helpText:
        "MISRA C:2012 Rule 10.4: both operands must share an essential type category. " +
        "Reinterpret one operand's bits to match the other with bit indexing, e.g. value[0, 32] (ADR-007/ADR-024).",
    });
  }

  /**
   * Get all detected errors.
   */
  public getErrors(): IMixedTypeCategoryError[] {
    return this.errors;
  }
}

export default MixedTypeCategoryAnalyzer;
