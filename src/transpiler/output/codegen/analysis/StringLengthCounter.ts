/**
 * StringLengthCounter - Counts .length accesses on string variables
 *
 * Issue #644: Extracted from CodeGenerator to reduce code duplication.
 * Used for strlen caching optimization - when a string's .length is accessed
 * multiple times, we cache the strlen result in a temp variable.
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser";
import TTypeInfo from "../types/TTypeInfo";

/**
 * Type registry lookup function signature.
 */
type TypeRegistryLookup = (name: string) => TTypeInfo | undefined;

/**
 * Counts .length accesses on string variables in an expression tree.
 * This enables strlen caching optimization.
 */
class StringLengthCounter {
  private readonly typeRegistry: TypeRegistryLookup;

  constructor(typeRegistry: TypeRegistryLookup) {
    this.typeRegistry = typeRegistry;
  }

  /**
   * Count .length accesses in an expression.
   */
  countExpression(ctx: Parser.ExpressionContext): Map<string, number> {
    const counts = new Map<string, number>();
    this.walkExpression(ctx, counts);
    return counts;
  }

  /**
   * Count .length accesses in a block.
   */
  countBlock(ctx: Parser.BlockContext): Map<string, number> {
    const counts = new Map<string, number>();
    for (const stmt of ctx.statement()) {
      this.walkStatement(stmt, counts);
    }
    return counts;
  }

  /**
   * Count .length accesses in a block, adding to existing counts.
   */
  countBlockInto(ctx: Parser.BlockContext, counts: Map<string, number>): void {
    for (const stmt of ctx.statement()) {
      this.walkStatement(stmt, counts);
    }
  }

  /**
   * Walk an expression tree, counting .length accesses.
   * Uses generic traversal - only postfix expressions need special handling.
   */
  private walkExpression(
    ctx: Parser.ExpressionContext,
    counts: Map<string, number>,
  ): void {
    const ternary = ctx.ternaryExpression();
    if (ternary) {
      this.walkTernary(ternary, counts);
    }
  }

  private walkTernary(
    ctx: Parser.TernaryExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const orExpr of ctx.orExpression()) {
      this.walkOrExpr(orExpr, counts);
    }
  }

  private walkOrExpr(
    ctx: Parser.OrExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const andExpr of ctx.andExpression()) {
      this.walkAndExpr(andExpr, counts);
    }
  }

  private walkAndExpr(
    ctx: Parser.AndExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const eqExpr of ctx.equalityExpression()) {
      this.walkEqualityExpr(eqExpr, counts);
    }
  }

  private walkEqualityExpr(
    ctx: Parser.EqualityExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const relExpr of ctx.relationalExpression()) {
      this.walkRelationalExpr(relExpr, counts);
    }
  }

  private walkRelationalExpr(
    ctx: Parser.RelationalExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const borExpr of ctx.bitwiseOrExpression()) {
      this.walkBitwiseOrExpr(borExpr, counts);
    }
  }

  private walkBitwiseOrExpr(
    ctx: Parser.BitwiseOrExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const bxorExpr of ctx.bitwiseXorExpression()) {
      this.walkBitwiseXorExpr(bxorExpr, counts);
    }
  }

  private walkBitwiseXorExpr(
    ctx: Parser.BitwiseXorExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const bandExpr of ctx.bitwiseAndExpression()) {
      this.walkBitwiseAndExpr(bandExpr, counts);
    }
  }

  private walkBitwiseAndExpr(
    ctx: Parser.BitwiseAndExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const shiftExpr of ctx.shiftExpression()) {
      this.walkShiftExpr(shiftExpr, counts);
    }
  }

  private walkShiftExpr(
    ctx: Parser.ShiftExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const addExpr of ctx.additiveExpression()) {
      this.walkAdditiveExpr(addExpr, counts);
    }
  }

  private walkAdditiveExpr(
    ctx: Parser.AdditiveExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const multExpr of ctx.multiplicativeExpression()) {
      this.walkMultiplicativeExpr(multExpr, counts);
    }
  }

  private walkMultiplicativeExpr(
    ctx: Parser.MultiplicativeExpressionContext,
    counts: Map<string, number>,
  ): void {
    for (const unaryExpr of ctx.unaryExpression()) {
      this.walkUnaryExpr(unaryExpr, counts);
    }
  }

  private walkUnaryExpr(
    ctx: Parser.UnaryExpressionContext,
    counts: Map<string, number>,
  ): void {
    const postfix = ctx.postfixExpression();
    if (postfix) {
      this.walkPostfixExpr(postfix, counts);
    }
    // Also check nested unary expressions
    const nestedUnary = ctx.unaryExpression();
    if (nestedUnary) {
      this.walkUnaryExpr(nestedUnary, counts);
    }
  }

  /**
   * Walk a postfix expression - this is where we detect .length accesses.
   */
  private walkPostfixExpr(
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
          const typeInfo = this.typeRegistry(primaryId);
          if (typeInfo?.isString) {
            const currentCount = counts.get(primaryId) || 0;
            counts.set(primaryId, currentCount + 1);
          }
        }
        // Walk any nested expressions in array accesses or function calls
        for (const expr of op.expression()) {
          this.walkExpression(expr, counts);
        }
      }
    }

    // Walk nested expression in primary if present
    if (primary.expression()) {
      this.walkExpression(primary.expression()!, counts);
    }
  }

  /**
   * Walk a statement, counting .length accesses.
   */
  private walkStatement(
    ctx: Parser.StatementContext,
    counts: Map<string, number>,
  ): void {
    // Assignment statement
    if (ctx.assignmentStatement()) {
      const assign = ctx.assignmentStatement()!;
      // Count in target (array index expressions)
      const target = assign.assignmentTarget();
      if (target.arrayAccess()) {
        for (const expr of target.arrayAccess()!.expression()) {
          this.walkExpression(expr, counts);
        }
      }
      // Count in value expression
      this.walkExpression(assign.expression(), counts);
    }
    // Expression statement
    if (ctx.expressionStatement()) {
      this.walkExpression(ctx.expressionStatement()!.expression(), counts);
    }
    // Variable declaration
    if (ctx.variableDeclaration()) {
      const varDecl = ctx.variableDeclaration()!;
      if (varDecl.expression()) {
        this.walkExpression(varDecl.expression()!, counts);
      }
    }
    // Nested block
    if (ctx.block()) {
      this.countBlockInto(ctx.block()!, counts);
    }
    // Note: Could add recursion for if/while/for bodies if deeper analysis needed
  }
}

export default StringLengthCounter;
