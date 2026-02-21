/**
 * Array Index Type Analyzer
 * Detects signed and floating-point types used as array or bit subscript indexes
 *
 * C-Next requires unsigned integer types for all subscript operations to prevent
 * undefined behavior from negative indexes. This analyzer catches type violations
 * at compile time with clear error messages.
 *
 * Two-pass analysis:
 * 1. Collect variable declarations with their types
 * 2. Validate subscript expressions use unsigned integer types
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IArrayIndexTypeError from "./types/IArrayIndexTypeError";
import LiteralUtils from "../../../utils/LiteralUtils";
import ParserUtils from "../../../utils/ParserUtils";
import TypeConstants from "../../../utils/constants/TypeConstants";

/**
 * First pass: Collect variable declarations with their types
 */
class VariableTypeCollector extends CNextListener {
  private readonly varTypes: Map<string, string> = new Map();

  public getVarTypes(): Map<string, string> {
    return this.varTypes;
  }

  /**
   * Track variable declarations
   */
  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    const typeCtx = ctx.type();
    const identifier = ctx.IDENTIFIER();
    if (!typeCtx || !identifier) return;

    this.varTypes.set(identifier.getText(), typeCtx.getText());
  };

  /**
   * Track function parameters
   */
  override enterParameter = (ctx: Parser.ParameterContext): void => {
    const typeCtx = ctx.type();
    const identifier = ctx.IDENTIFIER();
    if (!typeCtx || !identifier) return;

    this.varTypes.set(identifier.getText(), typeCtx.getText());
  };

  /**
   * Track for-loop variable declarations
   */
  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    const typeCtx = ctx.type();
    const identifier = ctx.IDENTIFIER();
    if (!typeCtx || !identifier) return;

    this.varTypes.set(identifier.getText(), typeCtx.getText());
  };
}

/**
 * Second pass: Validate subscript index expressions use unsigned integer types
 */
class IndexTypeListener extends CNextListener {
  private readonly analyzer: ArrayIndexTypeAnalyzer;

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly varTypes: Map<string, string>;

  constructor(analyzer: ArrayIndexTypeAnalyzer, varTypes: Map<string, string>) {
    super();
    this.analyzer = analyzer;
    this.varTypes = varTypes;
  }

  /**
   * Check postfix operations in expressions (RHS: arr[idx], flags[bit])
   */
  override enterPostfixOp = (ctx: Parser.PostfixOpContext): void => {
    if (!ctx.LBRACKET()) return;

    const expressions = ctx.expression();
    for (const expr of expressions) {
      this.validateIndexExpression(expr);
    }
  };

  /**
   * Check postfix target operations in assignments (LHS: arr[idx] <- val)
   */
  override enterPostfixTargetOp = (
    ctx: Parser.PostfixTargetOpContext,
  ): void => {
    if (!ctx.LBRACKET()) return;

    const expressions = ctx.expression();
    for (const expr of expressions) {
      this.validateIndexExpression(expr);
    }
  };

  /**
   * Validate that a subscript index expression uses an unsigned integer type
   */
  private validateIndexExpression(ctx: Parser.ExpressionContext): void {
    const primaryExpr = this.drillToPrimaryExpression(ctx);
    if (!primaryExpr) return;

    // Check for literal: integer literals are fine, float literals are not
    const literal = primaryExpr.literal();
    if (literal) {
      if (LiteralUtils.isFloat(literal)) {
        const { line, column } = ParserUtils.getPosition(ctx);
        this.analyzer.addError(line, column, "E0851", "float literal");
      }
      // Integer literals are always valid as indexes
      return;
    }

    // Check for dot-qualified identifier (e.g., EColor.RED) - allow enum access
    const text = ctx.getText();
    if (text.includes(".")) return;

    // Check for identifier - look up type
    const identifier = primaryExpr.IDENTIFIER();
    if (!identifier) return;

    const varName = identifier.getText();
    const varType = this.varTypes.get(varName);
    if (!varType) return; // Can't resolve type, pass through

    // Check if signed integer type
    if (TypeConstants.SIGNED_TYPES.includes(varType)) {
      const { line, column } = ParserUtils.getPosition(ctx);
      this.analyzer.addError(line, column, "E0850", varType);
      return;
    }

    // Check if float type
    if (TypeConstants.FLOAT_TYPES.includes(varType)) {
      const { line, column } = ParserUtils.getPosition(ctx);
      this.analyzer.addError(line, column, "E0851", varType);
      return;
    }

    // Check if unsigned type - these are allowed
    if (TypeConstants.UNSIGNED_INDEX_TYPES.includes(varType)) {
      return;
    }

    // Other non-integer types (e.g., string, struct) - E0852
    // Only flag if we could resolve the type
    const { line, column } = ParserUtils.getPosition(ctx);
    this.analyzer.addError(line, column, "E0852", varType);
  }

  /**
   * Drill through the grammar hierarchy from expression to primaryExpression.
   *
   * Expression chain:
   * expression -> ternaryExpression -> orExpression[0] -> andExpression[0]
   * -> equalityExpression[0] -> relationalExpression[0] -> bitwiseOrExpression[0]
   * -> bitwiseXorExpression[0] -> bitwiseAndExpression[0] -> shiftExpression[0]
   * -> additiveExpression[0] -> multiplicativeExpression[0] -> unaryExpression[0]
   * -> postfixExpression -> primaryExpression
   *
   * Returns null if any step fails (complex expression that can't be statically resolved).
   */
  private drillToPrimaryExpression(
    ctx: Parser.ExpressionContext,
  ): Parser.PrimaryExpressionContext | null {
    const ternary = ctx.ternaryExpression();
    if (!ternary) return null;

    const orExpressions = ternary.orExpression();
    if (orExpressions.length === 0) return null;
    const orExpr = orExpressions[0];

    const andExpressions = orExpr.andExpression();
    if (andExpressions.length === 0) return null;
    const andExpr = andExpressions[0];

    const eqExpressions = andExpr.equalityExpression();
    if (eqExpressions.length === 0) return null;
    const eqExpr = eqExpressions[0];

    const relExpressions = eqExpr.relationalExpression();
    if (relExpressions.length === 0) return null;
    const relExpr = relExpressions[0];

    const bitorExpressions = relExpr.bitwiseOrExpression();
    if (bitorExpressions.length === 0) return null;
    const bitorExpr = bitorExpressions[0];

    const bitxorExpressions = bitorExpr.bitwiseXorExpression();
    if (bitxorExpressions.length === 0) return null;
    const bitxorExpr = bitxorExpressions[0];

    const bitandExpressions = bitxorExpr.bitwiseAndExpression();
    if (bitandExpressions.length === 0) return null;
    const bitandExpr = bitandExpressions[0];

    const shiftExpressions = bitandExpr.shiftExpression();
    if (shiftExpressions.length === 0) return null;
    const shiftExpr = shiftExpressions[0];

    const addExpressions = shiftExpr.additiveExpression();
    if (addExpressions.length === 0) return null;
    const addExpr = addExpressions[0];

    const mulExpressions = addExpr.multiplicativeExpression();
    if (mulExpressions.length === 0) return null;
    const mulExpr = mulExpressions[0];

    const unaryExpressions = mulExpr.unaryExpression();
    if (unaryExpressions.length === 0) return null;
    const unaryExpr = unaryExpressions[0];

    const postfixExpr = unaryExpr.postfixExpression();
    if (!postfixExpr) return null;

    return postfixExpr.primaryExpression();
  }
}

/**
 * Analyzer that detects non-unsigned-integer types used as subscript indexes
 */
class ArrayIndexTypeAnalyzer {
  private errors: IArrayIndexTypeError[] = [];

  /**
   * Analyze the parse tree for invalid subscript index types
   */
  public analyze(tree: Parser.ProgramContext): IArrayIndexTypeError[] {
    this.errors = [];

    // First pass: collect variable types
    const collector = new VariableTypeCollector();
    ParseTreeWalker.DEFAULT.walk(collector, tree);
    const varTypes = collector.getVarTypes();

    // Second pass: validate subscript index expressions
    const listener = new IndexTypeListener(this, varTypes);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Add an index type error
   */
  public addError(
    line: number,
    column: number,
    code: string,
    actualType: string,
  ): void {
    this.errors.push({
      code,
      line,
      column,
      actualType,
      message: `Subscript index must be an unsigned integer type; got '${actualType}'`,
      helpText:
        "Use an unsigned integer type (u8, u16, u32, u64) for array and bit subscript indexes.",
    });
  }

  /**
   * Get all detected errors
   */
  public getErrors(): IArrayIndexTypeError[] {
    return this.errors;
  }
}

export default ArrayIndexTypeAnalyzer;
