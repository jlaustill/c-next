/**
 * Grammar Coverage Report Builder
 *
 * Utility for building coverage reports from rule visit data.
 * Used by GrammarCoverageListener and grammar-coverage.ts script.
 */

import IGrammarCoverageReport from "./types/IGrammarCoverageReport";

class GrammarCoverageReportBuilder {
  /**
   * Build a grammar coverage report from rule visit data.
   *
   * @param parserRuleNames - All parser rule names
   * @param lexerRuleNames - All lexer rule names
   * @param parserRuleVisits - Map of parser rule names to visit counts
   * @param lexerRuleVisits - Map of lexer rule names to visit counts
   * @returns The coverage report
   */
  static build(
    parserRuleNames: readonly string[],
    lexerRuleNames: readonly string[],
    parserRuleVisits: Map<string, number>,
    lexerRuleVisits: Map<string, number>,
  ): IGrammarCoverageReport {
    const totalParserRules = parserRuleNames.length;
    const totalLexerRules = lexerRuleNames.length;
    const visitedParserRules = parserRuleVisits.size;
    const visitedLexerRules = lexerRuleVisits.size;

    const neverVisitedParserRules = parserRuleNames.filter(
      (name) => !parserRuleVisits.has(name),
    );
    const neverVisitedLexerRules = lexerRuleNames.filter(
      (name) => !lexerRuleVisits.has(name),
    );

    const parserCoveragePercentage =
      totalParserRules > 0 ? (visitedParserRules / totalParserRules) * 100 : 0;
    const lexerCoveragePercentage =
      totalLexerRules > 0 ? (visitedLexerRules / totalLexerRules) * 100 : 0;
    const combinedTotal = totalParserRules + totalLexerRules;
    const combinedVisited = visitedParserRules + visitedLexerRules;
    const combinedCoveragePercentage =
      combinedTotal > 0 ? (combinedVisited / combinedTotal) * 100 : 0;

    return {
      totalParserRules,
      totalLexerRules,
      visitedParserRules,
      visitedLexerRules,
      neverVisitedParserRules,
      neverVisitedLexerRules,
      parserRuleVisits: new Map(parserRuleVisits),
      lexerRuleVisits: new Map(lexerRuleVisits),
      parserCoveragePercentage,
      lexerCoveragePercentage,
      combinedCoveragePercentage,
    };
  }
}

export default GrammarCoverageReportBuilder;
