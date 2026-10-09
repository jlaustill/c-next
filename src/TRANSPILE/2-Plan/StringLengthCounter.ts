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

import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import type TExpression from "../../types/syntax/TExpression";
import type TExpressionOf from "../../types/syntax/TExpressionOf";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import type TranspileState from "../TranspileState";

/**
 * Counts .char_count accesses on string variables in an expression tree.
 * This enables strlen caching optimization.
 */
class StringLengthCounter {
  /**
   * Count .char_count accesses in an expression.
   */
  static countExpression(
    expr: TExpression,
    state: TranspileState,
  ): Map<string, number> {
    const counts = new Map<string, number>();
    StringLengthCounter.walkExpression(expr, counts, state);
    return counts;
  }

  /**
   * Count .char_count accesses in a block, adding to existing counts.
   */
  static countBlockInto(
    ctx: Parser.BlockContext,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    for (const stmt of ctx.statement()) {
      StringLengthCounter.walkStatement(stmt, counts, state);
    }
  }

  /**
   * Walk an expression, counting `.char_count` reads on string identifiers.
   * Only identifier-rooted chains count, and only their subscript indexes are
   * searched further; call arguments are not.
   */
  private static walkExpression(
    expr: TExpression,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    switch (expr.kind) {
      case "ternary":
        StringLengthCounter.walkExpression(expr.condition, counts, state);
        StringLengthCounter.walkExpression(expr.whenTrue, counts, state);
        StringLengthCounter.walkExpression(expr.whenFalse, counts, state);
        return;
      case "binary":
        for (const operand of expr.operands) {
          StringLengthCounter.walkExpression(operand, counts, state);
        }
        return;
      case "unary":
        StringLengthCounter.walkExpression(expr.operand, counts, state);
        return;
      case "parenthesized":
        StringLengthCounter.walkExpression(expr.expression, counts, state);
        return;
      case "postfix":
        StringLengthCounter.walkPostfix(expr, counts, state);
        return;
      default:
        return;
    }
  }

  /**
   * #1650: only `name.char_count` counts -- the length of the variable itself,
   * the operand the cache measures. `names[0].char_count` measures an element,
   * which a cache of `names` cannot serve.
   */
  private static walkPostfix(
    expr: TExpressionOf<"postfix">,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    const primary = expr.primary;
    if (primary.kind === "parenthesized") {
      StringLengthCounter.walkExpression(primary.expression, counts, state);
      return;
    }
    if (primary.kind !== "identifier") return;
    const [first] = expr.ops;
    if (first?.kind === "member" && first.name === "char_count") {
      StringLengthCounter.countLengthRead(primary.name, expr, counts, state);
    }
    for (const op of expr.ops) {
      if (op.kind === "subscript") {
        for (const index of op.indexes) {
          StringLengthCounter.walkExpression(index, counts, state);
        }
      }
    }
  }

  private static countLengthRead(
    name: string,
    expr: TExpression,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    const typeInfo = state.sourceDeclarationTypeInfo(null, name, {
      line: expr.span.line,
      column: expr.span.column,
    });
    if (typeInfo?.isString) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }

  /**
   * Walk a statement, counting .char_count accesses.
   */
  private static walkStatement(
    ctx: Parser.StatementContext,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    // Assignment statement
    if (ctx.assignmentStatement()) {
      const assign = ctx.assignmentStatement()!;
      // Count in target (array index expressions from postfix ops)
      const target = assign.assignmentTarget();
      for (const op of target.postfixTargetOp()) {
        for (const expr of op.expression()) {
          StringLengthCounter.walkExpression(
            SyntaxLowering.expression(expr),
            counts,
            state,
          );
        }
      }
      // Count in value expression
      StringLengthCounter.walkExpression(
        SyntaxLowering.expression(assign.expression()),
        counts,
        state,
      );
    }
    // Expression statement
    if (ctx.expressionStatement()) {
      StringLengthCounter.walkExpression(
        SyntaxLowering.expression(ctx.expressionStatement()!.expression()),
        counts,
        state,
      );
    }
    // Variable declaration
    if (ctx.variableDeclaration()) {
      const varDecl = ctx.variableDeclaration()!;
      if (varDecl.expression()) {
        StringLengthCounter.walkExpression(
          SyntaxLowering.expression(varDecl.expression()!),
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
