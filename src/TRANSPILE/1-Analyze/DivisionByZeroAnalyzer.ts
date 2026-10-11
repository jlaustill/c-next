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

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import IDivisionByZeroError from "./types/IDivisionByZeroError";
import LiteralUtils from "../../utils/LiteralUtils";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
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
   * Whether a divisor is zero: a zero literal of any kind (`0`, `0u32`,
   * `0.0f32`), an integer the one evaluator folds to 0 (`ZERO`, `5 - 5`), or
   * a const whose zero initializer it does not fold -- a float's. A name
   * written `this.ZERO`, `global.ZERO` or `Scope.ZERO` is bound by the same
   * walk as the bare one, so it means the declaration ADR-057 names (#1268).
   */
  private isZero(ctx: Parser.UnaryExpressionContext): boolean {
    const literal = ctx.postfixExpression()?.primaryExpression()?.literal();
    if (literal) {
      return LiteralUtils.isZeroText(literal.getText());
    }
    const divisor = SyntaxLowering.expressionNode(ctx);
    if (OperandTyper.constantOf(divisor, this.context) === 0) {
      return true;
    }
    const declared = BoundDeclaration.of(
      OperandTyper.bindingOf(divisor, this.context),
    );
    return (
      declared?.isConst === true &&
      declared.initialValue !== null &&
      LiteralUtils.isZeroText(declared.initialValue)
    );
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
