/**
 * Tests for the expression walker helpers used in const inference.
 * These helpers extract expressions from statements for modification analysis.
 */
import { describe, it, expect } from "vitest";
import CNextSourceParser from "../../../logic/parser/CNextSourceParser";
import * as Parser from "../../../logic/parser/grammar/CNextParser";
import Transpiler from "../../../Transpiler";

/**
 * Helper to parse C-Next source and get the first statement from main().
 */
function parseFirstStatement(source: string): Parser.StatementContext {
  const { tree, errors } = CNextSourceParser.parse(source);
  if (errors.length > 0) {
    throw new Error(`Parse failed: ${errors.map((e) => e.message).join(", ")}`);
  }
  // Find main function
  for (const decl of tree.declaration()) {
    if (decl.functionDeclaration()) {
      const funcDecl = decl.functionDeclaration()!;
      if (funcDecl.IDENTIFIER().getText() === "main") {
        const block = funcDecl.block();
        if (block && block.statement().length > 0) {
          return block.statement()[0];
        }
      }
    }
  }
  throw new Error("No statement found in main()");
}

describe("ExpressionWalker - collectExpressionsFromStatement", () => {
  // Note: These tests verify the AST structure that the helpers will rely on.

  describe("expression collection from different statement types", () => {
    it("should collect expression from expressionStatement", () => {
      const source = `
        void foo() { }
        void main() {
          foo();
        }
      `;
      const stmt = parseFirstStatement(source);
      expect(stmt.expressionStatement()).not.toBeNull();
      expect(stmt.expressionStatement()!.expression()).not.toBeNull();
    });

    it("should collect expression from assignmentStatement", () => {
      const source = `
        u32 getValue() { return 1; }
        u32 x;
        void main() {
          x <- getValue();
        }
      `;
      const stmt = parseFirstStatement(source);
      expect(stmt.assignmentStatement()).not.toBeNull();
      expect(stmt.assignmentStatement()!.expression()).not.toBeNull();
    });

    it("should collect expression from variableDeclaration with initializer", () => {
      const source = `
        u32 getValue() { return 1; }
        void main() {
          u32 x <- getValue();
        }
      `;
      const stmt = parseFirstStatement(source);
      expect(stmt.variableDeclaration()).not.toBeNull();
      expect(stmt.variableDeclaration()!.expression()).not.toBeNull();
    });

    it("should collect expression from returnStatement", () => {
      const source = `
        u32 getValue() { return 1; }
        u32 main() {
          return getValue();
        }
      `;
      const stmt = parseFirstStatement(source);
      expect(stmt.returnStatement()).not.toBeNull();
      expect(stmt.returnStatement()!.expression()).not.toBeNull();
    });

    it("should collect condition expression from ifStatement", () => {
      const source = `
        u32 getFlag() { return 1; }
        void main() {
          if (getFlag() = 1) { }
        }
      `;
      const stmt = parseFirstStatement(source);
      expect(stmt.ifStatement()).not.toBeNull();
      expect(stmt.ifStatement()!.expression()).not.toBeNull();
    });

    it("should collect condition expression from whileStatement", () => {
      const source = `
        u32 getFlag() { return 1; }
        void main() {
          while (getFlag() = 1) { }
        }
      `;
      const stmt = parseFirstStatement(source);
      expect(stmt.whileStatement()).not.toBeNull();
      expect(stmt.whileStatement()!.expression()).not.toBeNull();
    });

    it("should collect all expressions from forStatement", () => {
      const source = `
        u32 getStart() { return 0; }
        u32 getEnd() { return 10; }
        u32 getNext() { return 1; }
        void main() {
          for (u32 i <- getStart(); i < getEnd(); i <- getNext()) { }
        }
      `;
      const stmt = parseFirstStatement(source);
      const forStmt = stmt.forStatement();
      expect(forStmt).not.toBeNull();
      // Condition
      expect(forStmt!.expression()).not.toBeNull();
      // forInit with variable declaration
      expect(forStmt!.forInit()?.forVarDecl()?.expression()).not.toBeNull();
      // forUpdate
      expect(forStmt!.forUpdate()?.expression()).not.toBeNull();
    });

    it("should collect all expressions from forStatement with assignment init", () => {
      const source = `
        u32 getStart() { return 0; }
        u32 i;
        void main() {
          for (i <- getStart(); i < 10; i <- i + 1) { }
        }
      `;
      const stmt = parseFirstStatement(source);
      const forStmt = stmt.forStatement();
      expect(forStmt).not.toBeNull();
      // forInit with assignment
      expect(forStmt!.forInit()?.forAssignment()?.expression()).not.toBeNull();
    });

    it("should collect condition expression from doWhileStatement", () => {
      const source = `
        u32 getFlag() { return 1; }
        void main() {
          do { } while (getFlag() = 1);
        }
      `;
      const stmt = parseFirstStatement(source);
      expect(stmt.doWhileStatement()).not.toBeNull();
      expect(stmt.doWhileStatement()!.expression()).not.toBeNull();
    });

    it("should collect switch expression from switchStatement", () => {
      const source = `
        u32 getValue() { return 1; }
        void main() {
          switch (getValue()) {
            case 1 { }
          }
        }
      `;
      const stmt = parseFirstStatement(source);
      expect(stmt.switchStatement()).not.toBeNull();
      expect(stmt.switchStatement()!.expression()).not.toBeNull();
    });
  });
});

describe("ExpressionWalker - getChildStatements", () => {
  describe("child statement extraction from control flow", () => {
    it("should get child statements from ifStatement", () => {
      const source = `
        void foo() { }
        void main() {
          if (1 = 1) {
            foo();
          }
        }
      `;
      const stmt = parseFirstStatement(source);
      const ifStmt = stmt.ifStatement();
      expect(ifStmt).not.toBeNull();
      // ifStatement has statement() children (blocks or single statements)
      expect(ifStmt!.statement().length).toBeGreaterThan(0);
    });

    it("should get child statements from if-else", () => {
      const source = `
        void foo() { }
        void bar() { }
        void main() {
          if (1 = 1) {
            foo();
          } else {
            bar();
          }
        }
      `;
      const stmt = parseFirstStatement(source);
      const ifStmt = stmt.ifStatement();
      expect(ifStmt).not.toBeNull();
      // Should have both then and else branches
      expect(ifStmt!.statement().length).toBe(2);
    });

    it("should get child statement from whileStatement", () => {
      const source = `
        void foo() { }
        void main() {
          while (1 = 1) {
            foo();
          }
        }
      `;
      const stmt = parseFirstStatement(source);
      const whileStmt = stmt.whileStatement();
      expect(whileStmt).not.toBeNull();
      expect(whileStmt!.statement()).not.toBeNull();
    });

    it("should get child statement from forStatement", () => {
      const source = `
        void foo() { }
        void main() {
          for (u32 i <- 0; i < 10; i <- i + 1) {
            foo();
          }
        }
      `;
      const stmt = parseFirstStatement(source);
      const forStmt = stmt.forStatement();
      expect(forStmt).not.toBeNull();
      expect(forStmt!.statement()).not.toBeNull();
    });

    it("should get block from doWhileStatement", () => {
      const source = `
        void foo() { }
        void main() {
          do {
            foo();
          } while (1 = 1);
        }
      `;
      const stmt = parseFirstStatement(source);
      const doWhile = stmt.doWhileStatement();
      expect(doWhile).not.toBeNull();
      expect(doWhile!.block()).not.toBeNull();
    });

    it("should get case blocks from switchStatement", () => {
      const source = `
        void foo() { }
        void bar() { }
        void main() {
          switch (1) {
            case 1 { foo(); }
            case 2 { bar(); }
          }
        }
      `;
      const stmt = parseFirstStatement(source);
      const switchStmt = stmt.switchStatement();
      expect(switchStmt).not.toBeNull();
      expect(switchStmt!.switchCase().length).toBe(2);
    });

    it("should get block from criticalStatement", () => {
      const source = `
        void foo() { }
        void main() {
          critical {
            foo();
          }
        }
      `;
      const stmt = parseFirstStatement(source);
      const critical = stmt.criticalStatement();
      expect(critical).not.toBeNull();
      expect(critical!.block()).not.toBeNull();
    });
  });
});

describe("ExpressionWalker - const inference integration", () => {
  /**
   * These tests verify that the expression walking correctly detects
   * parameter modifications through function calls in various contexts.
   * Issue #565 was caused by missing expression walking in certain contexts.
   */

  it("should detect modification through function call in assignment RHS", async () => {
    // This was the bug in issue #565
    const source = `
      void modifyParam(u32 param) {
        param <- 42;
      }

      u32 result;

      void caller(u32 x) {
        result <- modifyParam(x);
      }

      void main() {
        u32 val <- 1;
        caller(val);
      }
    `;
    const transpiler = new Transpiler({ inputs: [] });
    const transpileResult = await transpiler.transpileSource(source);
    expect(transpileResult.success).toBe(true);
    // The caller function should NOT have const param because x is passed to modifyParam
    // which modifies its parameter
    expect(transpileResult.code).not.toContain("void caller(const uint32_t x)");
  });

  it("should detect modification through function call in for-loop init", async () => {
    const source = `
      void modifyParam(u32 param) {
        param <- 42;
      }

      u32 getInitAndModify(u32 p) {
        modifyParam(p);
        return 0;
      }

      void caller(u32 x) {
        for (u32 i <- getInitAndModify(x); i < 10; i <- i + 1) { }
      }

      void main() {
        u32 val <- 1;
        caller(val);
      }
    `;
    const transpiler = new Transpiler({ inputs: [] });
    const transpileResult = await transpiler.transpileSource(source);
    expect(transpileResult.success).toBe(true);
    // x should not be const because it's passed through a modifying call chain
    expect(transpileResult.code).not.toContain("void caller(const uint32_t x)");
  });

  it("should detect modification through function call in for-loop update", async () => {
    const source = `
      void modifyParam(u32 param) {
        param <- 42;
      }

      u32 getNextAndModify(u32 p) {
        modifyParam(p);
        return p + 1;
      }

      void caller(u32 x) {
        for (u32 i <- 0; i < 10; i <- getNextAndModify(x)) { }
      }

      void main() {
        u32 val <- 1;
        caller(val);
      }
    `;
    const transpiler = new Transpiler({ inputs: [] });
    const transpileResult = await transpiler.transpileSource(source);
    expect(transpileResult.success).toBe(true);
    // x should not be const
    expect(transpileResult.code).not.toContain("void caller(const uint32_t x)");
  });
});
