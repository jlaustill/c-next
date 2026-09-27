/**
 * Float Modulo Analyzer
 * Detects modulo operator usage with floating-point types at compile time
 *
 * The modulo operator (%) is only valid for integer types in C.
 * C-Next catches this early with a clear error message.
 *
 * Each operand is typed by the one operand typer (#1668), which binds names
 * through Program's lexical frames and types every operand shape -- a field,
 * an element, a call, a cast, a C or C++ header's value.
 *
 * Issue #1220: this used to be a private Set of float variable names built
 * from this file's parse tree alone, so an `f32` arriving through an #include
 * was invisible and `floatValue % 2` compiled to C that gcc then rejects with
 * "invalid operands to binary %". The typer is the one cross-file-aware answer
 * the essential-type analyzers share, instead of a per-analyzer cache.
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import IFloatModuloError from "./types/IFloatModuloError";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import type IAnalysisContext from "./types/IAnalysisContext";

/**
 * Detects modulo operations with float operands
 */
class FloatModuloListener extends CNextListener {
  private readonly analyzer: FloatModuloAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  constructor(
    analyzer: FloatModuloAnalyzer,
    private readonly context: IAnalysisContext,
  ) {
    super();
    this.analyzer = analyzer;
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
  /** Floating by the one operand typer, whatever the operand's shape (#1668) */
  private isFloatOperand(ctx: Parser.UnaryExpressionContext): boolean {
    return OperandTyper.typeOf(ctx, this.context)?.category === "floating";
  }
}

/**
 * Analyzer that detects modulo operations with floating-point types
 */
class FloatModuloAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  private errors: IFloatModuloError[] = [];

  /**
   * Analyze the parse tree for float modulo operations
   */
  public analyze(tree: Parser.ProgramContext): IFloatModuloError[] {
    this.errors = [];

    // Operands bind and type through Program's lexical frames (#1668)
    ParseTreeWalker.DEFAULT.walk(
      new FloatModuloListener(this, this.context),
      tree,
    );

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
}

export default FloatModuloAnalyzer;
