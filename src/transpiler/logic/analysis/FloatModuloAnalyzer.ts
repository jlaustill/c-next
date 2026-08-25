/**
 * Float Modulo Analyzer
 * Detects modulo operator usage with floating-point types at compile time
 *
 * The modulo operator (%) is only valid for integer types in C.
 * C-Next catches this early with a clear error message.
 *
 * Two-pass analysis:
 * 1. Build lexical scope frames (DeclarationScopeCollector)
 * 2. Detect modulo operations using float variables or literals
 *
 * Issue #1220: pass 1 used to be a private Set of float variable names built
 * from this file's parse tree alone, so an `f32` arriving through an #include
 * was invisible and `floatValue % 2` compiled to C that gcc then rejects with
 * "invalid operands to binary %". Resolution now goes through
 * ScopeFrameResolver, which searches the lexical frames and falls back to the
 * symbol table -- one cross-file-aware answer shared with the other
 * essential-type analyzers instead of a per-analyzer cache.
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IFloatModuloError from "./types/IFloatModuloError";
import LiteralUtils from "../../../utils/LiteralUtils";
import ParserUtils from "../../../utils/ParserUtils";
import TypeConstants from "../../../utils/constants/TypeConstants";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import ScopeFrameResolver from "./ScopeFrameResolver";

/**
 * Second pass: Detect modulo operations with float operands
 */
class FloatModuloListener extends CNextListener {
  private readonly analyzer: FloatModuloAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly scopes: ScopeFrameResolver;

  constructor(analyzer: FloatModuloAnalyzer, scopes: ScopeFrameResolver) {
    super();
    this.analyzer = analyzer;
    this.scopes = scopes;
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

    // Check for identifier that's a float variable. Resolved against the
    // lexical frames first, then the symbol table, so an included declaration
    // counts and a same-named local in another function does not (#1220).
    const identifier = primaryExpr.IDENTIFIER();
    if (identifier) {
      const typeName = this.scopes.typeOfName(
        identifier.getText(),
        this.scopes.frameFor(ctx),
      );
      return typeName !== null && TypeConstants.FLOAT_TYPES.includes(typeName);
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

    // First pass: build the lexical scope frames
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    // Second pass: detect modulo with floats
    const listener = new FloatModuloListener(
      this,
      new ScopeFrameResolver(declarations),
    );
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
