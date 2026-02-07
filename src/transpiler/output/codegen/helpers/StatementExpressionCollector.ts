/**
 * StatementExpressionCollector
 *
 * Collects all expressions from a statement context that need to be walked
 * for function calls and parameter modifications. This centralizes expression
 * extraction to prevent missing cases (like issue #565).
 *
 * Issue #566: Extracted from CodeGenerator for improved testability.
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";

class StatementExpressionCollector {
  /**
   * Collect all expressions from a statement that need to be walked for
   * function calls and modifications.
   *
   * Handles:
   * - Simple statements (expression, assignment, variable declaration, return)
   * - Control flow conditions (if, while, do-while, switch)
   * - For statement parts (init, condition, update)
   */
  static collectAll(stmt: Parser.StatementContext): Parser.ExpressionContext[] {
    const expressions: Parser.ExpressionContext[] = [];

    // Simple statements with expressions
    StatementExpressionCollector._collectSimpleStatementExprs(
      stmt,
      expressions,
    );

    // Control flow conditions
    StatementExpressionCollector._collectControlFlowExprs(stmt, expressions);

    // For statement has multiple expression contexts
    StatementExpressionCollector._collectForStatementExprs(stmt, expressions);

    return expressions;
  }

  /**
   * Collect expressions from simple statements (expression, assignment,
   * variable declaration, return).
   */
  private static _collectSimpleStatementExprs(
    stmt: Parser.StatementContext,
    expressions: Parser.ExpressionContext[],
  ): void {
    if (stmt.expressionStatement()) {
      expressions.push(stmt.expressionStatement()!.expression());
    }
    if (stmt.assignmentStatement()) {
      expressions.push(stmt.assignmentStatement()!.expression());
    }
    if (stmt.variableDeclaration()?.expression()) {
      expressions.push(stmt.variableDeclaration()!.expression()!);
    }
    if (stmt.returnStatement()?.expression()) {
      expressions.push(stmt.returnStatement()!.expression()!);
    }
  }

  /**
   * Collect expressions from control flow conditions (if, while, do-while, switch).
   */
  private static _collectControlFlowExprs(
    stmt: Parser.StatementContext,
    expressions: Parser.ExpressionContext[],
  ): void {
    if (stmt.ifStatement()) {
      expressions.push(stmt.ifStatement()!.expression());
    }
    if (stmt.whileStatement()) {
      expressions.push(stmt.whileStatement()!.expression());
    }
    if (stmt.doWhileStatement()) {
      expressions.push(stmt.doWhileStatement()!.expression());
    }
    if (stmt.switchStatement()) {
      expressions.push(stmt.switchStatement()!.expression());
    }
  }

  /**
   * Collect expressions from for statement parts (init, condition, update).
   */
  private static _collectForStatementExprs(
    stmt: Parser.StatementContext,
    expressions: Parser.ExpressionContext[],
  ): void {
    if (!stmt.forStatement()) {
      return;
    }

    const forStmt = stmt.forStatement()!;

    // Condition (optional)
    if (forStmt.expression()) {
      expressions.push(forStmt.expression()!);
    }

    // forInit expressions
    const forInit = forStmt.forInit();
    if (forInit?.forAssignment()) {
      expressions.push(forInit.forAssignment()!.expression());
    } else if (forInit?.forVarDecl()?.expression()) {
      expressions.push(forInit.forVarDecl()!.expression()!);
    }

    // forUpdate expression
    if (forStmt.forUpdate()) {
      expressions.push(forStmt.forUpdate()!.expression());
    }
  }
}

export default StatementExpressionCollector;
