/**
 * Unit tests for StringLengthCounter
 * Issue #644: strlen caching optimization
 *
 * #1668 (C7): the counter asks what a name is declared as where it is used,
 * so each case declares its variables in source, against a real declared and
 * resolved program, rather than registering a type the source never states.
 */

import StatementLowering from "../../../PARSE/2-Parse/StatementLowering";
import { describe, it, expect } from "vitest";
import StringLengthCounter from "../StringLengthCounter";
import TranspileState from "../../TranspileState";
import SyntaxLowering from "../../../PARSE/2-Parse/SyntaxLowering";
import testAnalysisContextFor from "../../1-Analyze/__tests__/testAnalysisContextFor";
import type * as Parser from "../../../PARSE/2-Parse/grammar/CNextParser";

/** A state whose program is `source`'s, as 2.2 has it */
function stateFor(source: string): {
  tree: Parser.ProgramContext;
  state: TranspileState;
} {
  const { tree, context } = testAnalysisContextFor(source, { cppMode: false });
  const state = new TranspileState();
  state.program = context.program;
  state.symbols = context.symbols;
  state.sourcePath = "test.cnx";
  return { tree, state };
}

/** `test()`'s body, with `declarations` ahead of `statements` */
function blockIn(declarations: string, statements: string) {
  const { tree, state } = stateFor(
    `void test() { ${declarations} ${statements} }`,
  );
  const block = tree.declaration(0)!.functionDeclaration()!.block()!;
  return { block, state };
}

/** The expression statement `expression`, after `declarations` */
function expressionIn(declarations: string, expression: string) {
  const { block, state } = blockIn(declarations, `${expression};`);
  const statements = block.statement();
  const expr = SyntaxLowering.expression(
    statements.at(-1)!.expressionStatement()!.expression(),
  );
  return { expr, state };
}

describe("StringLengthCounter", () => {
  describe("countExpression", () => {
    it("counts single .char_count access on string variable", () => {
      const { expr, state } = expressionIn(
        "string<64> myStr;",
        "myStr.char_count",
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.get("myStr")).toBe(1);
    });

    it("counts multiple .char_count accesses on same variable", () => {
      const { expr, state } = expressionIn(
        "string<32> str;",
        "str.char_count + str.char_count",
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.get("str")).toBe(2);
    });

    it("counts .char_count accesses on different string variables", () => {
      const { expr, state } = expressionIn(
        "string<16> a; string<32> b;",
        "a.char_count + b.char_count",
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.get("a")).toBe(1);
      expect(counts.get("b")).toBe(1);
    });

    it("ignores .char_count on non-string variables", () => {
      const { expr, state } = expressionIn("u8[10] arr;", "arr.char_count");
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.get("arr")).toBeUndefined();
    });

    it("ignores other member accesses", () => {
      const { tree, state } = stateFor(
        "struct O { u32 value; }\nvoid test() { O obj; obj.value; }",
      );
      const block = tree.declaration(1)!.functionDeclaration()!.block()!;
      const expr = SyntaxLowering.expression(
        block.statement(1)!.expressionStatement()!.expression(),
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.size).toBe(0);
    });

    it("handles unknown variables gracefully", () => {
      const { expr, state } = expressionIn("", "unknown.char_count");
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.size).toBe(0);
    });

    it("counts the string a name means where it is used", () => {
      // #1668: a string global shadowed by a same-named local array -- the
      // registry's one flat key per function could not tell them apart
      const { tree, state } = stateFor(
        "string<8> s;\nvoid test() { u8 x <- s.char_count; { u8[4] s; u8 y <- s.char_count; } }",
      );
      const block = tree.declaration(1)!.functionDeclaration()!.block()!;

      const counts = new Map<string, number>();
      StringLengthCounter.countBlockInto(
        StatementLowering.block(block),
        counts,
        state,
      );

      expect(counts.get("s")).toBe(1);
    });
  });

  describe("countBlockInto", () => {
    it("counts .char_count in assignment statements", () => {
      const { block, state } = blockIn(
        "string<64> text;",
        `
        u32 x;
        x <- text.char_count;
      `,
      );
      const counts = new Map<string, number>();
      StringLengthCounter.countBlockInto(
        StatementLowering.block(block),
        counts,
        state,
      );

      expect(counts.get("text")).toBe(1);
    });

    it("adds counts to existing map", () => {
      const { block, state } = blockIn(
        "string<32> s1; string<32> s2;",
        `
        u32 a <- s1.char_count;
        u32 b <- s2.char_count;
      `,
      );

      // Pre-populate counts
      const counts = new Map<string, number>();
      counts.set("s1", 1);

      StringLengthCounter.countBlockInto(
        StatementLowering.block(block),
        counts,
        state,
      );

      expect(counts.get("s1")).toBe(2); // 1 existing + 1 new
      expect(counts.get("s2")).toBe(1);
    });
  });

  describe("nested expressions", () => {
    it("counts .char_count in ternary expressions", () => {
      const { expr, state } = expressionIn(
        "string<64> str;",
        "(str.char_count > 0) ? str.char_count : 0",
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.get("str")).toBe(2);
    });

    it("counts .char_count in comparison expressions", () => {
      const { expr, state } = expressionIn(
        "string<50> name;",
        "name.char_count = 10",
      );
      const counts = StringLengthCounter.countExpression(expr, state);

      expect(counts.get("name")).toBe(1);
    });
  });
});
