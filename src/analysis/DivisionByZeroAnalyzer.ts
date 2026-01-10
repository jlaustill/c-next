/**
 * Division By Zero Analyzer
 * Detects division and modulo by zero at compile time (ADR-051)
 *
 * Phases:
 * 1. Literal zero detection (10 / 0, 10 % 0)
 * 2. Const zero detection (const ZERO <- 0; x / ZERO)
 * 3. Const expression evaluation (const VALUE <- 5 - 5; x / VALUE)
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener.js";
import * as Parser from "../parser/grammar/CNextParser.js";
import { IDivisionByZeroError } from "./types/IDivisionByZeroError.js";

/**
 * Listener that walks the parse tree and detects division by zero
 */
class DivisionByZeroListener extends CNextListener {
  private analyzer: DivisionByZeroAnalyzer;

  constructor(analyzer: DivisionByZeroAnalyzer) {
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
      const line = rightOperand.start?.line ?? 0;
      const column = rightOperand.start?.column ?? 0;

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
      return this.isLiteralZero(literal);
    }

    // TODO: Check if it's a const identifier that evaluates to zero
    // This requires symbol table tracking

    return false;
  }

  /**
   * Check if a literal is zero
   */
  private isLiteralZero(ctx: Parser.LiteralContext): boolean {
    const text = ctx.getText();

    // Check integer literals
    if (ctx.INTEGER_LITERAL()) {
      return text === "0";
    }

    // Check hex literals
    if (ctx.HEX_LITERAL()) {
      return text === "0x0" || text === "0X0";
    }

    // Check binary literals
    if (ctx.BINARY_LITERAL()) {
      return text === "0b0" || text === "0B0";
    }

    // Check suffixed literals
    if (ctx.SUFFIXED_DECIMAL()) {
      return text.startsWith("0u") || text.startsWith("0i");
    }

    if (ctx.SUFFIXED_HEX()) {
      return text.startsWith("0x0u") || text.startsWith("0x0i") ||
             text.startsWith("0X0u") || text.startsWith("0X0i");
    }

    if (ctx.SUFFIXED_BINARY()) {
      return text.startsWith("0b0u") || text.startsWith("0b0i") ||
             text.startsWith("0B0u") || text.startsWith("0B0i");
    }

    return false;
  }
}

/**
 * Analyzer that detects division by zero
 */
export class DivisionByZeroAnalyzer {
  private errors: IDivisionByZeroError[] = [];

  /**
   * Analyze the parse tree for division by zero
   */
  public analyze(tree: Parser.ProgramContext): IDivisionByZeroError[] {
    this.errors = [];
    const listener = new DivisionByZeroListener(this);
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

  /**
   * Get all detected errors
   */
  public getErrors(): IDivisionByZeroError[] {
    return this.errors;
  }
}

export default DivisionByZeroAnalyzer;
