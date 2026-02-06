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
import IGrammarCoverageReport from "./types/IGrammarCoverageReport";
import GrammarCoverageReportBuilder from "./GrammarCoverageReportBuilder";

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
   */
  exitEveryRule(_ctx: ParserRuleContext): void {
    // Not needed for coverage tracking
  }

  /**
   * Called when visiting a terminal node (token)
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
   */
  visitErrorNode(_node: ErrorNode): void {
    // Track error nodes if needed in the future
  }

  /**
   * Merge coverage from another listener (for aggregating across files)
   */
  merge(other: GrammarCoverageListener): void {
    for (const [rule, count] of other.parserRuleVisits) {
      const current = this.parserRuleVisits.get(rule) || 0;
      this.parserRuleVisits.set(rule, current + count);
    }
    for (const [rule, count] of other.lexerRuleVisits) {
      const current = this.lexerRuleVisits.get(rule) || 0;
      this.lexerRuleVisits.set(rule, current + count);
    }
  }

  /**
   * Reset all coverage counters
   */
  reset(): void {
    this.parserRuleVisits.clear();
    this.lexerRuleVisits.clear();
  }

  /**
   * Get the current parser rule visit counts
   */
  getParserRuleVisits(): Map<string, number> {
    return new Map(this.parserRuleVisits);
  }

  /**
   * Get the current lexer rule visit counts
   */
  getLexerRuleVisits(): Map<string, number> {
    return new Map(this.lexerRuleVisits);
  }

  /**
   * Generate a coverage report
   */
  getReport(): IGrammarCoverageReport {
    return GrammarCoverageReportBuilder.build(
      this.parserRuleNames,
      this.lexerRuleNames,
      this.parserRuleVisits,
      this.lexerRuleVisits,
    );
  }
}

export default GrammarCoverageListener;
