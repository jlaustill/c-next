/**
 * Utility class for traversing expression trees in the parse tree.
 *
 * C-Next's expression grammar is deeply nested:
 *   expression -> ternaryExpression -> orExpression -> andExpression ->
 *   equalityExpression -> relationalExpression -> bitwiseOrExpression ->
 *   bitwiseXorExpression -> bitwiseAndExpression -> shiftExpression ->
 *   additiveExpression -> multiplicativeExpression -> unaryExpression ->
 *   postfixExpression -> primaryExpression -> literal/identifier
 *
 * This utility extracts common traversal patterns used by multiple analyzers.
 */

import * as Parser from "../transpiler/logic/parser/grammar/CNextParser";

/**
 * Static utility methods for expression tree traversal
 */
class ExpressionUtils {
  /**
   * Extract the literal from a simple expression (if it's just a literal).
   *
   * Returns null if the expression is complex (has operators, function calls, etc.)
   * Only returns a value if the expression resolves to a single literal.
   *
   * @param ctx - The expression context from the parse tree
   * @returns The literal context, or null if not a simple literal expression
   */
  static extractLiteral(
    ctx: Parser.ExpressionContext,
  ): Parser.LiteralContext | null {
    const primary = ExpressionUtils.extractPrimaryExpression(ctx);
    if (!primary) return null;

    return primary.literal() ?? null;
  }

  /**
   * Extract the primary expression from an expression (if it's simple).
   *
   * Returns null if the expression is complex (has operators, function calls, etc.)
   *
   * @param ctx - The expression context from the parse tree
   * @returns The primary expression context, or null if complex
   */
  static extractPrimaryExpression(
    ctx: Parser.ExpressionContext,
  ): Parser.PrimaryExpressionContext | null {
    const unary = ExpressionUtils.extractUnaryExpression(ctx);
    if (!unary) return null;

    const postfix = unary.postfixExpression();
    if (!postfix) return null;

    // If there are postfix operations (array access, member access, function call),
    // this is not a simple primary expression
    const postfixOps = postfix.postfixOp();
    if (postfixOps && postfixOps.length > 0) {
      return null;
    }

    return postfix.primaryExpression() ?? null;
  }

  /**
   * Extract the unary expression from an expression (if it's simple).
   *
   * Returns null if the expression has binary operators at any level.
   *
   * @param ctx - The expression context from the parse tree
   * @returns The unary expression context, or null if complex
   */
  static extractUnaryExpression(
    ctx: Parser.ExpressionContext,
  ): Parser.UnaryExpressionContext | null {
    // expression -> ternaryExpression
    const ternary = ctx.ternaryExpression();
    if (!ternary) return null;

    // ternaryExpression has multiple orExpressions if it's a ternary (condition ? a : b)
    const orExprs = ternary.orExpression();
    if (orExprs?.length !== 1) return null;

    // orExpression -> andExpression (multiple = has || operator)
    const andExprs = orExprs[0].andExpression();
    if (andExprs?.length !== 1) return null;

    // andExpression -> equalityExpression (multiple = has && operator)
    const eqExprs = andExprs[0].equalityExpression();
    if (eqExprs?.length !== 1) return null;

    // equalityExpression -> relationalExpression (multiple = has = or != operator)
    const relExprs = eqExprs[0].relationalExpression();
    if (relExprs?.length !== 1) return null;

    // relationalExpression -> bitwiseOrExpression (multiple = has <, >, <=, >= operator)
    const bitorExprs = relExprs[0].bitwiseOrExpression();
    if (bitorExprs?.length !== 1) return null;

    // bitwiseOrExpression -> bitwiseXorExpression (multiple = has | operator)
    const bitxorExprs = bitorExprs[0].bitwiseXorExpression();
    if (bitxorExprs?.length !== 1) return null;

    // bitwiseXorExpression -> bitwiseAndExpression (multiple = has ^ operator)
    const bitandExprs = bitxorExprs[0].bitwiseAndExpression();
    if (bitandExprs?.length !== 1) return null;

    // bitwiseAndExpression -> shiftExpression (multiple = has & operator)
    const shiftExprs = bitandExprs[0].shiftExpression();
    if (shiftExprs?.length !== 1) return null;

    // shiftExpression -> additiveExpression (multiple = has << or >> operator)
    const addExprs = shiftExprs[0].additiveExpression();
    if (addExprs?.length !== 1) return null;

    // additiveExpression -> multiplicativeExpression (multiple = has + or - operator)
    const multExprs = addExprs[0].multiplicativeExpression();
    if (multExprs?.length !== 1) return null;

    // multiplicativeExpression -> unaryExpression (multiple = has *, /, % operator)
    const unaryExprs = multExprs[0].unaryExpression();
    if (unaryExprs?.length !== 1) return null;

    return unaryExprs[0];
  }

  /**
   * Extract the identifier from a simple expression (if it's just an identifier).
   *
   * Returns null if the expression is complex or not a simple identifier.
   *
   * @param ctx - The expression context from the parse tree
   * @returns The identifier text, or null if not a simple identifier expression
   */
  static extractIdentifier(ctx: Parser.ExpressionContext): string | null {
    const primary = ExpressionUtils.extractPrimaryExpression(ctx);
    if (!primary) return null;

    const identifier = primary.IDENTIFIER();
    return identifier?.getText() ?? null;
  }

  /**
   * ADR-023: Check if an expression contains a function call anywhere in its tree.
   *
   * This traverses the full expression hierarchy to find any postfix expression
   * with an argument list (function call syntax).
   *
   * @param ctx - The expression context to check
   * @returns true if a function call is found anywhere in the expression
   */
  static hasFunctionCall(ctx: Parser.ExpressionContext): boolean {
    const ternary = ctx.ternaryExpression();
    if (!ternary) return false;

    for (const or of ternary.orExpression()) {
      if (ExpressionUtils.hasFunctionCallInOr(or)) return true;
    }
    return false;
  }

  // Private helper methods for tree traversal - each has low cognitive complexity

  private static hasFunctionCallInOr(ctx: Parser.OrExpressionContext): boolean {
    for (const and of ctx.andExpression()) {
      if (ExpressionUtils.hasFunctionCallInAnd(and)) return true;
    }
    return false;
  }

  private static hasFunctionCallInAnd(
    ctx: Parser.AndExpressionContext,
  ): boolean {
    for (const eq of ctx.equalityExpression()) {
      if (ExpressionUtils.hasFunctionCallInEquality(eq)) return true;
    }
    return false;
  }

  private static hasFunctionCallInEquality(
    ctx: Parser.EqualityExpressionContext,
  ): boolean {
    for (const rel of ctx.relationalExpression()) {
      if (ExpressionUtils.hasFunctionCallInRelational(rel)) return true;
    }
    return false;
  }

  private static hasFunctionCallInRelational(
    ctx: Parser.RelationalExpressionContext,
  ): boolean {
    for (const bor of ctx.bitwiseOrExpression()) {
      if (ExpressionUtils.hasFunctionCallInBitwiseOr(bor)) return true;
    }
    return false;
  }

  private static hasFunctionCallInBitwiseOr(
    ctx: Parser.BitwiseOrExpressionContext,
  ): boolean {
    for (const bxor of ctx.bitwiseXorExpression()) {
      if (ExpressionUtils.hasFunctionCallInBitwiseXor(bxor)) return true;
    }
    return false;
  }

  private static hasFunctionCallInBitwiseXor(
    ctx: Parser.BitwiseXorExpressionContext,
  ): boolean {
    for (const band of ctx.bitwiseAndExpression()) {
      if (ExpressionUtils.hasFunctionCallInBitwiseAnd(band)) return true;
    }
    return false;
  }

  private static hasFunctionCallInBitwiseAnd(
    ctx: Parser.BitwiseAndExpressionContext,
  ): boolean {
    for (const shift of ctx.shiftExpression()) {
      if (ExpressionUtils.hasFunctionCallInShift(shift)) return true;
    }
    return false;
  }

  private static hasFunctionCallInShift(
    ctx: Parser.ShiftExpressionContext,
  ): boolean {
    for (const add of ctx.additiveExpression()) {
      if (ExpressionUtils.hasFunctionCallInAdditive(add)) return true;
    }
    return false;
  }

  private static hasFunctionCallInAdditive(
    ctx: Parser.AdditiveExpressionContext,
  ): boolean {
    for (const mult of ctx.multiplicativeExpression()) {
      if (ExpressionUtils.hasFunctionCallInMultiplicative(mult)) return true;
    }
    return false;
  }

  private static hasFunctionCallInMultiplicative(
    ctx: Parser.MultiplicativeExpressionContext,
  ): boolean {
    for (const unary of ctx.unaryExpression()) {
      if (ExpressionUtils.hasFunctionCallInUnary(unary)) return true;
    }
    return false;
  }

  private static hasFunctionCallInUnary(
    ctx: Parser.UnaryExpressionContext,
  ): boolean {
    const postfix = ctx.postfixExpression();
    if (!postfix) return false;

    for (const op of postfix.postfixOp()) {
      if (op.argumentList() || op.getText().startsWith("(")) {
        return true;
      }
    }
    return false;
  }
}

export default ExpressionUtils;
