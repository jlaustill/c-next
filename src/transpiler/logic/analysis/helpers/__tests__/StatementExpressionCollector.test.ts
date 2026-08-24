/**
 * Unit tests for StatementExpressionCollector
 * Issue #566: Tests for expression extraction from statement contexts
 */

import { describe, it, expect } from "vitest";
import CNextSourceParser from "../../../parser/CNextSourceParser.js";
import StatementExpressionCollector from "../StatementExpressionCollector.js";
import * as Parser from "../../../parser/grammar/CNextParser.js";

describe("StatementExpressionCollector", () => {
  /**
   * Helper to extract a statement context from C-Next source.
   * Parses the source and extracts the first statement from main().
   */
  function getStatement(source: string): Parser.StatementContext | null {
    // Wrap in main function to get statement context
    const fullSource = `void main() { ${source} }`;
    const result = CNextSourceParser.parse(fullSource);
    const decl = result.tree.declaration(0);
    const funcDef = decl?.functionDeclaration();
    const block = funcDef?.block();
    return block?.statement(0) ?? null;
  }

  /**
   * Helper to get a statement from a typed function.
   */
  function getReturnStatement(source: string): Parser.StatementContext | null {
    const result = CNextSourceParser.parse(source);
    const decl = result.tree.declaration(0);
    const funcDef = decl?.functionDeclaration();
    const block = funcDef?.block();
    return block?.statement(0) ?? null;
  }

  describe("collectAll", () => {
    describe("simple statements", () => {
      it("collects expression from expressionStatement", () => {
        const stmt = getStatement("foo();");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });

      it("collects expression from assignmentStatement", () => {
        const stmt = getStatement("x <- 42;");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });

      it("collects expression from variableDeclaration with initializer", () => {
        const stmt = getStatement("u32 x <- 10;");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });

      it("returns empty for variableDeclaration without initializer", () => {
        const stmt = getStatement("u32 x;");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(0);
      });

      it("collects expression from returnStatement with value", () => {
        const stmt = getReturnStatement(`u32 getValue() { return 42; }`);
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });

      it("returns empty for returnStatement without value", () => {
        const stmt = getStatement("return;");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(0);
      });
    });

    describe("control flow conditions", () => {
      it.each([
        ["collects expression from ifStatement", "if (x = 1) { }"],
        ["collects expression from whileStatement", "while (x > 0) { }"],
        ["collects expression from doWhileStatement", "do { } while (x != 0);"],
        [
          "collects expression from switchStatement",
          "switch (x) { case 1 { } }",
        ],
      ])("%s", (_label, source) => {
        const stmt = getStatement(source);
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });
    });

    describe("for statement parts", () => {
      it("collects condition from forStatement", () => {
        const stmt = getStatement("for (;x < 10;) { }");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        // Should have the condition expression
        expect(expressions.length).toBeGreaterThanOrEqual(1);
      });

      it("collects init assignment from forStatement", () => {
        const stmt = getStatement("for (i <- 0;;) { }");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        // Should have the init expression (0)
        expect(expressions.length).toBeGreaterThanOrEqual(1);
      });

      it("collects init variable declaration from forStatement", () => {
        const stmt = getStatement("for (u32 i <- 0;;) { }");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        // Should have the init expression (0)
        expect(expressions.length).toBeGreaterThanOrEqual(1);
      });

      it("collects update from forStatement", () => {
        const stmt = getStatement("for (;;i <- i + 1) { }");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        // Should have the update expression
        expect(expressions.length).toBeGreaterThanOrEqual(1);
      });

      it("collects all three parts from complete forStatement", () => {
        const stmt = getStatement("for (u32 i <- 0; i < 10; i <- i + 1) { }");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        // Should have: init (0), condition (i < 10), update (i + 1)
        expect(expressions).toHaveLength(3);
      });

      it("returns empty for bare forStatement with no expressions", () => {
        const stmt = getStatement("for (;;) { }");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(0);
      });
    });

    describe("edge cases", () => {
      it.each([
        ["returns empty for block statement", "{ }", 0],
        ["handles compound assignment operator", "x +<- 5;", 1],
        [
          "handles function call in expression statement",
          "doSomething(x, y);",
          1,
        ],
        ["handles member access in assignment", "obj.field <- 10;", 1],
        ["handles array access in assignment", "arr[0] <- 10;", 1],
      ])("%s", (_label, source, expected) => {
        const stmt = getStatement(source);
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(expected);
      });
    });

    describe("nested expressions", () => {
      it.each([
        ["collects complex if condition", "if (x > 0 && y < 10) { }"],
        ["collects ternary in assignment", "x <- (a > b) ? a : b;"],
        [
          "collects function call with complex arguments",
          "result <- compute(a + b, c * d);",
        ],
      ])("%s", (_label, source) => {
        const stmt = getStatement(source);
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });
    });
  });
});
