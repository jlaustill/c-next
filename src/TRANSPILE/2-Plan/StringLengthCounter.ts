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

import type TExpression from "../../types/syntax/TExpression";
import type TExpressionOf from "../../types/syntax/TExpressionOf";
import type TBlockSyntax from "../../types/syntax/TBlockSyntax";
import type TStatement from "../../types/syntax/TStatement";
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
    block: Pick<TBlockSyntax, "statements">,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    for (const stmt of block.statements) {
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

  /** The index expressions an assignment target subscripts with */
  private static walkTargetIndexes(
    target: TExpression,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    if (target.kind !== "postfix") {
      return;
    }
    for (const op of target.ops) {
      if (op.kind === "subscript") {
        for (const index of op.indexes) {
          StringLengthCounter.walkExpression(index, counts, state);
        }
      }
    }
  }

  /**
   * Walk a statement, counting .char_count accesses.
   */
  private static walkStatement(
    statement: TStatement,
    counts: Map<string, number>,
    state: TranspileState,
  ): void {
    switch (statement.kind) {
      case "assignment":
        StringLengthCounter.walkTargetIndexes(statement.target, counts, state);
        StringLengthCounter.walkExpression(statement.value, counts, state);
        return;
      case "expression":
        StringLengthCounter.walkExpression(statement.expression, counts, state);
        return;
      case "variableDeclaration":
        if (statement.initializer) {
          StringLengthCounter.walkExpression(
            statement.initializer,
            counts,
            state,
          );
        }
        return;
      case "block":
        StringLengthCounter.countBlockInto(statement, counts, state);
        return;
      default:
        return;
    }
  }
}

export default StringLengthCounter;
