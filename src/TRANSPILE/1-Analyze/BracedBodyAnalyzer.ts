/**
 * E0716: an `if`, `else`, `while` or `for` body must be a braced block (#1090).
 *
 * MISRA C:2012 Rule 15.6 requires the body of every selection and iteration
 * statement to be a compound statement, and ADR-027 records it as enforced.
 * `do`-`while` and `forever` already take a `block` in the grammar; these four
 * take a `statement`, so an unbraced body parsed and passed through to the C.
 * An unbraced declaration was worse (#1795): C rejects it, and its name stayed
 * in scope after the `if`.
 *
 * `else if` is the one unbraced `else` body allowed: the `if` is the chain,
 * and each of its own bodies is checked here.
 */

import { ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import IBracedBodyError from "./types/IBracedBodyError";

class BracedBodyListener extends CNextListener {
  private readonly found: IBracedBodyError[] = [];

  public errors(): IBracedBodyError[] {
    return this.found;
  }

  override enterIfStatement = (ctx: Parser.IfStatementContext): void => {
    this.check("if", ctx.statement(0));
    const otherwise = ctx.statement(1);
    if (otherwise?.ifStatement() === null) {
      this.check("else", otherwise);
    }
  };

  override enterWhileStatement = (ctx: Parser.WhileStatementContext): void => {
    this.check("while", ctx.statement());
  };

  override enterForStatement = (ctx: Parser.ForStatementContext): void => {
    this.check("for", ctx.statement());
  };

  private check(keyword: string, body: Parser.StatementContext | null): void {
    if (body === null || body.block() !== null) return;
    const { line, column } = ParserUtils.getPosition(body);
    this.found.push({
      code: "E0716",
      line,
      column,
      message: `'${keyword}' body must be a braced block`,
      helpText: `Wrap the body in braces: \`${keyword === "else" ? "else" : `${keyword} (...)`} { ... }\` (MISRA C:2012 Rule 15.6)`,
    });
  }
}

class BracedBodyAnalyzer {
  public analyze(tree: Parser.ProgramContext): IBracedBodyError[] {
    const listener = new BracedBodyListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default BracedBodyAnalyzer;
