/**
 * StringLengthCounter - Counts .char_count accesses on string variables
 *
 * Issue #644: Extracted from CodeGenerator to reduce code duplication.
 * Used for strlen caching optimization - when a string's .char_count is accessed
 * multiple times, we cache the strlen result in a temp variable.
 *
 * Migrated to use CodeGenState instead of constructor DI.
 * Updated for ADR-058: .length replaced with .char_count
 */

import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import type RenderState from "../3-Render/RenderState";

/**
 * Counts .char_count accesses on string variables in an expression tree.
 * This enables strlen caching optimization.
 */
class StringLengthCounter {
  /**
   * Count .char_count accesses in an expression.
   */
  static countExpression(
    ctx: Parser.ExpressionContext,
    state: RenderState,
  ): Map<string, number> {
    const counts = new Map<string, number>();
    StringLengthCounter.walkExpression(ctx, counts, state);
    return counts;
  }

  /**
   * Count .char_count accesses in a block.
   */
  static countBlock(
    ctx: Parser.BlockContext,
    state: RenderState,
  ): Map<string, number> {
    const counts = new Map<string, number>();
    for (const stmt of ctx.statement()) {
      StringLengthCounter.walkStatement(stmt, counts, state);
    }
    return counts;
  }

  /**
   * Count .char_count accesses in a block, adding to existing counts.
   */
  static countBlockInto(
    ctx: Parser.BlockContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    for (const stmt of ctx.statement()) {
      StringLengthCounter.walkStatement(stmt, counts, state);
    }
  }

  /**
   * Walk an expression tree, counting .char_count accesses.
   * Uses generic traversal - only postfix expressions need special handling.
   */
  private static walkExpression(
    ctx: Parser.ExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    const ternary = ctx.ternaryExpression();
    if (ternary) {
      StringLengthCounter.walkTernary(ternary, counts, state);
    }
  }

  private static walkTernary(
    ctx: Parser.TernaryExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    for (const orExpr of ctx.orExpression()) {
      StringLengthCounter.walkOrExpr(orExpr, counts, state);
    }
  }

  private static walkOrExpr(
    ctx: Parser.OrExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    for (const andExpr of ctx.andExpression()) {
      StringLengthCounter.walkAndExpr(andExpr, counts, state);
    }
  }

  private static walkAndExpr(
    ctx: Parser.AndExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    for (const eqExpr of ctx.equalityExpression()) {
      StringLengthCounter.walkEqualityExpr(eqExpr, counts, state);
    }
  }

  private static walkEqualityExpr(
    ctx: Parser.EqualityExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    for (const relExpr of ctx.relationalExpression()) {
      StringLengthCounter.walkRelationalExpr(relExpr, counts, state);
    }
  }

  private static walkRelationalExpr(
    ctx: Parser.RelationalExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    for (const borExpr of ctx.bitwiseOrExpression()) {
      StringLengthCounter.walkBitwiseOrExpr(borExpr, counts, state);
    }
  }

  private static walkBitwiseOrExpr(
    ctx: Parser.BitwiseOrExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    for (const bxorExpr of ctx.bitwiseXorExpression()) {
      StringLengthCounter.walkBitwiseXorExpr(bxorExpr, counts, state);
    }
  }

  private static walkBitwiseXorExpr(
    ctx: Parser.BitwiseXorExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    for (const bandExpr of ctx.bitwiseAndExpression()) {
      StringLengthCounter.walkBitwiseAndExpr(bandExpr, counts, state);
    }
  }

  private static walkBitwiseAndExpr(
    ctx: Parser.BitwiseAndExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    for (const shiftExpr of ctx.shiftExpression()) {
      StringLengthCounter.walkShiftExpr(shiftExpr, counts, state);
    }
  }

  private static walkShiftExpr(
    ctx: Parser.ShiftExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    for (const addExpr of ctx.additiveExpression()) {
      StringLengthCounter.walkAdditiveExpr(addExpr, counts, state);
    }
  }

  private static walkAdditiveExpr(
    ctx: Parser.AdditiveExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    for (const multExpr of ctx.multiplicativeExpression()) {
      StringLengthCounter.walkMultiplicativeExpr(multExpr, counts, state);
    }
  }

  private static walkMultiplicativeExpr(
    ctx: Parser.MultiplicativeExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    for (const unaryExpr of ctx.unaryExpression()) {
      StringLengthCounter.walkUnaryExpr(unaryExpr, counts, state);
    }
  }

  private static walkUnaryExpr(
    ctx: Parser.UnaryExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    const postfix = ctx.postfixExpression();
    if (postfix) {
      StringLengthCounter.walkPostfixExpr(postfix, counts, state);
    }
    // Also check nested unary expressions
    const nestedUnary = ctx.unaryExpression();
    if (nestedUnary) {
      StringLengthCounter.walkUnaryExpr(nestedUnary, counts, state);
    }
  }

  /**
   * Walk a postfix expression - this is where we detect .char_count accesses.
   */
  private static walkPostfixExpr(
    ctx: Parser.PostfixExpressionContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    const primary = ctx.primaryExpression();
    const primaryId = primary.IDENTIFIER()?.getText();
    const ops = ctx.postfixOp();

    // Check for pattern: identifier.char_count where identifier is a string
    if (primaryId && ops.length > 0) {
      for (const op of ops) {
        const memberName = op.IDENTIFIER()?.getText();
        if (memberName === "char_count") {
          // Check if this is a string type
          const typeInfo = state.getVariableTypeInfo(primaryId);
          if (typeInfo?.isString) {
            const currentCount = counts.get(primaryId) || 0;
            counts.set(primaryId, currentCount + 1);
          }
        }
        // Walk any nested expressions in array accesses or function calls
        for (const expr of op.expression()) {
          StringLengthCounter.walkExpression(expr, counts, state);
        }
      }
    }

    // Walk nested expression in primary if present
    if (primary.expression()) {
      StringLengthCounter.walkExpression(primary.expression()!, counts, state);
    }
  }

  /**
   * Walk a statement, counting .char_count accesses.
   */
  private static walkStatement(
    ctx: Parser.StatementContext,
    counts: Map<string, number>,
    state: RenderState,
  ): void {
    // Assignment statement
    if (ctx.assignmentStatement()) {
      const assign = ctx.assignmentStatement()!;
      // Count in target (array index expressions from postfix ops)
      const target = assign.assignmentTarget();
      for (const op of target.postfixTargetOp()) {
        for (const expr of op.expression()) {
          StringLengthCounter.walkExpression(expr, counts, state);
        }
      }
      // Count in value expression
      StringLengthCounter.walkExpression(assign.expression(), counts, state);
    }
    // Expression statement
    if (ctx.expressionStatement()) {
      StringLengthCounter.walkExpression(
        ctx.expressionStatement()!.expression(),
        counts,
        state,
      );
    }
    // Variable declaration
    if (ctx.variableDeclaration()) {
      const varDecl = ctx.variableDeclaration()!;
      if (varDecl.expression()) {
        StringLengthCounter.walkExpression(
          varDecl.expression()!,
          counts,
          state,
        );
      }
    }
    // Nested block
    if (ctx.block()) {
      StringLengthCounter.countBlockInto(ctx.block()!, counts, state);
    }
    // Note: Could add recursion for if/while/for bodies if deeper analysis needed
  }
}

export default StringLengthCounter;
