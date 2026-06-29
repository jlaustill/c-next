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
 * 1. Collect declarations into per-scope frames (function, named scope, block,
 *    and for-loop header), so a name is resolved against ITS scope — a same-named
 *    variable of a different category in another function OR a nested block never
 *    poisons the lookup (Issue #1085 review).
 * 2. Walk each binary-operator level and compare adjacent operand categories,
 *    resolving each operand within its enclosing scope frame.
 *
 * Note: shift operators (<< / >>) are intentionally NOT checked here — MISRA
 * Rule 10.4 only governs operators subject to the usual arithmetic conversions,
 * and a shift count is promoted independently. A signed shift count is a Rule
 * 10.1 concern handled elsewhere (Issue #1085 review).
 */

import { ParseTreeWalker, ParserRuleContext } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IMixedTypeCategoryError from "./types/IMixedTypeCategoryError";
import ParserUtils from "../../../utils/ParserUtils";
import TypeConstants from "../../../utils/constants/TypeConstants";

/** Essential type category of an operand, or null when it cannot be resolved. */
type Category = "signed" | "unsigned" | null;

/**
 * Declarations directly in one lexical scope (a function, named scope, block, or
 * for-loop header), with a link to the enclosing scope. Resolution searches
 * outward to the global frame, so inner declarations shadow outer ones.
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

  // Each braced block (if/while/for body, and a function/scope body) is its own
  // lexical scope, so a different-category redeclaration shadows only within the
  // block instead of poisoning the name function-wide (Issue #1085 review).
  override enterBlock = (ctx: Parser.BlockContext): void => {
    this.pushFrame(ctx);
  };

  override exitBlock = (): void => {
    this.popFrame();
  };

  // The for-loop header is its own scope so the loop variable is confined to the
  // loop (header + body) and never overwrites an outer same-named variable.
  override enterForStatement = (ctx: Parser.ForStatementContext): void => {
    this.pushFrame(ctx);
  };

  override exitForStatement = (): void => {
    this.popFrame();
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
   * Collect the essential category of every classifiable VALUE leaf under one
   * binary-operator operand, descending through nested operator levels and
   * parentheses but never into a postfix suffix (an array index, bit-range
   * argument, or call argument is not a value operand of THIS operator).
   *
   * A unary expression is a grammar leaf of the operator levels:
   *  - prefix `-`/`~` preserve the operand's category, so descend through them;
   *  - prefix `!` (essentially-Boolean result) and `&` (address-of, ADR-006)
   *    carry no signed/unsigned category — contribute null, so a mix like
   *    `!a = !b` is not falsely rejected (Issue #1085 review);
   *  - a postfix WITH a suffix (member/call/indexing/bit-extraction) cannot be
   *    positively classified — contribute null, which exempts the sanctioned
   *    cross-category form `x[0, 32]`;
   *  - a parenthesized expression contributes ALL of its own leaves (not merely
   *    the leftmost), so a compound operand is judged by its whole content.
   */
  private collectOperandCategories(
    ctx: ParserRuleContext,
    frame: ScopeFrame,
    out: Category[],
  ): void {
    if (ctx instanceof Parser.UnaryExpressionContext) {
      const inner = ctx.unaryExpression();
      if (inner) {
        const op = ctx.getChild(0)?.getText();
        if (op === "!" || op === "&") {
          out.push(null);
          return;
        }
        this.collectOperandCategories(inner, frame, out);
        return;
      }

      const postfix = ctx.postfixExpression();
      if (!postfix || postfix.getChildCount() > 1) {
        out.push(null);
        return;
      }

      const primary = postfix.primaryExpression();
      const parenthesized = primary?.expression();
      if (parenthesized) {
        this.collectOperandCategories(parenthesized, frame, out);
        return;
      }

      const identifier = primary?.IDENTIFIER();
      out.push(
        identifier ? this.categoryOfName(identifier.getText(), frame) : null,
      );
      return;
    }

    for (let i = 0; i < ctx.getChildCount(); i += 1) {
      const child = ctx.getChild(i);
      if (child instanceof ParserRuleContext) {
        this.collectOperandCategories(child, frame, out);
      }
    }
  }

  /**
   * The essential category of one operand of a binary-operator level: the single
   * category shared by all its classifiable value leaves, or null when it has
   * none OR when its own leaves are themselves mixed.
   *
   * Returning null for an internally-mixed operand prevents a CASCADE of
   * duplicate errors: `a * b + c` (with `i32 a`, `u32 b`, `u32 c`) is reported
   * once — at the `a * b` level — instead of again at the `+ c` level, where the
   * product's category is genuinely ambiguous rather than `a`'s leftmost
   * (Issue #1085 review). An internally-mixed operand is always reported at its
   * own level, so nothing is missed. Because a resolved (non-null) category
   * means every classifiable leaf agrees, comparing two resolved-but-differing
   * operands always reflects a real signed/unsigned combination — no false
   * positive on uniform code.
   */
  private operandCategory(ctx: ParserRuleContext, frame: ScopeFrame): Category {
    const leaves: Category[] = [];
    this.collectOperandCategories(ctx, frame, leaves);

    let resolved: Category = null;
    for (const leaf of leaves) {
      if (leaf === null) continue;
      if (resolved === null) {
        resolved = leaf;
      } else if (resolved !== leaf) {
        return null;
      }
    }
    return resolved;
  }

  /**
   * Compare adjacent operands at one binary-operator level and report any pair
   * whose categories are both resolved and differ.
   */
  private checkLevel(operands: ParserRuleContext[]): void {
    if (operands.length < 2) return;
    const frame = this.frameFor(operands[0]);
    for (let i = 0; i < operands.length - 1; i += 1) {
      const left = this.operandCategory(operands[i], frame);
      const right = this.operandCategory(operands[i + 1], frame);
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
