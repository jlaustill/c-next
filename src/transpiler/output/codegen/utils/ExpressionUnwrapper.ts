/**
 * Expression Unwrapper Utility
 *
 * Navigates through the C-Next expression tree hierarchy to extract
 * inner expressions. The C-Next grammar has a deep expression hierarchy:
 *
 * expression -> ternary -> or -> and -> equality -> relational ->
 * bitwiseOr -> bitwiseXor -> bitwiseAnd -> shift -> additive ->
 * multiplicative -> unary -> postfix
 *
 * This utility extracts inner expressions when they are "simple" (single term
 * at each level), returning null if any level has multiple terms (indicating
 * a binary operation at that level).
 *
 * Issue #707: Extracted from CodeGenerator.ts and TypeResolver.ts to
 * eliminate code duplication.
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser";

/**
 * Utility class for navigating expression tree hierarchy
 */
class ExpressionUnwrapper {
  /**
   * Navigate from ExpressionContext to ShiftExpressionContext.
   * This is the common navigation path shared by getPostfixExpression,
   * getUnaryExpression, and getAdditiveExpression.
   *
   * Returns null if expression has multiple terms at any level above shift.
   */
  private static navigateToShift(
    ctx: Parser.ExpressionContext,
  ): Parser.ShiftExpressionContext | null {
    const ternary = ctx.ternaryExpression();
    const orExprs = ternary.orExpression();
    // If it's a ternary (3 orExpressions), we can't get a single expression
    if (orExprs.length !== 1) return null;

    const or = orExprs[0];
    if (or.andExpression().length !== 1) return null;

    const and = or.andExpression()[0];
    if (and.equalityExpression().length !== 1) return null;

    const eq = and.equalityExpression()[0];
    if (eq.relationalExpression().length !== 1) return null;

    const rel = eq.relationalExpression()[0];
    if (rel.bitwiseOrExpression().length !== 1) return null;

    const bor = rel.bitwiseOrExpression()[0];
    if (bor.bitwiseXorExpression().length !== 1) return null;

    const bxor = bor.bitwiseXorExpression()[0];
    if (bxor.bitwiseAndExpression().length !== 1) return null;

    const band = bxor.bitwiseAndExpression()[0];
    if (band.shiftExpression().length !== 1) return null;

    return band.shiftExpression()[0];
  }

  /**
   * Navigate from ShiftExpressionContext to UnaryExpressionContext.
   * Returns null if any level has multiple terms.
   */
  private static navigateShiftToUnary(
    shift: Parser.ShiftExpressionContext,
  ): Parser.UnaryExpressionContext | null {
    if (shift.additiveExpression().length !== 1) return null;

    const add = shift.additiveExpression()[0];
    if (add.multiplicativeExpression().length !== 1) return null;

    const mult = add.multiplicativeExpression()[0];
    if (mult.unaryExpression().length !== 1) return null;

    return mult.unaryExpression()[0];
  }

  /**
   * Navigate from ExpressionContext to PostfixExpressionContext.
   * Returns null if the expression has multiple terms at any level
   * (indicating binary operations).
   *
   * Use this when you need to access the postfix expression for:
   * - Getting the primary expression (identifier, literal)
   * - Checking postfix operators (member access, array indexing)
   */
  static getPostfixExpression(
    ctx: Parser.ExpressionContext,
  ): Parser.PostfixExpressionContext | null {
    const shift = this.navigateToShift(ctx);
    if (!shift) return null;

    const unary = this.navigateShiftToUnary(shift);
    if (!unary?.postfixExpression()) return null;

    return unary.postfixExpression()!;
  }

  /**
   * Navigate from ExpressionContext to UnaryExpressionContext.
   * Returns null if the expression has multiple terms at any level.
   *
   * Use this when you need access to unary operators (!, -, ~, etc.)
   */
  static getUnaryExpression(
    ctx: Parser.ExpressionContext,
  ): Parser.UnaryExpressionContext | null {
    const shift = this.navigateToShift(ctx);
    if (!shift) return null;

    return this.navigateShiftToUnary(shift);
  }

  /**
   * Navigate from ExpressionContext to AdditiveExpressionContext.
   * Returns null if the expression has multiple terms at outer levels.
   *
   * Use this when you need to check for additive operations (+, -)
   */
  static getAdditiveExpression(
    ctx: Parser.ExpressionContext,
  ): Parser.AdditiveExpressionContext | null {
    const shift = this.navigateToShift(ctx);
    if (!shift) return null;

    if (shift.additiveExpression().length !== 1) return null;

    return shift.additiveExpression()[0];
  }

  /**
   * Extract a simple identifier from an expression.
   * Returns the identifier name if the expression is a simple variable
   * reference with no postfix operators (member access, indexing).
   * Returns null for complex expressions.
   *
   * Use this for cases like:
   * - Checking if an expression is a specific variable
   * - Parameter lookup
   * - Simple variable references
   */
  static getSimpleIdentifier(ctx: Parser.ExpressionContext): string | null {
    const postfix = this.getPostfixExpression(ctx);
    if (!postfix) return null;

    const ops = postfix.postfixOp();
    // Must have no postfix operations (no member access, no indexing)
    if (ops.length !== 0) return null;

    const primary = postfix.primaryExpression();
    const id = primary.IDENTIFIER();
    return id ? id.getText() : null;
  }

  /**
   * Check if an expression is a simple identifier (variable reference).
   * Convenience method for boolean checks.
   */
  static isSimpleIdentifier(ctx: Parser.ExpressionContext): boolean {
    return this.getSimpleIdentifier(ctx) !== null;
  }
}

export default ExpressionUnwrapper;
