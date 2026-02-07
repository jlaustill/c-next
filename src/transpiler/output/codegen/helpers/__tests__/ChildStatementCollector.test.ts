/**
 * Unit tests for ChildStatementCollector
 * Issue #566: Tests for child statement/block collection from control flow
 */

import { describe, it, expect } from "vitest";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser.js";
import ChildStatementCollector from "../ChildStatementCollector.js";
import * as Parser from "../../../../logic/parser/grammar/CNextParser.js";

describe("ChildStatementCollector", () => {
  /**
   * Helper to extract a statement context from C-Next source.
   */
  function getStatement(source: string): Parser.StatementContext | null {
    const fullSource = `void main() { ${source} }`;
    const result = CNextSourceParser.parse(fullSource);
    const decl = result.tree.declaration(0);
    const funcDef = decl?.functionDeclaration();
    const block = funcDef?.block();
    return block?.statement(0) ?? null;
  }

  describe("collectAll", () => {
    describe("if statement", () => {
      it("collects block from if with block body", () => {
        const stmt = getStatement("if (x = 1) { }");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        expect(result.blocks).toHaveLength(1);
        expect(result.statements).toHaveLength(0);
      });

      it("collects statement from if with single statement body", () => {
        const stmt = getStatement("if (x = 1) return;");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        expect(result.statements).toHaveLength(1);
        expect(result.blocks).toHaveLength(0);
      });

      it("collects both branches from if-else", () => {
        const stmt = getStatement("if (x = 1) { } else { }");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        // Both then and else are blocks
        expect(result.blocks).toHaveLength(2);
        expect(result.statements).toHaveLength(0);
      });

      it("handles if-else with mixed statement types", () => {
        const stmt = getStatement("if (x = 1) return; else { }");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        // then is statement, else is block
        expect(result.statements).toHaveLength(1);
        expect(result.blocks).toHaveLength(1);
      });
    });

    describe("while statement", () => {
      it("collects block from while with block body", () => {
        const stmt = getStatement("while (x > 0) { }");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        expect(result.blocks).toHaveLength(1);
        expect(result.statements).toHaveLength(0);
      });

      it("collects statement from while with single statement body", () => {
        const stmt = getStatement("while (x > 0) x <- x - 1;");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        expect(result.statements).toHaveLength(1);
        expect(result.blocks).toHaveLength(0);
      });
    });

    describe("for statement", () => {
      it("collects block from for with block body", () => {
        const stmt = getStatement("for (;;) { }");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        expect(result.blocks).toHaveLength(1);
        expect(result.statements).toHaveLength(0);
      });

      it("collects statement from for with single statement body", () => {
        const stmt = getStatement("for (;;) x <- 1;");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        expect(result.statements).toHaveLength(1);
        expect(result.blocks).toHaveLength(0);
      });
    });

    describe("do-while statement", () => {
      it("collects block from do-while", () => {
        const stmt = getStatement("do { } while (x > 0);");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        // do-while always has a block
        expect(result.blocks).toHaveLength(1);
        expect(result.statements).toHaveLength(0);
      });
    });

    describe("switch statement", () => {
      it("collects case blocks from switch", () => {
        const stmt = getStatement("switch (x) { case 1 { } case 2 { } }");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        // 2 case blocks
        expect(result.blocks).toHaveLength(2);
        expect(result.statements).toHaveLength(0);
      });

      it("collects default block from switch", () => {
        const stmt = getStatement("switch (x) { case 1 { } default { } }");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        // 1 case block + 1 default block
        expect(result.blocks).toHaveLength(2);
      });

      it("handles multiple cases with default", () => {
        const stmt = getStatement(
          "switch (x) { case 1 { } case 2 { } default { } }",
        );
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        // 2 case blocks + 1 default block
        expect(result.blocks).toHaveLength(3);
      });
    });

    describe("critical statement", () => {
      it("collects block from critical", () => {
        const stmt = getStatement("critical { }");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        expect(result.blocks).toHaveLength(1);
        expect(result.statements).toHaveLength(0);
      });
    });

    describe("nested block statement", () => {
      it("collects nested block", () => {
        const stmt = getStatement("{ }");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        expect(result.blocks).toHaveLength(1);
        expect(result.statements).toHaveLength(0);
      });
    });

    describe("non-control-flow statements", () => {
      it("returns empty for expression statement", () => {
        const stmt = getStatement("foo();");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        expect(result.blocks).toHaveLength(0);
        expect(result.statements).toHaveLength(0);
      });

      it("returns empty for assignment statement", () => {
        const stmt = getStatement("x <- 42;");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        expect(result.blocks).toHaveLength(0);
        expect(result.statements).toHaveLength(0);
      });

      it("returns empty for variable declaration", () => {
        const stmt = getStatement("u32 x <- 10;");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        expect(result.blocks).toHaveLength(0);
        expect(result.statements).toHaveLength(0);
      });

      it("returns empty for return statement", () => {
        const stmt = getStatement("return;");
        expect(stmt).not.toBeNull();
        const result = ChildStatementCollector.collectAll(stmt!);
        expect(result.blocks).toHaveLength(0);
        expect(result.statements).toHaveLength(0);
      });
    });
  });
});
