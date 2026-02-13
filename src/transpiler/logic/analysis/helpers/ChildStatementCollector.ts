/**
 * ChildStatementCollector
 *
 * Collects child statements and blocks from control flow statements.
 * This centralizes recursion patterns to prevent missing nested statements.
 *
 * Issue #566: Extracted from CodeGenerator for improved testability.
 */

import * as Parser from "../../parser/grammar/CNextParser.js";

/**
 * Result of collecting child statements and blocks from a statement.
 */
interface IChildStatementResult {
  statements: Parser.StatementContext[];
  blocks: Parser.BlockContext[];
}

class ChildStatementCollector {
  /**
   * Collect all child statements and blocks from a control flow statement.
   * Handles if, while, for, do-while, switch, critical, and nested blocks.
   */
  static collectAll(stmt: Parser.StatementContext): IChildStatementResult {
    const statements: Parser.StatementContext[] = [];
    const blocks: Parser.BlockContext[] = [];

    // if statement: has statement() children (can be blocks or single statements)
    if (stmt.ifStatement()) {
      for (const childStmt of stmt.ifStatement()!.statement()) {
        ChildStatementCollector._classifyChildStatement(
          childStmt,
          statements,
          blocks,
        );
      }
    }

    // while statement: single statement() child
    if (stmt.whileStatement()) {
      ChildStatementCollector._classifyChildStatement(
        stmt.whileStatement()!.statement(),
        statements,
        blocks,
      );
    }

    // for statement: single statement() child
    if (stmt.forStatement()) {
      ChildStatementCollector._classifyChildStatement(
        stmt.forStatement()!.statement(),
        statements,
        blocks,
      );
    }

    // do-while statement: has block() directly
    if (stmt.doWhileStatement()) {
      blocks.push(stmt.doWhileStatement()!.block());
    }

    // switch statement: case blocks and optional default block
    if (stmt.switchStatement()) {
      ChildStatementCollector._collectSwitchChildren(
        stmt.switchStatement()!,
        blocks,
      );
    }

    // critical statement: has block() directly (ADR-050)
    if (stmt.criticalStatement()) {
      blocks.push(stmt.criticalStatement()!.block());
    }

    // Nested block statement
    if (stmt.block()) {
      blocks.push(stmt.block()!);
    }

    return { statements, blocks };
  }

  /**
   * Classify a child statement as block or single statement.
   * Blocks are pushed to the blocks array, statements to the statements array.
   */
  private static _classifyChildStatement(
    childStmt: Parser.StatementContext,
    statements: Parser.StatementContext[],
    blocks: Parser.BlockContext[],
  ): void {
    if (childStmt.block()) {
      blocks.push(childStmt.block()!);
    } else {
      statements.push(childStmt);
    }
  }

  /**
   * Collect blocks from switch statement cases and default.
   */
  private static _collectSwitchChildren(
    switchStmt: Parser.SwitchStatementContext,
    blocks: Parser.BlockContext[],
  ): void {
    for (const caseCtx of switchStmt.switchCase()) {
      blocks.push(caseCtx.block());
    }
    if (switchStmt.defaultCase()) {
      blocks.push(switchStmt.defaultCase()!.block());
    }
  }
}

export default ChildStatementCollector;
