/**
 * Unit tests for SignedShiftAnalyzer
 * Tests detection of shift operators with signed integer types
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import SignedShiftAnalyzer from "../SignedShiftAnalyzer";

/**
 * Helper to parse C-Next code and return the AST
 */
function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  return parser.program();
}

describe("SignedShiftAnalyzer", () => {
  // ========================================================================
  // Signed Variable Left Shift Detection
  // ========================================================================

  describe("signed variable left shift", () => {
    it("should detect left shift with i8 left operand", () => {
      const code = `
        void main() {
          i8 x <- 5;
          i8 result <- x << 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
      expect(errors[0].message).toContain("Shift operator '<<'");
      expect(errors[0].message).toContain("signed integer types");
    });

    it("should detect left shift with i16 left operand", () => {
      const code = `
        void main() {
          i16 x <- 100;
          i16 result <- x << 3;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
    });

    it("should detect left shift with i32 left operand", () => {
      const code = `
        void main() {
          i32 x <- 1000;
          i32 result <- x << 4;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
    });

    it("should detect left shift with i64 left operand", () => {
      const code = `
        void main() {
          i64 x <- 10000;
          i64 result <- x << 5;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
    });
  });

  // ========================================================================
  // Signed Variable Right Shift Detection
  // ========================================================================

  describe("signed variable right shift", () => {
    it("should detect right shift with i8 left operand", () => {
      const code = `
        void main() {
          i8 x <- -64;
          i8 result <- x >> 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
      expect(errors[0].message).toContain("Shift operator '>>'");
    });

    it("should detect right shift with i32 left operand", () => {
      const code = `
        void main() {
          i32 x <- -1000;
          i32 result <- x >> 4;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
    });
  });

  // ========================================================================
  // Function Parameters
  // ========================================================================

  describe("function parameters", () => {
    it("should detect shift with i32 parameter", () => {
      const code = `
        void compute(i32 value) {
          i32 result <- value << 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
    });

    it("should detect shift with i64 parameter", () => {
      const code = `
        void compute(i64 value) {
          i64 result <- value >> 3;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
    });
  });

  // ========================================================================
  // For Loop Variables
  // ========================================================================

  describe("for loop variables", () => {
    it("should detect shift with signed for-loop variable", () => {
      const code = `
        void main() {
          for (i32 i <- 1; i < 10; i <- i + 1) {
            i32 shifted <- i << 1;
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
    });
  });

  // ========================================================================
  // Valid Unsigned Shifts
  // ========================================================================

  describe("valid unsigned shifts", () => {
    it("should not flag shift with u8 operand", () => {
      const code = `
        void main() {
          u8 x <- 5;
          u8 result <- x << 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag shift with u16 operand", () => {
      const code = `
        void main() {
          u16 x <- 100;
          u16 result <- x >> 3;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag shift with u32 operand", () => {
      const code = `
        void main() {
          u32 x <- 1000;
          u32 result <- x << 4;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag shift with u64 operand", () => {
      const code = `
        void main() {
          u64 x <- 10000;
          u64 result <- x >> 5;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag shift with integer literals", () => {
      const code = `
        void main() {
          u32 result <- 1 << 3;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Negative Literals
  // ========================================================================

  describe("negative literals", () => {
    it("should detect shift with negative literal", () => {
      const code = `
        void main() {
          i32 result <- -5 << 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
    });
  });

  // ========================================================================
  // Error Details
  // ========================================================================

  describe("error details", () => {
    it("should provide helpful help text", () => {
      const code = `
        void main() {
          i32 x <- 5;
          i32 result <- x << 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].helpText).toContain("undefined");
      expect(errors[0].helpText).toContain("unsigned types");
    });

    it("should report correct line number", () => {
      const code = `void main() {
  i32 x <- 5;
  i32 result <- x << 2;
}`;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].line).toBe(3);
    });
  });

  // ========================================================================
  // Multiple Errors
  // ========================================================================

  describe("multiple errors", () => {
    it("should detect multiple signed shift operations", () => {
      const code = `
        void main() {
          i32 a <- 5;
          i32 b <- a << 2;
          i64 c <- 100;
          i64 d <- c >> 3;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(2);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe("edge cases", () => {
    it("should handle empty program", () => {
      const code = ``;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should handle program with no shift operations", () => {
      const code = `
        void main() {
          i32 x <- 5 + 3;
          i32 y <- 10 - 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag other bitwise operations on signed types", () => {
      const code = `
        void main() {
          i32 a <- 5;
          i32 b <- 3;
          i32 c <- a & b;
          i32 d <- a | b;
          i32 e <- a ^ b;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Parenthesized Expressions
  // ========================================================================

  describe("parenthesized expressions", () => {
    it("should detect shift with signed variable in parentheses", () => {
      const code = `
        void main() {
          i32 x <- 5;
          i32 result <- (x) << 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
    });

    it("should not flag unsigned variable in parentheses", () => {
      const code = `
        void main() {
          u32 x <- 5;
          u32 result <- (x) << 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new SignedShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });
});
