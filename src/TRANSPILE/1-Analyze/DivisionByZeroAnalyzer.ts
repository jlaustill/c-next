/**
 * Division By Zero Analyzer
 * Detects division and modulo by zero at compile time (ADR-051)
 *
 * A literal zero (10 / 0, 10 % 0), or a const whose value is zero where the
 * division is written (const u32 ZERO <- 0; x / ZERO).
 *
 * #1664 box 7: the const's value is the one visible at the division, as 1.4
 * settled it -- a local, the enclosing scope's, a file-scope one, or one from
 * an included file (#1220). This pass collected its own file-wide set of
 * const zeros by bare name, so a local `const D <- 0` in one function made
 * `x / D` in another an error when that `D` was a nonzero global. A const
 * folded from an expression (`const u32 V <- 5 - 5`) is zero here too.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import IDivisionByZeroError from "./types/IDivisionByZeroError";
import LiteralUtils from "../../utils/LiteralUtils";
import ParserUtils from "../../utils/ParserUtils";
import type IAnalysisContext from "./types/IAnalysisContext";
import BoundDeclaration from "./helpers/BoundDeclaration";

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
        this.analyzer.addError(operator, line, column);
      }
    }
  };

  /**
   * Check if a unary expression evaluates to zero
   */
  private isZero(ctx: Parser.UnaryExpressionContext): boolean {
    // Get the postfix expression
    const postfixExpr = ctx.postfixExpression();
    if (!postfixExpr) {
      return false;
    }

    // Get the primary expression
    const primaryExpr = postfixExpr.primaryExpression();
    if (!primaryExpr) {
      return false;
    }

    // Check if it's a literal
    const literal = primaryExpr.literal();
    if (literal) {
      return LiteralUtils.isZero(literal);
    }

    // A const that is zero where it is used
    const identifier = primaryExpr.IDENTIFIER();
    if (identifier) {
      return this.isConstZero(identifier.getText(), ctx);
    }

    return false;
  }

  /**
   * Whether `name` binds, where it is used, to a const that is zero: a zero
   * literal of any kind (`0`, `0u32`, `0.0`), or an integer that folds to 0
   * (`5 - 5`). Through the one binder, so a local shadows as it does
   * everywhere else and a const from an included file is found (#1220).
   */
  private isConstZero(name: string, at: ParserRuleContext): boolean {
    const binding = this.context.program.bindValue(
      this.context.sourceFile,
      null,
      name,
      ParserUtils.getPosition(at),
    );
    const declared = BoundDeclaration.of(binding);
    if (binding === null || !declared?.isConst) {
      return false;
    }
    if (
      declared.initialValue !== null &&
      LiteralUtils.isZeroText(declared.initialValue)
    ) {
      return true;
    }
    return this.context.program.constantOf(binding)?.value === 0;
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
   * Analyze the parse tree for division/modulo by a literal or const zero
   */
  public analyze(tree: Parser.ProgramContext): IDivisionByZeroError[] {
    this.errors = [];
    const listener = new DivisionByZeroListener(this, this.context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Add a division by zero error
   */
  public addError(operator: string, line: number, column: number): void {
    const isDivision = operator === "/";
    const code = isDivision ? "E0800" : "E0802";
    const opName = isDivision ? "Division" : "Modulo";

    this.errors.push({
      code,
      operator,
      line,
      column,
      message: `${opName} by zero`,
      helpText: isDivision
        ? "Consider using safe_div(output, numerator, divisor, defaultValue) for runtime safety"
        : "Consider using safe_mod(output, numerator, divisor, defaultValue) for runtime safety",
    });
  }
}

export default DivisionByZeroAnalyzer;
