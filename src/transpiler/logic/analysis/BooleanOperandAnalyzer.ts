/**
 * Boolean Operand Analyzer
 *
 * Detects arithmetic, bitwise, shift and relational operators applied to an
 * essentially Boolean operand.
 *
 * MISRA C:2012 Rule 10.1: "Operands shall not be of an inappropriate essential
 * type." An essentially Boolean operand is permitted only for the logical
 * operators (&&, ||, !), for equality (=, !=), and as a controlling expression.
 * It is not a number: `flag + 1` relies on Boolean-to-integer promotion, and
 * `a / b` on two bools is an unguarded division by zero whenever `b` is false
 * (Issue #1183) -- a risk carried by the TYPE, so the literal-divisor check in
 * DivisionByZeroAnalyzer (E0800) can never see it.
 *
 * `a - b` is the other trap: `false - true` is -1, which stores back into a
 * bool as `true`, so subtracting from a false flag sets it.
 *
 * Equality is deliberately NOT checked: C-Next requires conditions to be
 * explicit comparisons, so `if (flag = true)` is the idiomatic test and must
 * stay legal. `!flag` likewise remains the way to negate.
 *
 * This is the same rule E0805 enforces for signed shift operands, and the
 * sibling of E0806 (compound assignment to a bool, Issue #1145) on the
 * assignment side.
 *
 * Two-pass analysis, sharing DeclarationScopeCollector with the Rule 10.4
 * analyzer so both resolve declarations through one scope-shadowing pass:
 * 1. Collect declarations into per-scope frames.
 * 2. Walk each guarded operator level and report any Boolean operand.
 */

import { ParseTreeWalker, ParserRuleContext, ParseTree } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IBooleanOperandError from "./types/IBooleanOperandError";
import IScopeFrame from "./types/IScopeFrame";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import ScopeFrameResolver from "./ScopeFrameResolver";
import ParserUtils from "../../../utils/ParserUtils";

/**
 * Second pass: report essentially Boolean operands of guarded operators.
 */
class BooleanOperandListener extends CNextListener {
  private readonly analyzer: BooleanOperandAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly scopes: ScopeFrameResolver;

  constructor(analyzer: BooleanOperandAnalyzer, scopes: ScopeFrameResolver) {
    super();
    this.analyzer = analyzer;
    this.scopes = scopes;
  }

  /** True when a declared name resolves to `bool` within its scope. */
  private isBooleanName(name: string, frame: IScopeFrame): boolean {
    return this.scopes.typeOfName(name, frame) === "bool";
  }

  /**
   * Descend through pass-through levels -- an operator level holding a single
   * operand carries that operand's type unchanged -- to the node that actually
   * determines the operand's essential type.
   */
  private static descend(ctx: ParserRuleContext): ParseTree {
    let node: ParseTree = ctx;
    while (node instanceof ParserRuleContext && node.getChildCount() === 1) {
      const child = node.getChild(0);
      if (!child) break;
      node = child;
    }
    return node;
  }

  /**
   * Whether an operand is essentially Boolean.
   *
   * A multi-operand level below this one (e.g. `a + b` inside `(a + b) * c`) is
   * arithmetic, not Boolean, and reports at its own level -- so only single
   * value leaves, `!x`, and parenthesised expressions are classified here.
   */
  private isBooleanOperand(
    ctx: ParserRuleContext,
    frame: IScopeFrame,
  ): boolean {
    const node = BooleanOperandListener.descend(ctx);

    // `!x` yields an essentially Boolean result.
    if (node instanceof Parser.UnaryExpressionContext) {
      return node.getChild(0)?.getText() === "!";
    }

    // `( expression )` carries the inner expression's type.
    if (node instanceof Parser.PrimaryExpressionContext) {
      const inner = node.expression();
      return inner ? this.isBooleanOperand(inner, frame) : false;
    }

    if (node instanceof ParserRuleContext) {
      return false;
    }

    const text = node.getText();
    if (text === "true" || text === "false") return true;
    return this.isBooleanName(text, frame);
  }

  /**
   * Report one error per guarded operator whose left or right operand is
   * essentially Boolean. The operator sits between adjacent operands, so the
   * operator joining operand `i` to `i + 1` is child `i * 2 + 1`.
   *
   * Reported once per operator rather than once per operand: `flag / other` is
   * a single mistake, and naming both operands would double every diagnostic.
   */
  private checkLevel(operands: ParserRuleContext[]): void {
    if (operands.length < 2) return;
    const frame = this.scopes.frameFor(operands[0]);
    const parent = operands[0].parent;

    for (let i = 0; i < operands.length - 1; i += 1) {
      const leftIsBoolean = this.isBooleanOperand(operands[i], frame);
      const rightIsBoolean = this.isBooleanOperand(operands[i + 1], frame);
      if (!leftIsBoolean && !rightIsBoolean) continue;

      const operator = parent?.getChild(i * 2 + 1)?.getText() ?? "";
      const offending = leftIsBoolean ? operands[i] : operands[i + 1];
      const { line, column } = ParserUtils.getPosition(offending);
      this.analyzer.addError(line, column, operator);
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

  // Boolean values are not ordered, so `<`, `>`, `<=`, `>=` are meaningless on
  // them. Equality (the equalityExpression level) is permitted and not checked.
  override enterRelationalExpression = (
    ctx: Parser.RelationalExpressionContext,
  ): void => {
    this.checkLevel(ctx.bitwiseOrExpression());
  };

  // Prefix `-` and `~` are arithmetic/bitwise; `!` is the correct negation.
  override enterUnaryExpression = (
    ctx: Parser.UnaryExpressionContext,
  ): void => {
    const operator = ctx.getChild(0)?.getText();
    if (operator !== "-" && operator !== "~") return;

    const operand = ctx.unaryExpression();
    if (!operand) return;

    if (this.isBooleanOperand(operand, this.scopes.frameFor(ctx))) {
      const { line, column } = ParserUtils.getPosition(ctx);
      this.analyzer.addError(line, column, operator);
    }
  };
}

/**
 * Analyzer that detects essentially Boolean operands of arithmetic, bitwise,
 * shift and relational operators.
 */
class BooleanOperandAnalyzer {
  private errors: IBooleanOperandError[] = [];

  /**
   * Analyze the parse tree for Boolean operands of inappropriate operators.
   */
  public analyze(tree: Parser.ProgramContext): IBooleanOperandError[] {
    this.errors = [];

    const collector = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(collector, tree);

    const listener = new BooleanOperandListener(
      this,
      new ScopeFrameResolver(collector),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Add a Boolean-operand error.
   */
  public addError(line: number, column: number, operator: string): void {
    this.errors.push({
      code: "E0807",
      line,
      column,
      message: `Operator '${operator}' is not valid on a bool operand`,
      helpText:
        "MISRA C:2012 Rule 10.1: a bool is not a number. Use the logical operators " +
        "(&&, ||, !) to combine flags, or '=' / '!=' to compare them.",
    });
  }

  /**
   * Get all detected errors.
   */
  public getErrors(): IBooleanOperandError[] {
    return this.errors;
  }
}

export default BooleanOperandAnalyzer;
