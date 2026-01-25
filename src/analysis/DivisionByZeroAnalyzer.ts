/**
 * Division By Zero Analyzer
 * Detects division and modulo by zero at compile time (ADR-051)
 *
 * Implemented Phases:
 * ✓ Phase 1: Literal zero detection (10 / 0, 10 % 0)
 * ✓ Phase 3: Const zero detection (const u32 ZERO <- 0; x / ZERO)
 *
 * Future Enhancement (Phase 3+):
 * - Const expression evaluation (const u32 VALUE <- 5 - 5; x / VALUE)
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IDivisionByZeroError from "./types/IDivisionByZeroError";
import LiteralUtils from "./LiteralUtils";
import ExpressionUtils from "./ExpressionUtils";

/**
 * First pass: Collect const declarations that are zero
 */
class ConstZeroCollector extends CNextListener {
  private constZeros: Set<string> = new Set();

  public getConstZeros(): Set<string> {
    return this.constZeros;
  }

  /**
   * Track const declarations
   * variableDeclaration: atomicModifier? volatileModifier? constModifier? ...
   */
  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    // Only process const declarations
    if (!ctx.constModifier()) {
      return;
    }

    const identifier = ctx.IDENTIFIER();
    if (!identifier) {
      return;
    }

    const name = identifier.getText();
    const expr = ctx.expression();
    if (!expr) {
      return;
    }

    // Check if the expression is a literal zero
    const literal = ExpressionUtils.extractLiteral(expr);
    if (literal && LiteralUtils.isZero(literal)) {
      this.constZeros.add(name);
    }
  };
}

/**
 * Second pass: Detect division by zero (including const identifiers)
 */
class DivisionByZeroListener extends CNextListener {
  private analyzer: DivisionByZeroAnalyzer;
  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private constZeros: Set<string>;

  constructor(analyzer: DivisionByZeroAnalyzer, constZeros: Set<string>) {
    super();
    this.analyzer = analyzer;
    this.constZeros = constZeros;
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
      return LiteralUtils.isZero(literal);
    }

    // Check if it's a const identifier that evaluates to zero
    const identifier = primaryExpr.IDENTIFIER();
    if (identifier) {
      const name = identifier.getText();
      return this.constZeros.has(name);
    }

    return false;
  }
}

/**
 * Analyzer that detects division by zero
 */
class DivisionByZeroAnalyzer {
  private errors: IDivisionByZeroError[] = [];

  /**
   * Analyze the parse tree for division by zero
   * Two-pass analysis:
   * 1. Collect const declarations that are zero
   * 2. Detect division/modulo by literal zero or const zero
   */
  public analyze(tree: Parser.ProgramContext): IDivisionByZeroError[] {
    this.errors = [];

    // First pass: collect const zeros
    const collector = new ConstZeroCollector();
    ParseTreeWalker.DEFAULT.walk(collector, tree);
    const constZeros = collector.getConstZeros();

    // Second pass: detect division by zero
    const listener = new DivisionByZeroListener(this, constZeros);
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
