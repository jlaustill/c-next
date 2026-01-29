/**
 * Float Modulo Analyzer
 * Detects modulo operator usage with floating-point types at compile time
 *
 * The modulo operator (%) is only valid for integer types in C.
 * C-Next catches this early with a clear error message.
 *
 * Two-pass analysis:
 * 1. Collect variable declarations with f32/f64 types
 * 2. Detect modulo operations using float variables or literals
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../antlr_parser/grammar/CNextListener";
import * as Parser from "../antlr_parser/grammar/CNextParser";
import IFloatModuloError from "./types/IFloatModuloError";
import LiteralUtils from "../utils/LiteralUtils";
import ParserUtils from "../utils/ParserUtils";
import TypeConstants from "../constants/TypeConstants";

/**
 * First pass: Collect variable declarations with float types
 */
class FloatVariableCollector extends CNextListener {
  private readonly floatVars: Set<string> = new Set();

  public getFloatVars(): Set<string> {
    return this.floatVars;
  }

  /**
   * Track variable declarations with f32/f64 types
   */
  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    const typeCtx = ctx.type();
    if (!typeCtx) return;

    const typeName = typeCtx.getText();
    if (!TypeConstants.FLOAT_TYPES.includes(typeName)) return;

    const identifier = ctx.IDENTIFIER();
    if (!identifier) return;

    this.floatVars.add(identifier.getText());
  };

  /**
   * Track function parameters with f32/f64 types
   */
  override enterParameter = (ctx: Parser.ParameterContext): void => {
    const typeCtx = ctx.type();
    if (!typeCtx) return;

    const typeName = typeCtx.getText();
    if (!TypeConstants.FLOAT_TYPES.includes(typeName)) return;

    const identifier = ctx.IDENTIFIER();
    if (!identifier) return;

    this.floatVars.add(identifier.getText());
  };
}

/**
 * Second pass: Detect modulo operations with float operands
 */
class FloatModuloListener extends CNextListener {
  private readonly analyzer: FloatModuloAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly floatVars: Set<string>;

  constructor(analyzer: FloatModuloAnalyzer, floatVars: Set<string>) {
    super();
    this.analyzer = analyzer;
    this.floatVars = floatVars;
  }

  /**
   * Check multiplicative expressions for modulo with float operands
   * multiplicativeExpression: unaryExpression (('*' | '/' | '%') unaryExpression)*
   */
  override enterMultiplicativeExpression = (
    ctx: Parser.MultiplicativeExpressionContext,
  ): void => {
    const operands = ctx.unaryExpression();
    if (operands.length < 2) return;

    // Check each operator
    for (let i = 0; i < operands.length - 1; i++) {
      const operatorToken = ctx.getChild(i * 2 + 1);
      if (!operatorToken) continue;

      const operator = operatorToken.getText();
      if (operator !== "%") continue;

      const leftOperand = operands[i];
      const rightOperand = operands[i + 1];

      const leftIsFloat = this.isFloatOperand(leftOperand);
      const rightIsFloat = this.isFloatOperand(rightOperand);

      if (leftIsFloat || rightIsFloat) {
        const { line, column } = ParserUtils.getPosition(leftOperand);
        this.analyzer.addError(line, column);
      }
    }
  };

  /**
   * Check if a unary expression is a float type
   */
  private isFloatOperand(ctx: Parser.UnaryExpressionContext): boolean {
    const postfixExpr = ctx.postfixExpression();
    if (!postfixExpr) return false;

    const primaryExpr = postfixExpr.primaryExpression();
    if (!primaryExpr) return false;

    // Check for float literal
    const literal = primaryExpr.literal();
    if (literal) {
      return LiteralUtils.isFloat(literal);
    }

    // Check for identifier that's a float variable
    const identifier = primaryExpr.IDENTIFIER();
    if (identifier) {
      return this.floatVars.has(identifier.getText());
    }

    return false;
  }
}

/**
 * Analyzer that detects modulo operations with floating-point types
 */
class FloatModuloAnalyzer {
  private errors: IFloatModuloError[] = [];

  /**
   * Analyze the parse tree for float modulo operations
   */
  public analyze(tree: Parser.ProgramContext): IFloatModuloError[] {
    this.errors = [];

    // First pass: collect float variables
    const collector = new FloatVariableCollector();
    ParseTreeWalker.DEFAULT.walk(collector, tree);
    const floatVars = collector.getFloatVars();

    // Second pass: detect modulo with floats
    const listener = new FloatModuloListener(this, floatVars);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Add a float modulo error
   */
  public addError(line: number, column: number): void {
    this.errors.push({
      code: "E0804",
      line,
      column,
      message: "Modulo operator not supported for floating-point types",
      helpText:
        "The % operator only works with integer types. Use fmod() from <math.h> for floating-point remainder.",
    });
  }

  /**
   * Get all detected errors
   */
  public getErrors(): IFloatModuloError[] {
    return this.errors;
  }
}

export default FloatModuloAnalyzer;
