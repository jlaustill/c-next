/**
 * Grammar rule coverage report aggregating statistics across parsed files
 */
interface IGrammarCoverageReport {
  /** Total number of parser rules in the grammar */
  totalParserRules: number;
  /** Total number of lexer rules in the grammar */
  totalLexerRules: number;
  /** Number of parser rules that were visited at least once */
  visitedParserRules: number;
  /** Number of lexer rules (token types) that were matched at least once */
  visitedLexerRules: number;
  /** Parser rules that were never visited */
  neverVisitedParserRules: string[];
  /** Lexer rules that were never matched */
  neverVisitedLexerRules: string[];
  /** Visit counts for each parser rule */
  parserRuleVisits: Map<string, number>;
  /** Match counts for each lexer rule (token type) */
  lexerRuleVisits: Map<string, number>;
  /** Coverage percentage for parser rules (0-100) */
  parserCoveragePercentage: number;
  /** Coverage percentage for lexer rules (0-100) */
  lexerCoveragePercentage: number;
  /** Combined coverage percentage (0-100) */
  combinedCoveragePercentage: number;
}

export default IGrammarCoverageReport;
