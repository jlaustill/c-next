/**
 * Division By Zero Analyzer
 * Detects division and modulo by zero at compile time (ADR-051)
 *
 * A divisor that is a compile-time constant zero, integer or float (§1, §4):
 * a literal (`0`, `0.0f32`), a const (`ZERO`, `this.ZERO`, `Scope.ZERO`) or
 * a constant expression (`2 - 2`, `-0.0`, `(f32)0`), by the one constant
 * fold, so a name means the declaration ADR-057 names wherever the division
 * is written -- a statement, a member or file initializer, an array dimension,
 * an enum member's value (#1664 box 7, #1268). A compound `/<-` or `%<-`
 * divides by its value the same way (#1770).
 */

import { ParseTreeWalker, ParserRuleContext } from "antlr4ng";
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import IDivisionByZeroError from "./types/IDivisionByZeroError";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import ConstantFold from "../../utils/ConstantFold";
import ConstExprLowering from "../../utils/ConstExprLowering";
import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import AssignmentSiteListener from "./AssignmentSiteListener";
import type IAnalysisContext from "./types/IAnalysisContext";
import type TAssignmentSite from "../../types/TAssignmentSite";

/**
 * Detect division by zero (including const identifiers)
 */
class DivisionByZeroListener extends CNextListener {
  private readonly analyzer: DivisionByZeroAnalyzer;

  constructor(
    analyzer: DivisionByZeroAnalyzer,
    private readonly context: IAnalysisContext,
  ) {
    super();
    this.analyzer = analyzer;
  }

  /**
   * Check multiplicative expressions for division/modulo by zero
   * multiplicativeExpression: unaryExpression (('*' | '/' | '%') unaryExpression)*
   */
  override enterMultiplicativeExpression = (
    ctx: Parser.MultiplicativeExpressionContext,
  ): void => {
    // Get all unary expressions
    const operands = ctx.unaryExpression();
    if (operands.length < 2) {
      return; // No operator, just a single operand
    }

    // Check each operator and its right operand
    for (let i = 0; i < operands.length - 1; i++) {
      const operatorToken = ctx.getChild(i * 2 + 1); // Operators are at odd indices
      if (!operatorToken) continue;

      const operator = operatorToken.getText();
      if (operator !== "/" && operator !== "%") {
        continue; // Only check division and modulo
      }

      const rightOperand = operands[i + 1];
      const { line, column } = ParserUtils.getPosition(rightOperand);

      // Check if right operand is zero
      if (this.isZero(rightOperand)) {
        this.analyzer.addError(
          operator,
          line,
          column,
          DivisionByZeroListener.atRunTime(ctx),
        );
      }
    }
  };

  /**
   * `x /<- d` and `x %<- d` divide `x` by `d`, in a statement or a `for`
   * header
   */
  public checkAssignment(site: TAssignmentSite): void {
    const op = site.assignmentOperator();
    let operator: string | null = null;
    if (op.SLASH_ASSIGN() !== null) operator = "/";
    else if (op.PERCENT_ASSIGN() !== null) operator = "%";
    if (operator === null) return;

    const divisor = site.expression();
    if (this.isZero(divisor)) {
      const { line, column } = ParserUtils.getPosition(divisor);
      this.analyzer.addError(
        operator,
        line,
        column,
        DivisionByZeroListener.atRunTime(divisor),
      );
    }
  }

  /**
   * Whether a divisor is a compile-time zero, integer or float alike (ADR-051
   * §4). An enum or Boolean operand is not a number at all -- E0810/E0811 say
   * so -- so it is not this rule's. A leaf with no C-Next type is still a
   * number when it folds to one: a length property has no source type but a
   * compile-time value (ADR-058). A cast to an undeclared type folds to no
   * value, so `(Nope)0` stays the undefined type's error, E0426 (#1268
   * review).
   */
  private isZero(
    ctx: Parser.UnaryExpressionContext | Parser.ExpressionContext,
  ): boolean {
    const divisor = SyntaxLowering.expressionNode(ctx);
    const numeric = OperandTyper.valueLeaves(divisor, this.context).every(
      (leaf) =>
        leaf === null ||
        (leaf.enumTypeName == null && leaf.category !== "boolean"),
    );
    return (
      numeric &&
      ConstantFold.numberValue(
        this.context.program,
        this.context.sourceFile,
        ConstExprLowering.lower(divisor),
      ) === 0
    );
  }

  /**
   * Whether a `safe_div` call could replace a division: in a statement, and
   * not in what must be known at compile time there -- an array dimension, an
   * enum member's value, a const's initializer (#1268 review)
   */
  private static atRunTime(ctx: ParserRuleContext): boolean {
    for (let node = ctx.parent; node !== null; node = node.parent) {
      if (
        node instanceof Parser.ArrayDimensionContext ||
        node instanceof Parser.ArrayTypeDimensionContext ||
        node instanceof Parser.EnumMemberContext ||
        (node instanceof Parser.VariableDeclarationContext &&
          node.constModifier() !== null)
      ) {
        return false;
      }
      if (node instanceof Parser.StatementContext) return true;
    }
    return false;
  }
}

/**
 * Analyzer that detects division by zero
 */
class DivisionByZeroAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  private errors: IDivisionByZeroError[] = [];

  /**
   * Analyze the parse tree for division/modulo by a compile-time zero
   */
  public analyze(tree: Parser.ProgramContext): IDivisionByZeroError[] {
    this.errors = [];
    const listener = new DivisionByZeroListener(this, this.context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    ParseTreeWalker.DEFAULT.walk(
      new AssignmentSiteListener((site) => listener.checkAssignment(site)),
      tree,
    );

    // Two walks; report in source order
    return this.errors.sort((a, b) => a.line - b.line || a.column - b.column);
  }

  /**
   * Add a division by zero error
   */
  public addError(
    operator: string,
    line: number,
    column: number,
    atRunTime: boolean,
  ): void {
    const isDivision = operator === "/";
    const code = isDivision ? "E0800" : "E0802";
    const opName = isDivision ? "Division" : "Modulo";
    const builtin = isDivision ? "safe_div" : "safe_mod";

    this.errors.push({
      code,
      operator,
      line,
      column,
      message: `${opName} by zero`,
      helpText: atRunTime
        ? `Consider using ${builtin}(output, numerator, divisor, defaultValue) for runtime safety`
        : "A divisor known at compile time must not be zero",
    });
  }
}

export default DivisionByZeroAnalyzer;
