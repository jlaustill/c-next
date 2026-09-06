/**
 * Builder for IGrammarCoverageReport
 * Shared between GrammarCoverageListener and scripts/grammar-coverage.ts
 */

import IGrammarCoverageReport from "./IGrammarCoverageReport";

interface IBuildReportInput {
  parserRuleNames: string[];
  lexerRuleNames: string[];
  parserRuleVisits: Map<string, number>;
  lexerRuleVisits: Map<string, number>;
}

/**
 * Build a grammar coverage report from raw visit data
 */
function buildGrammarCoverageReport(
  input: IBuildReportInput,
): IGrammarCoverageReport {
  const totalParserRules = input.parserRuleNames.length;
  const totalLexerRules = input.lexerRuleNames.length;
  const visitedParserRules = input.parserRuleVisits.size;
  const visitedLexerRules = input.lexerRuleVisits.size;

  const neverVisitedParserRules = input.parserRuleNames.filter(
    (name) => !input.parserRuleVisits.has(name),
  );
  const neverVisitedLexerRules = input.lexerRuleNames.filter(
    (name) => !input.lexerRuleVisits.has(name),
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
    parserRuleVisits: new Map(input.parserRuleVisits),
    lexerRuleVisits: new Map(input.lexerRuleVisits),
    parserCoveragePercentage,
    lexerCoveragePercentage,
    combinedCoveragePercentage,
  };
}

class GrammarCoverageReportBuilder {
  static readonly build = buildGrammarCoverageReport;
}

export default GrammarCoverageReportBuilder;
