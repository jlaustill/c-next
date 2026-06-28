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
 * 1. Collect variable declarations with their types.
 * 2. Walk each binary-operator level and compare adjacent operand categories.
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
 * First pass: collect variable / parameter / for-loop declarations with types.
 */
class VariableTypeCollector extends CNextListener {
  private readonly varTypes: Map<string, string> = new Map();

  public getVarTypes(): Map<string, string> {
    return this.varTypes;
  }

  private track(
    typeCtx: Parser.TypeContext | null,
    identifier: { getText(): string } | null,
  ): void {
    if (!typeCtx || !identifier) return;
    this.varTypes.set(identifier.getText(), typeCtx.getText());
  }

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    this.track(ctx.type(), ctx.IDENTIFIER());
  };

  override enterParameter = (ctx: Parser.ParameterContext): void => {
    this.track(ctx.type(), ctx.IDENTIFIER());
  };

  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    this.track(ctx.type(), ctx.IDENTIFIER());
  };
}

/**
 * Second pass: detect binary operators combining mixed essential categories.
 */
class MixedCategoryListener extends CNextListener {
  private readonly analyzer: MixedTypeCategoryAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly varTypes: Map<string, string>;

  constructor(
    analyzer: MixedTypeCategoryAnalyzer,
    varTypes: Map<string, string>,
  ) {
    super();
    this.analyzer = analyzer;
    this.varTypes = varTypes;
  }

  /** Map a known variable name to its essential type category. */
  private categoryOfName(name: string): Category {
    const typeName = this.varTypes.get(name);
    if (!typeName) return null;
    if (TypeConstants.SIGNED_TYPES.includes(typeName)) return "signed";
    if (TypeConstants.UNSIGNED_INT_TYPES.includes(typeName)) return "unsigned";
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
  private categoryOfUnary(ctx: Parser.UnaryExpressionContext): Category {
    // Prefix operators (-, !, ~, &): category follows the operand.
    const inner = ctx.unaryExpression();
    if (inner) return this.categoryOfUnary(inner);

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
      return unary ? this.categoryOfUnary(unary) : null;
    }

    const identifier = primary.IDENTIFIER();
    if (identifier) return this.categoryOfName(identifier.getText());

    return null; // literal or otherwise unclassifiable
  }

  /** Category of one operand of a binary-operator level. */
  private categoryOf(ctx: ParserRuleContext): Category {
    const unary = this.firstUnary(ctx);
    return unary ? this.categoryOfUnary(unary) : null;
  }

  /**
   * Compare adjacent operands at one binary-operator level and report any pair
   * whose categories are both resolved and differ.
   */
  private checkLevel(operands: ParserRuleContext[]): void {
    if (operands.length < 2) return;
    for (let i = 0; i < operands.length - 1; i += 1) {
      const left = this.categoryOf(operands[i]);
      const right = this.categoryOf(operands[i + 1]);
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

    const collector = new VariableTypeCollector();
    ParseTreeWalker.DEFAULT.walk(collector, tree);

    const listener = new MixedCategoryListener(this, collector.getVarTypes());
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
