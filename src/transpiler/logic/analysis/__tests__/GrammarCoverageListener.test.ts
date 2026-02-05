/**
 * Unit tests for GrammarCoverageListener
 * Tests grammar rule coverage tracking (pure unit tests, no parsing needed)
 */
import { describe, it, expect } from "vitest";
import { ParserRuleContext, TerminalNode, Token } from "antlr4ng";
import GrammarCoverageListener from "../GrammarCoverageListener";

/**
 * Create a mock ParserRuleContext with a given ruleIndex
 */
function mockRuleContext(ruleIndex: number): ParserRuleContext {
  const ctx = new ParserRuleContext(null);
  Object.defineProperty(ctx, "ruleIndex", { value: ruleIndex });
  return ctx;
}

/**
 * Create a mock TerminalNode with a given token type
 */
function mockTerminalNode(tokenType: number): TerminalNode {
  const token = { type: tokenType } as Token;
  return { symbol: token } as TerminalNode;
}

describe("GrammarCoverageListener", () => {
  const parserRuleNames = ["program", "statement", "expression"];
  const lexerRuleNames = ["IDENTIFIER", "INTEGER_LITERAL", "PLUS"];

  describe("enterEveryRule", () => {
    it("should increment count for valid rule index", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      listener.enterEveryRule(mockRuleContext(0));

      const visits = listener.getParserRuleVisits();
      expect(visits.get("program")).toBe(1);
    });

    it("should increment count on repeated visits", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      listener.enterEveryRule(mockRuleContext(1));
      listener.enterEveryRule(mockRuleContext(1));
      listener.enterEveryRule(mockRuleContext(1));

      const visits = listener.getParserRuleVisits();
      expect(visits.get("statement")).toBe(3);
    });

    it("should not crash with out-of-range rule index", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      listener.enterEveryRule(mockRuleContext(999));

      const visits = listener.getParserRuleVisits();
      expect(visits.size).toBe(0);
    });
  });

  describe("visitTerminal", () => {
    it("should increment count for valid token type", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      // Token type 1 maps to lexerRuleNames[0] = "IDENTIFIER"
      listener.visitTerminal(mockTerminalNode(1));

      const visits = listener.getLexerRuleVisits();
      expect(visits.get("IDENTIFIER")).toBe(1);
    });

    it("should skip EOF token (type -1)", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      listener.visitTerminal(mockTerminalNode(-1));

      const visits = listener.getLexerRuleVisits();
      expect(visits.size).toBe(0);
    });

    it("should not crash with out-of-range token type", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      listener.visitTerminal(mockTerminalNode(999));

      const visits = listener.getLexerRuleVisits();
      expect(visits.size).toBe(0);
    });

    it("should handle multiple different tokens", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      listener.visitTerminal(mockTerminalNode(1)); // IDENTIFIER
      listener.visitTerminal(mockTerminalNode(2)); // INTEGER_LITERAL
      listener.visitTerminal(mockTerminalNode(3)); // PLUS

      const visits = listener.getLexerRuleVisits();
      expect(visits.size).toBe(3);
      expect(visits.get("IDENTIFIER")).toBe(1);
      expect(visits.get("INTEGER_LITERAL")).toBe(1);
      expect(visits.get("PLUS")).toBe(1);
    });
  });

  describe("merge", () => {
    it("should combine counts from two listeners", () => {
      const listener1 = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      const listener2 = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );

      listener1.enterEveryRule(mockRuleContext(0)); // program: 1
      listener1.visitTerminal(mockTerminalNode(1)); // IDENTIFIER: 1

      listener2.enterEveryRule(mockRuleContext(0)); // program: 1
      listener2.enterEveryRule(mockRuleContext(1)); // statement: 1
      listener2.visitTerminal(mockTerminalNode(1)); // IDENTIFIER: 1
      listener2.visitTerminal(mockTerminalNode(2)); // INTEGER_LITERAL: 1

      listener1.merge(listener2);

      const parserVisits = listener1.getParserRuleVisits();
      expect(parserVisits.get("program")).toBe(2);
      expect(parserVisits.get("statement")).toBe(1);

      const lexerVisits = listener1.getLexerRuleVisits();
      expect(lexerVisits.get("IDENTIFIER")).toBe(2);
      expect(lexerVisits.get("INTEGER_LITERAL")).toBe(1);
    });
  });

  describe("reset", () => {
    it("should clear all counts", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      listener.enterEveryRule(mockRuleContext(0));
      listener.visitTerminal(mockTerminalNode(1));

      listener.reset();

      expect(listener.getParserRuleVisits().size).toBe(0);
      expect(listener.getLexerRuleVisits().size).toBe(0);
    });
  });

  describe("getParserRuleVisits / getLexerRuleVisits", () => {
    it("should return copies that don't affect internal state", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      listener.enterEveryRule(mockRuleContext(0));

      const visits = listener.getParserRuleVisits();
      visits.set("program", 999);

      const freshVisits = listener.getParserRuleVisits();
      expect(freshVisits.get("program")).toBe(1);
    });
  });

  describe("getReport", () => {
    it("should return correct totals and percentages", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      listener.enterEveryRule(mockRuleContext(0)); // visit "program"
      listener.visitTerminal(mockTerminalNode(1)); // visit "IDENTIFIER"

      const report = listener.getReport();

      expect(report.totalParserRules).toBe(3);
      expect(report.totalLexerRules).toBe(3);
      expect(report.visitedParserRules).toBe(1);
      expect(report.visitedLexerRules).toBe(1);
      expect(report.parserCoveragePercentage).toBeCloseTo(33.33, 1);
      expect(report.lexerCoveragePercentage).toBeCloseTo(33.33, 1);
      expect(report.combinedCoveragePercentage).toBeCloseTo(33.33, 1);
    });

    it("should list never-visited rules", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      listener.enterEveryRule(mockRuleContext(0)); // only visit "program"

      const report = listener.getReport();

      expect(report.neverVisitedParserRules).toEqual([
        "statement",
        "expression",
      ]);
      expect(report.neverVisitedLexerRules).toEqual([
        "IDENTIFIER",
        "INTEGER_LITERAL",
        "PLUS",
      ]);
    });

    it("should handle zero rules without division error", () => {
      const listener = new GrammarCoverageListener([], []);
      const report = listener.getReport();

      expect(report.totalParserRules).toBe(0);
      expect(report.totalLexerRules).toBe(0);
      expect(report.parserCoveragePercentage).toBe(0);
      expect(report.lexerCoveragePercentage).toBe(0);
      expect(report.combinedCoveragePercentage).toBe(0);
    });

    it("should return map copies in report", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      listener.enterEveryRule(mockRuleContext(0));

      const report = listener.getReport();
      report.parserRuleVisits.set("program", 999);

      const freshReport = listener.getReport();
      expect(freshReport.parserRuleVisits.get("program")).toBe(1);
    });

    it("should report 100% when all rules visited", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      listener.enterEveryRule(mockRuleContext(0));
      listener.enterEveryRule(mockRuleContext(1));
      listener.enterEveryRule(mockRuleContext(2));
      listener.visitTerminal(mockTerminalNode(1));
      listener.visitTerminal(mockTerminalNode(2));
      listener.visitTerminal(mockTerminalNode(3));

      const report = listener.getReport();

      expect(report.parserCoveragePercentage).toBe(100);
      expect(report.lexerCoveragePercentage).toBe(100);
      expect(report.combinedCoveragePercentage).toBe(100);
      expect(report.neverVisitedParserRules).toHaveLength(0);
      expect(report.neverVisitedLexerRules).toHaveLength(0);
    });
  });

  describe("exitEveryRule / visitErrorNode", () => {
    it("should not crash when called", () => {
      const listener = new GrammarCoverageListener(
        parserRuleNames,
        lexerRuleNames,
      );
      const ctx = mockRuleContext(0);

      expect(() => listener.exitEveryRule(ctx)).not.toThrow();
      expect(() => listener.visitErrorNode(undefined as never)).not.toThrow();
    });
  });
});
