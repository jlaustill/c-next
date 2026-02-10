/**
 * StringLengthCounter - Counts .length accesses on string variables
 *
 * Issue #644: Extracted from CodeGenerator to reduce code duplication.
 * Used for strlen caching optimization - when a string's .length is accessed
 * multiple times, we cache the strlen result in a temp variable.
 *
 * Migrated to use CodeGenState instead of constructor DI.
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser";
import CodeGenState from "../CodeGenState";

/**
 * Counts .length accesses on string variables in an expression tree.
 * This enables strlen caching optimization.
 */
class StringLengthCounter {
  /**
   * Count .length accesses in an expression.
   */
  static countExpression(ctx: Parser.ExpressionContext): Map<string, number> {
    const counts = new Map<string, number>();
    StringLengthCounter.walkExpression(ctx, counts);
    return counts;
  }

  /**
   * Count .length accesses in a block.
   */
  static countBlock(ctx: Parser.BlockContext): Map<string, number> {
    const counts = new Map<string, number>();
    for (const stmt of ctx.statement()) {
      StringLengthCounter.walkStatement(stmt, counts);
    }
    return counts;
  }

  /**
   * Count .length accesses in a block, adding to existing counts.
   */
  static countBlockInto(
    ctx: Parser.BlockContext,
    counts: Map<string, number>,
  ): void {
    for (const stmt of ctx.statement()) {
      StringLengthCounter.walkStatement(stmt, counts);
    }
  }

  /**
   * Walk an expression tree, counting .length accesses.
   * Uses generic traversal - only postfix expressions need special handling.
   */
  private static walkExpression(
    ctx: Parser.ExpressionContext,
    counts: Map<string, number>,
  ): void {
    const ternary = ctx.ternaryExpression();
    if (ternary) {
      StringLengthCounter.walkTernary(ternary, counts);
    }
  }

  private static walkTernary(
    ctx: Parser.TernaryExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const orExpr of ctx.orExpression()) {
      StringLengthCounter.walkOrExpr(orExpr, counts);
    }
  }

  private static walkOrExpr(
    ctx: Parser.OrExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const andExpr of ctx.andExpression()) {
      StringLengthCounter.walkAndExpr(andExpr, counts);
    }
  }

  private static walkAndExpr(
    ctx: Parser.AndExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const eqExpr of ctx.equalityExpression()) {
      StringLengthCounter.walkEqualityExpr(eqExpr, counts);
    }
  }

  private static walkEqualityExpr(
    ctx: Parser.EqualityExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const relExpr of ctx.relationalExpression()) {
      StringLengthCounter.walkRelationalExpr(relExpr, counts);
    }
  }

  private static walkRelationalExpr(
    ctx: Parser.RelationalExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const borExpr of ctx.bitwiseOrExpression()) {
      StringLengthCounter.walkBitwiseOrExpr(borExpr, counts);
    }
  }

  private static walkBitwiseOrExpr(
    ctx: Parser.BitwiseOrExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const bxorExpr of ctx.bitwiseXorExpression()) {
      StringLengthCounter.walkBitwiseXorExpr(bxorExpr, counts);
    }
  }

  private static walkBitwiseXorExpr(
    ctx: Parser.BitwiseXorExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const bandExpr of ctx.bitwiseAndExpression()) {
      StringLengthCounter.walkBitwiseAndExpr(bandExpr, counts);
    }
  }

  private static walkBitwiseAndExpr(
    ctx: Parser.BitwiseAndExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const shiftExpr of ctx.shiftExpression()) {
      StringLengthCounter.walkShiftExpr(shiftExpr, counts);
    }
  }

  private static walkShiftExpr(
    ctx: Parser.ShiftExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const addExpr of ctx.additiveExpression()) {
      StringLengthCounter.walkAdditiveExpr(addExpr, counts);
    }
  }

  private static walkAdditiveExpr(
    ctx: Parser.AdditiveExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const multExpr of ctx.multiplicativeExpression()) {
      StringLengthCounter.walkMultiplicativeExpr(multExpr, counts);
    }
  }

  private static walkMultiplicativeExpr(
    ctx: Parser.MultiplicativeExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const unaryExpr of ctx.unaryExpression()) {
      StringLengthCounter.walkUnaryExpr(unaryExpr, counts);
    }
  }

  private static walkUnaryExpr(
    ctx: Parser.UnaryExpressionContext,
    counts: Map<string, number>,
  ): void {
    const postfix = ctx.postfixExpression();
    if (postfix) {
      StringLengthCounter.walkPostfixExpr(postfix, counts);
    }
    // Also check nested unary expressions
    const nestedUnary = ctx.unaryExpression();
    if (nestedUnary) {
      StringLengthCounter.walkUnaryExpr(nestedUnary, counts);
    }
  }

  /**
   * Walk a postfix expression - this is where we detect .length accesses.
   */
  private static walkPostfixExpr(
    ctx: Parser.PostfixExpressionContext,
    counts: Map<string, number>,
  ): void {
    const primary = ctx.primaryExpression();
    const primaryId = primary.IDENTIFIER()?.getText();
    const ops = ctx.postfixOp();

    // Check for pattern: identifier.length where identifier is a string
    if (primaryId && ops.length > 0) {
      for (const op of ops) {
        const memberName = op.IDENTIFIER()?.getText();
        if (memberName === "length") {
          // Check if this is a string type
          const typeInfo = CodeGenState.typeRegistry.get(primaryId);
          if (typeInfo?.isString) {
            const currentCount = counts.get(primaryId) || 0;
            counts.set(primaryId, currentCount + 1);
          }
        }
        // Walk any nested expressions in array accesses or function calls
        for (const expr of op.expression()) {
          StringLengthCounter.walkExpression(expr, counts);
        }
      }
    }

    // Walk nested expression in primary if present
    if (primary.expression()) {
      StringLengthCounter.walkExpression(primary.expression()!, counts);
    }
  }

  /**
   * Walk a statement, counting .length accesses.
   */
  private static walkStatement(
    ctx: Parser.StatementContext,
    counts: Map<string, number>,
  ): void {
    // Assignment statement
    if (ctx.assignmentStatement()) {
      const assign = ctx.assignmentStatement()!;
      // Count in target (array index expressions from postfix ops)
      const target = assign.assignmentTarget();
      for (const op of target.postfixTargetOp()) {
        for (const expr of op.expression()) {
          StringLengthCounter.walkExpression(expr, counts);
        }
      }
      // Count in value expression
      StringLengthCounter.walkExpression(assign.expression(), counts);
    }
    // Expression statement
    if (ctx.expressionStatement()) {
      StringLengthCounter.walkExpression(
        ctx.expressionStatement()!.expression(),
        counts,
      );
    }
    // Variable declaration
    if (ctx.variableDeclaration()) {
      const varDecl = ctx.variableDeclaration()!;
      if (varDecl.expression()) {
        StringLengthCounter.walkExpression(varDecl.expression()!, counts);
      }
    }
    // Nested block
    if (ctx.block()) {
      StringLengthCounter.countBlockInto(ctx.block()!, counts);
    }
    // Note: Could add recursion for if/while/for bodies if deeper analysis needed
  }
}

export default StringLengthCounter;
