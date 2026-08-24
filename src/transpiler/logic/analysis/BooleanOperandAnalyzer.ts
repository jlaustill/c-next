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
import OperandTypeResolver from "./OperandTypeResolver";
import BinaryOperatorLevelListener from "./BinaryOperatorLevelListener";
import ParserUtils from "../../../utils/ParserUtils";

/**
 * Second pass: report essentially Boolean operands of guarded operators.
 */
class BooleanOperandListener extends CNextListener {
  private readonly analyzer: BooleanOperandAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly scopes: ScopeFrameResolver;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly types: OperandTypeResolver;

  constructor(analyzer: BooleanOperandAnalyzer, scopes: ScopeFrameResolver) {
    super();
    this.analyzer = analyzer;
    this.scopes = scopes;
    this.types = new OperandTypeResolver(scopes);
  }

  /**
   * Whether an operand is essentially Boolean.
   *
   * `!x` is Boolean by construction. Everything else defers to the shared type
   * resolver, so a bool reads the same whether it is spelled `flag`,
   * `this.flag`, `sensor.ready`, `outer.inner.ready`, or `flags[0]`
   * (Issue #1183 review).
   *
   * A multi-operand level below this one (e.g. `a + b` inside `(a + b) * c`) is
   * arithmetic, not Boolean, and reports at its own level.
   */
  private isBooleanOperand(
    ctx: ParserRuleContext,
    frame: IScopeFrame,
  ): boolean {
    let node: ParseTree = ctx;
    while (node instanceof ParserRuleContext && node.getChildCount() === 1) {
      const child = node.getChild(0);
      if (!child) break;
      node = child;
    }

    if (node instanceof Parser.UnaryExpressionContext) {
      return node.getChild(0)?.getText() === "!";
    }

    return this.types.typeOfOperand(ctx, frame) === "bool";
  }

  /**
   * MISRA C:2012 Rule 10.1 on the assignment side.
   *
   * A compound assignment applies an arithmetic or bitwise operator that the
   * expression grammar never expresses as a level, so neither the operator
   * levels nor a target-only check sees both halves. Both are checked here:
   * a bool TARGET (E0806) and a bool right-hand side (E0807). Before this,
   * `n +<- flag` was accepted while the identical `n <- n + flag` was rejected.
   */
  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    const operator = ctx.assignmentOperator().getText();
    if (operator === "<-") return;

    const target = ctx.assignmentTarget();
    const frame = this.scopes.frameFor(ctx);

    if (this.types.typeOfAssignmentTarget(target, frame) === "bool") {
      const { line, column } = ParserUtils.getPosition(target);
      this.analyzer.addCompoundAssignmentError(line, column, target.getText());
      return;
    }

    const value = ctx.expression();
    if (this.isBooleanOperand(value, frame)) {
      const { line, column } = ParserUtils.getPosition(value);
      this.analyzer.addError(line, column, operator);
    }
  };

  /**
   * Report one error per guarded operator whose left or right operand is
   * essentially Boolean. The operator sits between adjacent operands, so the
   * operator joining operand `i` to `i + 1` is child `i * 2 + 1`.
   *
   * Reported once per operator rather than once per operand: `flag / other` is
   * a single mistake, and naming both operands would double every diagnostic.
   */
  public checkLevel(operands: ParserRuleContext[]): void {
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

    // Every binary level EXCEPT equality: comparing two bools with = / != is
    // permitted by Rule 10.1 and is how C-Next tests a flag.
    ParseTreeWalker.DEFAULT.walk(
      new BinaryOperatorLevelListener((operands, level) => {
        if (level === "equality") return;
        listener.checkLevel(operands);
      }),
      tree,
    );

    // Prefix `-` / `~` are not a binary level, so the listener hooks them.
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
   * Add a compound-assignment-to-bool error, naming the target as written so
   * the suggested fix is code that can be pasted back (Issue #1183 review:
   * `flags[0] +<- true` used to suggest `flags <- !flags`, which does not
   * compile).
   */
  public addCompoundAssignmentError(
    line: number,
    column: number,
    target: string,
  ): void {
    this.errors.push({
      code: "E0806",
      line,
      column,
      message: `Compound assignment is not valid on bool '${target}' - only '<-' is`,
      helpText: `MISRA C:2012 Rule 10.1: a bool is not a number. To flip it, use '${target} <- !${target}'.`,
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
