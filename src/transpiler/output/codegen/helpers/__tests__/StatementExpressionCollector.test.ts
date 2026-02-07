/**
 * Unit tests for StatementExpressionCollector
 * Issue #566: Tests for expression extraction from statement contexts
 */

import { describe, it, expect } from "vitest";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser.js";
import StatementExpressionCollector from "../StatementExpressionCollector.js";
import * as Parser from "../../../../logic/parser/grammar/CNextParser.js";

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
      it("collects expression from ifStatement", () => {
        const stmt = getStatement("if (x = 1) { }");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });

      it("collects expression from whileStatement", () => {
        const stmt = getStatement("while (x > 0) { }");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });

      it("collects expression from doWhileStatement", () => {
        const stmt = getStatement("do { } while (x != 0);");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });

      it("collects expression from switchStatement", () => {
        const stmt = getStatement("switch (x) { case 1 { } }");
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
      it("returns empty for block statement", () => {
        const stmt = getStatement("{ }");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(0);
      });

      it("handles compound assignment operator", () => {
        const stmt = getStatement("x +<- 5;");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });

      it("handles function call in expression statement", () => {
        const stmt = getStatement("doSomething(x, y);");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });

      it("handles member access in assignment", () => {
        const stmt = getStatement("obj.field <- 10;");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });

      it("handles array access in assignment", () => {
        const stmt = getStatement("arr[0] <- 10;");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });
    });

    describe("nested expressions", () => {
      it("collects complex if condition", () => {
        const stmt = getStatement("if (x > 0 && y < 10) { }");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });

      it("collects ternary in assignment", () => {
        const stmt = getStatement("x <- (a > b) ? a : b;");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });

      it("collects function call with complex arguments", () => {
        const stmt = getStatement("result <- compute(a + b, c * d);");
        expect(stmt).not.toBeNull();
        const expressions = StatementExpressionCollector.collectAll(stmt!);
        expect(expressions).toHaveLength(1);
      });
    });
  });
});
