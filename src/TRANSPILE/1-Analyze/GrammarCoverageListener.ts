/**
 * Grammar Coverage Listener
 * Tracks which ANTLR grammar rules are executed during parsing
 *
 * This listener attaches to the parser and records:
 * - Parser rules visited (e.g., program, expression, statement)
 * - Lexer rules matched (e.g., IDENTIFIER, INTEGER_LITERAL)
 *
 * Used to identify dead grammar code and untested language constructs.
 */

import {
  ErrorNode,
  ParserRuleContext,
  ParseTreeListener,
  TerminalNode,
} from "antlr4ng";
import IGrammarCoverageReport from "../../types/IGrammarCoverageReport";
import GrammarCoverageReportBuilder from "./types/GrammarCoverageReportBuilder";

class GrammarCoverageListener implements ParseTreeListener {
  private readonly parserRuleVisits: Map<string, number> = new Map();
  private readonly lexerRuleVisits: Map<string, number> = new Map();
  private readonly parserRuleNames: string[];
  private readonly lexerRuleNames: string[];

  constructor(parserRuleNames: string[], lexerRuleNames: string[]) {
    this.parserRuleNames = parserRuleNames;
    this.lexerRuleNames = lexerRuleNames;
  }

  /**
   * Called when entering every parser rule
   * @public ParseTreeWalker calls this through ParseTreeListener; no caller names it
   */
  enterEveryRule(ctx: ParserRuleContext): void {
    const ruleName = this.parserRuleNames[ctx.ruleIndex];
    if (ruleName) {
      const count = this.parserRuleVisits.get(ruleName) || 0;
      this.parserRuleVisits.set(ruleName, count + 1);
    }
  }

  /**
   * Called when exiting every parser rule
   * @public ParseTreeWalker calls this through ParseTreeListener; no caller names it
   */
  exitEveryRule(_ctx: ParserRuleContext): void {
    // Not needed for coverage tracking
  }

  /**
   * Called when visiting a terminal node (token)
   * @public ParseTreeWalker calls this through ParseTreeListener; no caller names it
   */
  visitTerminal(node: TerminalNode): void {
    const tokenType = node.symbol.type;
    // Token type -1 is EOF, skip it
    if (tokenType < 0) return;

    // Token types are 1-indexed in ANTLR, but the array is 0-indexed
    // The first element (index 0) corresponds to token type 1
    const ruleName = this.lexerRuleNames[tokenType - 1];
    if (ruleName) {
      const count = this.lexerRuleVisits.get(ruleName) || 0;
      this.lexerRuleVisits.set(ruleName, count + 1);
    }
  }

  /**
   * Called when visiting an error node
   * @public ParseTreeWalker calls this through ParseTreeListener; no caller names it
   */
  visitErrorNode(_node: ErrorNode): void {
    // Track error nodes if needed in the future
  }

  /**
   * Generate a coverage report
   */
  getReport(): IGrammarCoverageReport {
    return GrammarCoverageReportBuilder.build({
      parserRuleNames: this.parserRuleNames,
      lexerRuleNames: this.lexerRuleNames,
      parserRuleVisits: this.parserRuleVisits,
      lexerRuleVisits: this.lexerRuleVisits,
    });
  }
}

export default GrammarCoverageListener;
