/**
 * Return-Path Analyzer
 * ADR-112 / Issue #1040: reject a non-void function that can reach the end of
 * its body without returning a value (undefined behavior in C).
 *
 * The analysis is intentionally strict and conservative (sound): it never
 * accepts a function that might fall through, and it does not attempt to prove
 * that loops are infinite or that a switch over an enum is exhaustive. Where it
 * cannot prove a return, an explicit `return <value>` is required.
 *
 * C-Next has no break/continue (ADR-026), so loop bodies have no early
 * structural exits to reason about.
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IReturnPathError from "./types/IReturnPathError";

/**
 * Does executing this statement guarantee that the enclosing function returns a
 * value before control passes beyond it?
 */
function statementDefinitelyReturns(ctx: Parser.StatementContext): boolean {
  const returnStmt = ctx.returnStatement();
  if (returnStmt) {
    // A bare `return;` (no expression) returns no value, so it does not satisfy
    // a non-void function.
    return returnStmt.expression() !== null;
  }

  const ifStmt = ctx.ifStatement();
  if (ifStmt) {
    return ifDefinitelyReturns(ifStmt);
  }

  const switchStmt = ctx.switchStatement();
  if (switchStmt) {
    return switchDefinitelyReturns(switchStmt);
  }

  const doWhileStmt = ctx.doWhileStatement();
  if (doWhileStmt) {
    // The body always executes at least once.
    return blockDefinitelyReturns(doWhileStmt.block());
  }

  if (ctx.foreverStatement()) {
    // ADR-113: a `forever` loop is divergent — C-Next has no break/continue
    // (ADR-026), so control never passes beyond it. It is therefore a terminal
    // path, like an unconditional return, and the function never falls through
    // here. This is the shared "divergence" primitive ADR-114 (#849) reuses.
    //
    // `forever` is void-only (E0705, enforced in codegen). Marking it terminal
    // here keeps a non-void function containing a `forever` loop from emitting a
    // misleading E0704 ("must return a value") instead of the precise E0705.
    return true;
  }

  const block = ctx.block();
  if (block) {
    return blockDefinitelyReturns(block);
  }

  const criticalStmt = ctx.criticalStatement();
  if (criticalStmt) {
    return blockDefinitelyReturns(criticalStmt.block());
  }

  // while / for (the body may not execute), variable declarations, assignments,
  // and expression statements never guarantee a return on their own.
  return false;
}

/**
 * A block guarantees a return iff any of its statements does: statements after
 * an unconditional return are unreachable.
 */
function blockDefinitelyReturns(ctx: Parser.BlockContext): boolean {
  return ctx.statement().some(statementDefinitelyReturns);
}

/**
 * An if guarantees a return only when an `else` is present and both branches
 * guarantee a return. `else if` chains recurse through the else branch.
 */
function ifDefinitelyReturns(ctx: Parser.IfStatementContext): boolean {
  const branches = ctx.statement();
  if (branches.length < 2) {
    return false;
  }
  return (
    statementDefinitelyReturns(branches[0]) &&
    statementDefinitelyReturns(branches[1])
  );
}

/**
 * A switch guarantees a return only when a `default` is present and every case
 * block and the default block guarantee a return.
 */
function switchDefinitelyReturns(ctx: Parser.SwitchStatementContext): boolean {
  const defaultCase = ctx.defaultCase();
  if (!defaultCase) {
    return false;
  }
  const everyCaseReturns = ctx
    .switchCase()
    .every((switchCase) => blockDefinitelyReturns(switchCase.block()));
  return everyCaseReturns && blockDefinitelyReturns(defaultCase.block());
}

/**
 * Listener that flags non-void functions whose body can fall through.
 */
class ReturnPathListener extends CNextListener {
  private readonly analyzer: ReturnPathAnalyzer;

  constructor(analyzer: ReturnPathAnalyzer) {
    super();
    this.analyzer = analyzer;
  }

  override enterFunctionDeclaration = (
    ctx: Parser.FunctionDeclarationContext,
  ): void => {
    // Void functions are allowed to fall off the end.
    if (ctx.type().getText() === "void") {
      return;
    }

    if (blockDefinitelyReturns(ctx.block())) {
      return;
    }

    const identifier = ctx.IDENTIFIER();
    this.analyzer.addError(
      identifier.getText(),
      identifier.symbol.line,
      identifier.symbol.column,
    );
  };
}

/**
 * Analyzer for missing return paths (ADR-112).
 */
class ReturnPathAnalyzer {
  private errors: IReturnPathError[] = [];

  public analyze(tree: Parser.ProgramContext): IReturnPathError[] {
    this.errors = [];
    const listener = new ReturnPathListener(this);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return this.errors;
  }

  public addError(functionName: string, line: number, column: number): void {
    this.errors.push({
      code: "E0704",
      functionName,
      line,
      column,
      message: `Non-void function '${functionName}' must return a value on all paths`,
      helpText:
        "Add an explicit 'return <value>;' so every control-flow path returns a value",
    });
  }
}

export default ReturnPathAnalyzer;
