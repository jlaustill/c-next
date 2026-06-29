/**
 * Unit tests for MixedTypeCategoryAnalyzer
 * Tests detection of binary operators combining mixed essential type categories
 * (MISRA C:2012 Rule 10.4, ADR-024 / Issue #1091).
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import MixedTypeCategoryAnalyzer from "../MixedTypeCategoryAnalyzer";

function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  return parser.program();
}

function analyze(source: string) {
  return new MixedTypeCategoryAnalyzer().analyze(parse(source));
}

describe("MixedTypeCategoryAnalyzer", () => {
  describe("mixed-category operands (rejected)", () => {
    it("rejects unsigned + signed (u32 + i32)", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          i32 b <- 2;
          u32 c <- a + b;
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0810");
      expect(errors[0].message).toContain("essential type categories");
    });

    it("rejects signed + unsigned (i32 + u32), order-independent", () => {
      const errors = analyze(`
        void main() {
          i32 a <- 1;
          u32 b <- 2;
          i32 c <- a + b;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("rejects a mixed comparison (u32 = i32)", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          i32 b <- 2;
          bool c <- (a = b);
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("rejects a mixed multiplication (u16 * i16)", () => {
      const errors = analyze(`
        void main() {
          u16 a <- 1;
          i16 b <- 2;
          u16 c <- a * b;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("rejects a mixed bitwise-or (u8 | i8)", () => {
      const errors = analyze(`
        void main() {
          u8 a <- 1;
          i8 b <- 2;
          u8 c <- a | b;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("rejects a mixed operand reached through parentheses and negation", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          i32 b <- 2;
          u32 c <- a + (-b);
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("reports the differing pair in a chain (u32 + u32 + i32)", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          u32 b <- 2;
          i32 c <- 3;
          u32 d <- a + b + c;
        }
      `);
      expect(errors).toHaveLength(1);
    });
  });

  describe("same-category and exempt operands (accepted)", () => {
    it("accepts same category (u32 + u32)", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          u32 b <- 2;
          u32 c <- a + b;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("accepts same category, different width (u8 + u32 widening)", () => {
      const errors = analyze(`
        void main() {
          u8 a <- 1;
          u32 b <- 2;
          u32 c <- a + b;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("accepts an unsigned variable plus an integer literal", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          u32 c <- a + 5;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("accepts the sanctioned bit-indexed reinterpretation (a + b[0, 32])", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 1;
          i32 b <- 2;
          u32 c <- a + b[0, 32];
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("accepts a single operand (no binary operator)", () => {
      const errors = analyze(`
        void main() {
          i32 b <- 2;
          i32 c <- b;
        }
      `);
      expect(errors).toHaveLength(0);
    });
  });

  describe("scope-aware variable typing (Issue #1085 review, Finding A)", () => {
    it("does not flag a valid same-category expression because a same-named variable of a different category exists in another function", () => {
      // main's `value` is u32; other's parameter `value` is i32. A flat,
      // file-wide name->type map (last write wins) made `base + value` in main
      // resolve `value` as i32 and falsely reject valid u32 + u32 code.
      const errors = analyze(`
        u32 main() {
          u32 base <- 1;
          u32 value <- 2;
          u32 result <- base + value;
          return 0;
        }
        i32 other(i32 value) {
          return value;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("flags the genuinely mixed expression in its own function, not masked by a same-named variable elsewhere", () => {
      // main's `value + delta` is u32 + i32 (mixed -> 1 error). other's
      // `value + value` is i32 + i32 (same category -> no error). A flat map
      // would mis-type main's `value` as i32 and MISS the real violation.
      const errors = analyze(`
        u32 main() {
          u32 value <- 1;
          i32 delta <- 2;
          u32 r <- value + delta;
          return 0;
        }
        void other(i32 value) {
          i32 x <- value + value;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("does not flag !a = !b — logical negation yields Boolean, not the operand category (Issue #1085)", () => {
      // `!a` and `!b` are both essentially Boolean regardless of a/b signedness,
      // so the comparison shares a category and Rule 10.4 must NOT fire. The old
      // code recursed through `!` and compared a's (unsigned) vs b's (signed)
      // category, falsely rejecting valid code.
      const errors = analyze(`
        void main() {
          u32 a <- 5;
          i32 b <- 3;
          bool r <- !a = !b;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("still flags a + b when operands differ in signedness (control for the ! fix)", () => {
      const errors = analyze(`
        void main() {
          u32 a <- 5;
          i32 b <- 3;
          i32 r <- a + b;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("isolates variables declared in different named scopes", () => {
      // Each scope's `count` has its own type; neither scope's expression is mixed.
      const errors = analyze(`
        scope A {
          u32 count <- 1;
          u32 total <- count + count;
        }
        scope B {
          i32 count <- 1;
          i32 total <- count + count;
        }
      `);
      expect(errors).toHaveLength(0);
    });
  });

  describe("shift operators (Rule 10.4 does not govern shifts)", () => {
    it("does not flag a left shift whose count is signed (u32 << i32)", () => {
      // Rule 10.4 only governs operators subject to the usual arithmetic
      // conversions; shifts are not (the count is promoted independently). A
      // signed shift COUNT is a Rule 10.1 concern, not 10.4, so E0810 must not
      // fire here (Issue #1085 review).
      const errors = analyze(`
        void main() {
          u32 value <- 256;
          i32 count <- 2;
          u32 r <- value << count;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("does not flag a right shift whose count is signed (u32 >> i32)", () => {
      const errors = analyze(`
        void main() {
          u32 value <- 256;
          i32 count <- 2;
          u32 r <- value >> count;
        }
      `);
      expect(errors).toHaveLength(0);
    });
  });

  describe("block-aware variable typing (Issue #1085 review)", () => {
    it("does not flag an outer expression when a different-category variable of the same name is declared in a nested block", () => {
      // The inner `i32 x` shadows only within the if-block. The outer `x + a`
      // (both u32) must not be poisoned by it. A function-wide last-write-wins
      // map mis-typed the outer `x` as i32 and falsely rejected valid code.
      const errors = analyze(`
        void main() {
          u32 x <- 1;
          u32 a <- 2;
          u32 r <- x + a;
          if (r > 0) {
            i32 x <- 5;
            i32 z <- x + x;
          }
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("does not flag an outer expression poisoned by a different-category for-loop variable", () => {
      const errors = analyze(`
        void main() {
          u32 i <- 1;
          u32 a <- 2;
          u32 r <- i + a;
          for (i32 i <- 0; i < 4; i <- i + 1) {
            a <- a + 1;
          }
        }
      `);
      expect(errors).toHaveLength(0);
    });
  });
});
