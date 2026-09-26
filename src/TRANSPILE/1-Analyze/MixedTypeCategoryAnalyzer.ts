/**
 * Mixed Type Category Analyzer
 *
 * Detects operators whose two operands have different essential type
 * categories (signed, unsigned, floating) at compile time.
 *
 * MISRA C:2012 Rule 10.4: "Both operands of an operator in which the usual
 * arithmetic conversions are performed shall have the same essential type
 * category." Combining a signed and an unsigned value (e.g. `u32 + i32`) relies
 * on C's usual arithmetic conversions, whose result can be surprising (ADR-024).
 *
 * To combine a signed and an unsigned value, the developer reinterprets one
 * operand's bits to the other's category with bit indexing (ADR-007), e.g.
 * `a + b[0, 32]`, making the conversion explicit. To combine an integer and a
 * floating value, the developer casts the integer, e.g. `(f32)i * k` (#1668).
 *
 * Integer literals are exempt: a bare integer literal has no fixed essential
 * category — it is contextually typed to the other operand (ADR-052), so
 * `a + 5` and `k * 3` are fine. A float literal is NOT exempt: no integer
 * operand can adopt it, so `i * 2.5` is floating against unsigned (#1668).
 * The rule fires only when BOTH operands resolve to a category, and the two
 * differ.
 *
 * Compound assignments (`+<-`, `*<-`, ...) are the same operators, so the
 * target and the value are compared the same way (#1668). `y *<- 2.5` is
 * `y <- y * 2.5`; checking only the binary form rejected the second spelling
 * and accepted the first.
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
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import IMixedTypeCategoryError from "./types/IMixedTypeCategoryError";
import IScopeFrame from "./types/IScopeFrame";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import ScopeFrameResolver from "./ScopeFrameResolver";
import BinaryOperatorLevelListener from "./BinaryOperatorLevelListener";
import ParserUtils from "../../utils/ParserUtils";
import TypeConstants from "../../utils/constants/TypeConstants";
import LiteralUtils from "../../utils/LiteralUtils";
import OperandTypeResolver from "./OperandTypeResolver";
import type IAnalysisContext from "./types/IAnalysisContext";

/** Essential type category of an operand, or null when it cannot be resolved. */
type Category = "signed" | "unsigned" | "floating" | null;

/**
 * Assignment operators that perform no usual arithmetic conversion between the
 * target and the value: a plain assignment (Rule 10.3's concern, #1682), and
 * the two shifts, whose count is promoted independently.
 */
const NOT_RULE_10_4_ASSIGNMENTS: ReadonlySet<string> = new Set([
  "<-",
  "<<<-",
  ">><-",
]);

/**
 * Second pass: detect binary operators combining mixed essential categories.
 */
class MixedCategoryListener extends CNextListener {
  private readonly analyzer: MixedTypeCategoryAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly scopes: ScopeFrameResolver;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly types: OperandTypeResolver;

  constructor(
    analyzer: MixedTypeCategoryAnalyzer,
    scopes: ScopeFrameResolver,
    types: OperandTypeResolver,
  ) {
    super();
    this.analyzer = analyzer;
    this.scopes = scopes;
    this.types = types;
  }

  /** The essential type category of a declared type, or null. */
  private static categoryOf(typeName: string | null): Category {
    if (!typeName) return null;
    if (TypeConstants.SIGNED_TYPES.includes(typeName)) return "signed";
    if (TypeConstants.UNSIGNED_INT_TYPES.includes(typeName)) return "unsigned";
    if (TypeConstants.FLOAT_TYPES.includes(typeName)) return "floating";
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
   *  - a named operand is classified by its declared type, through the same
   *    chain walk every other analyzer uses, so a struct field, an array
   *    element, a call result and a scope member count too (#1092, #1668).
   *    A subscript into a scalar is a bit index and has no declared type, which
   *    is what keeps the sanctioned cross-category form `x[0, 32]` exempt;
   *  - a cast is classified by the type it names;
   *  - a parenthesized expression contributes ALL of its own leaves (not merely
   *    the leftmost), so a compound operand is judged by its whole content.
   */
  private collectOperandCategories(
    ctx: ParserRuleContext,
    frame: IScopeFrame,
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
      if (!postfix) {
        out.push(null);
        return;
      }
      out.push(...this.postfixCategories(postfix, frame));
      return;
    }

    // A ternary's value is one of its arms; its condition is not an operand.
    const arms = ParserUtils.ternaryValueArms(ctx);
    const children = arms ?? ctx.children;
    for (const child of children) {
      if (child instanceof ParserRuleContext) {
        this.collectOperandCategories(child, frame, out);
      }
    }
  }

  /**
   * The categories one postfix leaf contributes. A bare parenthesized
   * expression contributes all of its own leaves; anything else is one value.
   */
  private postfixCategories(
    postfix: Parser.PostfixExpressionContext,
    frame: IScopeFrame,
  ): Category[] {
    const primary = postfix.primaryExpression();
    if (postfix.postfixOp().length === 0) {
      const parenthesized = primary.expression();
      if (parenthesized) {
        const leaves: Category[] = [];
        this.collectOperandCategories(parenthesized, frame, leaves);
        return leaves;
      }

      // An integer literal is contextually typed (ADR-052) and contributes
      // nothing; a float literal is floating wherever it appears (#1668).
      const literal = primary.literal();
      if (literal) {
        return [LiteralUtils.isFloat(literal) ? "floating" : null];
      }

      const cast = primary.castExpression();
      if (cast) {
        return [MixedCategoryListener.categoryOf(cast.type().getText())];
      }
    }
    return [
      MixedCategoryListener.categoryOf(
        this.types.typeOfPostfixExpression(postfix, frame),
      ),
    ];
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
  private operandCategory(
    ctx: ParserRuleContext,
    frame: IScopeFrame,
  ): Category {
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
  public checkLevel(operands: ParserRuleContext[]): void {
    const frame = this.scopes.frameFor(operands[0]);
    for (let i = 0; i < operands.length - 1; i += 1) {
      const left = this.operandCategory(operands[i], frame);
      const right = this.operandCategory(operands[i + 1], frame);
      if (left && right && left !== right) {
        const { line, column } = ParserUtils.getPosition(operands[i + 1]);
        this.analyzer.addError(line, column, left, right);
      }
    }
  }

  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    this.checkCompound(ctx.assignmentTarget(), ctx.assignmentOperator(), ctx);
  };

  override enterForAssignment = (ctx: Parser.ForAssignmentContext): void => {
    this.checkCompound(ctx.assignmentTarget(), ctx.assignmentOperator(), ctx);
  };

  override enterForUpdate = (ctx: Parser.ForUpdateContext): void => {
    this.checkCompound(ctx.assignmentTarget(), ctx.assignmentOperator(), ctx);
  };

  /**
   * #1668: a compound assignment compares its target with its value, exactly
   * as `checkLevel` compares two operands. The target is typed by the same
   * chain walk as an operand, so `s.count *<- 2.5` is checked as surely as
   * `count *<- 2.5`.
   */
  private checkCompound(
    target: Parser.AssignmentTargetContext,
    operator: Parser.AssignmentOperatorContext,
    statement: { expression(): Parser.ExpressionContext },
  ): void {
    if (NOT_RULE_10_4_ASSIGNMENTS.has(operator.getText())) return;

    const value = statement.expression();
    const frame = this.scopes.frameFor(target);
    const left = MixedCategoryListener.categoryOf(
      this.types.typeOfAssignmentTarget(target, frame),
    );
    const right = this.operandCategory(value, frame);
    if (left && right && left !== right) {
      const { line, column } = ParserUtils.getPosition(value);
      this.analyzer.addError(line, column, left, right);
    }
  }
}

/**
 * Analyzer that detects binary operations mixing essential type categories.
 */
class MixedTypeCategoryAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  private errors: IMixedTypeCategoryError[] = [];

  /**
   * Analyze the parse tree for mixed-category binary operations.
   */
  public analyze(tree: Parser.ProgramContext): IMixedTypeCategoryError[] {
    this.errors = [];

    const collector = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(collector, tree);

    const scopes = new ScopeFrameResolver(collector, this.context.symbolTable);
    const listener = new MixedCategoryListener(
      this,
      scopes,
      new OperandTypeResolver(scopes, this.context),
    );

    // Every binary level EXCEPT shift: Rule 10.4 governs only operators subject
    // to the usual arithmetic conversions, and a shift count is promoted
    // independently. A signed shift count is Rule 10.1 (E0805), handled
    // elsewhere (Issue #1085 review).
    ParseTreeWalker.DEFAULT.walk(
      new BinaryOperatorLevelListener((operands, level) => {
        if (level === "shift") return;
        listener.checkLevel(operands);
      }),
      tree,
    );

    // #1668: the compound assignments, which no binary level contains.
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Add a mixed-category error. The remedy differs by pair: a signed/unsigned
   * mix reinterprets bits, an integer/floating mix converts with a cast.
   */
  public addError(
    line: number,
    column: number,
    left: Category,
    right: Category,
  ): void {
    const floating = left === "floating" || right === "floating";
    this.errors.push({
      code: "E0810",
      line,
      column,
      message: `Binary operator combines operands of different essential type categories (${floating ? "integer and floating" : "signed and unsigned"})`,
      helpText: floating
        ? "MISRA C:2012 Rule 10.4: both operands must share an essential type category. " +
          "Convert the integer operand with an explicit cast, e.g. (f32)value (ADR-024)."
        : "MISRA C:2012 Rule 10.4: both operands must share an essential type category. " +
          "Reinterpret one operand's bits to match the other with bit indexing, e.g. value[0, 32] (ADR-007/ADR-024).",
    });
  }
}

export default MixedTypeCategoryAnalyzer;
