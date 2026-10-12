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

import * as Parser from "../PARSE/2-Parse/grammar/CNextParser";

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
    const rel = this.navigateToRelational(ctx);
    return rel ? this.relationalToShift(rel) : null;
  }

  /**
   * Navigate from ExpressionContext to RelationalExpressionContext.
   *
   * Returns null if expression has multiple terms at any level above relational.
   */
  private static navigateToRelational(
    ctx: Parser.ExpressionContext,
  ): Parser.RelationalExpressionContext | null {
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

    return eq.relationalExpression()[0];
  }

  /**
   * Navigate from RelationalExpressionContext to ShiftExpressionContext.
   *
   * The walk is split here because a condition leaf -- what is left once
   * `||`, `&&`, `=` and `!=` are decomposed -- is a relational with no
   * ExpressionContext of its own (#1195).
   */
  private static relationalToShift(
    rel: Parser.RelationalExpressionContext,
  ): Parser.ShiftExpressionContext | null {
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
   *
   * Returns null if shift has multiple terms at any level below it.
   */
  private static shiftToUnary(
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
   * Navigate from ExpressionContext to UnaryExpressionContext.
   * Common helper for getPostfixExpression and getUnaryExpression.
   *
   * Returns null if expression has multiple terms at any level.
   */
  private static navigateToUnary(
    ctx: Parser.ExpressionContext,
  ): Parser.UnaryExpressionContext | null {
    const shift = this.navigateToShift(ctx);
    return shift ? this.shiftToUnary(shift) : null;
  }

  /**
   * The expression a bracketed group holds, when a relational is nothing but
   * that one group; otherwise null.
   *
   * A bare group is judged by what it holds (#1195), and both E0701 and E0707
   * ask this one function, so they cannot disagree about which groups unwrap.
   * Only a bare group does: an operator outside the brackets, a prefix such as
   * `!(...)` or a postfix such as `(...)[0]` makes the group one operand.
   */
  static bracketedInner(
    rel: Parser.RelationalExpressionContext,
  ): Parser.ExpressionContext | null {
    const unary = this.leafUnary(rel);
    return unary ? this.unaryGroup(unary) : null;
  }

  /**
   * The unary a relational is, when it is a single term at every level below
   * it; otherwise null. A prefix such as `!` is still one unary, so a caller
   * can look past it (#1195 review: the help for `!(n < 5)`).
   */
  static leafUnary(
    rel: Parser.RelationalExpressionContext,
  ): Parser.UnaryExpressionContext | null {
    const shift = this.relationalToShift(rel);
    return shift ? this.shiftToUnary(shift) : null;
  }

  /**
   * What a unary's bare bracketed group holds -- no prefix and no postfix
   * around it -- or null.
   */
  static unaryGroup(
    unary: Parser.UnaryExpressionContext,
  ): Parser.ExpressionContext | null {
    const postfix = unary.postfixExpression();
    if (postfix?.postfixOp().length !== 0) return null;
    return postfix.primaryExpression().expression();
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
    const unary = this.navigateToUnary(ctx);
    if (!unary?.postfixExpression()) return null;
    return unary.postfixExpression()!;
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
}

export default ExpressionUnwrapper;
