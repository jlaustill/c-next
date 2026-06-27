/**
 * Unit tests for ReturnPathAnalyzer
 * ADR-112 / Issue #1040: non-void functions must return a value on all paths.
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import ReturnPathAnalyzer from "../ReturnPathAnalyzer";

function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  return parser.program();
}

function analyze(source: string) {
  return new ReturnPathAnalyzer().analyze(parse(source));
}

describe("ReturnPathAnalyzer", () => {
  describe("flags non-void functions that can fall through (E0704)", () => {
    it("flags a function with no return at all", () => {
      const errors = analyze(`
        u8 getValue() {
          u8 x <- 123;
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0704");
      expect(errors[0].functionName).toBe("getValue");
    });

    it("flags an if without else", () => {
      const errors = analyze(`
        u8 f(bool ready) {
          if (ready = true) { return 1; }
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("flags an if/else where one branch does not return", () => {
      const errors = analyze(`
        u8 f(bool ready) {
          if (ready = true) { return 1; } else { u8 y <- 0; }
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("flags a switch without a default", () => {
      const errors = analyze(`
        u8 f(u8 code) {
          switch (code) {
            case 1 { return 10; }
            case 2 { return 20; }
          }
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("flags a switch where a case does not return", () => {
      const errors = analyze(`
        u8 f(u8 code) {
          switch (code) {
            case 1 { return 10; }
            default { u8 z <- 0; }
          }
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("flags a while loop body (may not execute)", () => {
      const errors = analyze(`
        u8 f(u8 start) {
          while (start > 0) { return start; }
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("flags a for loop body (may not execute)", () => {
      const errors = analyze(`
        u8 f() {
          for (u8 i <- 0; i < 3; i +<- 1) { return i; }
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("flags a bare `return;` in a non-void function", () => {
      const errors = analyze(`
        u8 f(bool done) {
          if (done = true) { return 5; }
          return;
        }
      `);
      expect(errors).toHaveLength(1);
    });
  });

  describe("accepts functions that return on all paths", () => {
    it("accepts a simple return", () => {
      expect(
        analyze(`
        u8 f() { return 1; }
      `),
      ).toHaveLength(0);
    });

    it("accepts if/else where both branches return", () => {
      expect(
        analyze(`
        u8 f(bool ready) {
          if (ready = true) { return 1; } else { return 0; }
        }
      `),
      ).toHaveLength(0);
    });

    it("accepts an else-if chain that returns on every branch", () => {
      expect(
        analyze(`
        u8 f(u8 n) {
          if (n = 0) { return 1; }
          else if (n = 1) { return 2; }
          else { return 3; }
        }
      `),
      ).toHaveLength(0);
    });

    it("accepts a switch with default where all paths return", () => {
      expect(
        analyze(`
        u8 f(u8 code) {
          switch (code) {
            case 1 { return 10; }
            case 2 { return 20; }
            default { return 0; }
          }
        }
      `),
      ).toHaveLength(0);
    });

    it("accepts a do-while whose body unconditionally returns", () => {
      expect(
        analyze(`
        u8 f() {
          do { return 7; } while (1 = 1);
        }
      `),
      ).toHaveLength(0);
    });

    it("accepts a loop followed by a trailing return (the canonical E0704 fix)", () => {
      // The loop never counts as a guaranteed return; the trailing return does.
      // This is the shape users will most often write to satisfy E0704, and it
      // guards against any future drift toward 'last statement must return'.
      expect(
        analyze(`
        u8 firstPositive(u8 n) {
          while (n > 0) { return n; }
          return 0;
        }
      `),
      ).toHaveLength(0);
    });

    it("accepts a return after other statements (later statements unreachable)", () => {
      expect(
        analyze(`
        u8 f() {
          u8 x <- 1;
          return x;
        }
      `),
      ).toHaveLength(0);
    });

    it("accepts a return nested in a critical block", () => {
      expect(
        analyze(`
        u8 f() {
          critical { return 1; }
        }
      `),
      ).toHaveLength(0);
    });

    it("does not flag a void function with no return", () => {
      expect(
        analyze(`
        void f() { u8 x <- 1; }
      `),
      ).toHaveLength(0);
    });
  });

  describe("treats `forever` as a divergent terminal path (ADR-113, the primitive #849 consumes)", () => {
    // A `forever` loop never exits (C-Next has no break/continue, ADR-026), so a
    // function whose terminal path is `forever` never falls through and must not
    // be flagged E0704. (In real programs `forever` is void-only via E0705 in
    // codegen; this is the shared divergence primitive ADR-114 reuses.)
    it("does not flag a function whose only path is a forever loop", () => {
      expect(
        analyze(`
        u8 f() {
          forever { u8 x <- 1; }
        }
      `),
      ).toHaveLength(0);
    });

    it("does not flag a forever loop after a non-returning if", () => {
      expect(
        analyze(`
        u8 f(bool ready) {
          if (ready = true) { return 1; }
          forever { u8 y <- 0; }
        }
      `),
      ).toHaveLength(0);
    });
  });
});
