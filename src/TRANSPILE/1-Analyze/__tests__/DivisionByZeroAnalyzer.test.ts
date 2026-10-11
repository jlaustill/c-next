/**
 * Unit tests for DivisionByZeroAnalyzer
 * Tests detection of division and modulo by zero at compile time (ADR-051)
 */
import { describe, it, expect } from "vitest";
import DivisionByZeroAnalyzer from "../DivisionByZeroAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

describe("DivisionByZeroAnalyzer", () => {
  // ========================================================================
  // Phase 1: Literal Zero Detection
  // ========================================================================

  describe("literal zero detection", () => {
    it("should detect division by literal zero", () => {
      const code = `
        void main() {
          u32 x <- 10 / 0;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0800");
      expect(errors[0].operator).toBe("/");
      expect(errors[0].message).toBe("Division by zero");
    });

    it("should detect modulo by literal zero", () => {
      const code = `
        void main() {
          u32 x <- 10 % 0;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0802");
      expect(errors[0].operator).toBe("%");
      expect(errors[0].message).toBe("Modulo by zero");
    });

    it("should detect hex zero (0x0)", () => {
      const code = `
        void main() {
          u32 x <- 10 / 0x0;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0800");
    });

    it("should detect binary zero (0b0)", () => {
      const code = `
        void main() {
          u32 x <- 10 / 0b0;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0800");
    });

    it("should not flag division by non-zero literal", () => {
      const code = `
        void main() {
          u32 x <- 10 / 2;
          u32 y <- 20 % 3;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag multiplication by zero", () => {
      const code = `
        void main() {
          u32 x <- 10 * 0;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Phase 3: Const Zero Detection
  // ========================================================================

  describe("const zero detection", () => {
    it("should detect division by const zero variable", () => {
      const code = `
        const u32 ZERO <- 0;
        void main() {
          u32 x <- 10 / ZERO;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0800");
    });

    it("should detect modulo by const zero variable", () => {
      const code = `
        const u32 ZERO <- 0;
        void main() {
          u32 x <- 10 % ZERO;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0802");
    });

    it("should not flag division by non-zero const", () => {
      const code = `
        const u32 DIVISOR <- 5;
        void main() {
          u32 x <- 10 / DIVISOR;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    // #1664 box 7: a const's value is the one visible at the division
    it.each([
      [
        "a const folded from an expression",
        "const u32 V <- 5 - 5;\nvoid main() {\n  u32 x <- 10 / V;\n}",
        1,
      ],
      [
        "a local zero does not reach another function's global",
        "const u32 D <- 4;\nvoid first() {\n  const u32 D <- 0;\n  u32 y <- D;\n}\nvoid second() {\n  u32 x <- 10 / D;\n}",
        0,
      ],
      [
        "an inner block's zero does not outlive the block",
        "const u32 D <- 4;\nvoid main() {\n  u32 y <- 0;\n  {\n    const u32 D <- 0;\n    y <- D;\n  }\n  u32 x <- 10 / D;\n}",
        0,
      ],
      [
        "a float const zero (#1010)",
        "const f32 Z <- 0.0;\nvoid main() {\n  f32 x <- 10.0 / Z;\n}",
        1,
      ],
      [
        "a suffixed const zero",
        "const u32 Z <- 0u32;\nvoid main() {\n  u32 x <- 10 / Z;\n}",
        1,
      ],
      [
        "a local zero is zero where it is visible",
        "const u32 D <- 4;\nvoid main() {\n  const u32 D <- 0;\n  u32 x <- 10 / D;\n}",
        1,
      ],
      // #1268: every spelling of a name binds where the bare one does
      [
        "a this.-qualified const zero",
        "scope S {\n  const u32 Z <- 0;\n  public u32 go(u32 n) {\n    return n / this.Z;\n  }\n}",
        1,
      ],
      [
        "a global.-qualified const zero",
        "const u32 Z <- 0;\nscope S {\n  public u32 go(u32 n) {\n    return n % global.Z;\n  }\n}",
        1,
      ],
      [
        "a Scope.-qualified const zero",
        "scope S {\n  public const u32 Z <- 0;\n}\nu32 go(u32 n) {\n  return n / S.Z;\n}",
        1,
      ],
      [
        "a global.Scope.-qualified const zero",
        "scope S {\n  public const u32 Z <- 0;\n}\nu32 go(u32 n) {\n  return n / global.S.Z;\n}",
        1,
      ],
      [
        "a this.-qualified float const zero",
        "scope S {\n  const f32 Z <- 0.0;\n  public f32 go(f32 k) {\n    return k / this.Z;\n  }\n}",
        1,
      ],
      [
        "a Scope.-qualified float const zero",
        "scope S {\n  public const f32 Z <- 0.0;\n}\nf32 go(f32 k) {\n  return k / S.Z;\n}",
        1,
      ],
      [
        "global. names the file's nonzero const, not the scope's zero",
        "const u32 Z <- 7;\nscope S {\n  const u32 Z <- 0;\n  public u32 go(u32 n) {\n    return n / global.Z;\n  }\n}",
        0,
      ],
      [
        "this. names the scope's nonzero const, not the file's zero",
        "const u32 Z <- 0;\nscope S {\n  const u32 Z <- 7;\n  public u32 go(u32 n) {\n    return n / this.Z;\n  }\n}",
        0,
      ],
      [
        "a qualified float const that is not zero",
        "scope S {\n  public const f32 Z <- 0.5;\n}\nf32 go(f32 k) {\n  return k / S.Z;\n}",
        0,
      ],
    ])("%s", (_why, code, expected) => {
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const errors = new DivisionByZeroAnalyzer(context).analyze(tree);
      expect(errors).toHaveLength(expected);
    });

    it("should not flag division by non-const variable", () => {
      const code = `
        u32 divisor <- 0;
        void main() {
          u32 x <- 10 / divisor;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      // Non-const variables are not tracked (runtime value)
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Multiple Errors
  // ========================================================================

  describe("multiple errors", () => {
    it("should detect multiple division by zero errors", () => {
      const code = `
        void main() {
          u32 a <- 10 / 0;
          u32 b <- 20 % 0;
          u32 c <- 30 / 0;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(3);
      expect(errors[0].code).toBe("E0800"); // division
      expect(errors[1].code).toBe("E0802"); // modulo
      expect(errors[2].code).toBe("E0800"); // division
    });
  });

  // ========================================================================
  // Chained Expressions
  // ========================================================================

  describe("chained expressions", () => {
    it("should detect zero in chained division", () => {
      const code = `
        void main() {
          u32 x <- 10 / 2 / 0;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0800");
    });
  });

  // ========================================================================
  // Error Details
  // ========================================================================

  describe("error details", () => {
    it("should provide helpful text for division by zero", () => {
      const code = `
        void main() {
          u32 x <- 10 / 0;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors[0].helpText).toContain("safe_div");
    });

    it("should provide helpful text for modulo by zero", () => {
      const code = `
        void main() {
          u32 x <- 10 % 0;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors[0].helpText).toContain("safe_mod");
    });

    it("should report correct line and column", () => {
      const code = `void main() {
  u32 x <- 10 / 0;
}`;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors[0].line).toBe(2);
      // Column should point to the zero operand
      expect(errors[0].column).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Suffixed Literals
  // ========================================================================

  describe("suffixed literals", () => {
    it("should detect suffixed decimal zero (0u32)", () => {
      const code = `
        void main() {
          u32 x <- 10 / 0u32;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0800");
    });

    it("should not flag suffixed non-zero (5u32)", () => {
      const code = `
        void main() {
          u32 x <- 10 / 5u32;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe("edge cases", () => {
    it("should handle empty program", () => {
      const code = ``;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should handle program with no division operations", () => {
      const code = `
        void main() {
          u32 x <- 5 + 3;
          u32 y <- 10 - 2;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not detect zero with unary prefix on divisor", () => {
      const code = `
        void main() {
          i32 x <- 10 / -1;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      // Unary prefix causes postfixExpression() to be null in isZero
      expect(errors).toHaveLength(0);
    });

    it("should detect zero in parenthesized expression divisor", () => {
      const code = `
        void main() {
          u32 x <- 10 / (0);
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const analyzer = new DivisionByZeroAnalyzer(context);
      const errors = analyzer.analyze(tree);

      // A compile-time constant divisor, by the one evaluator (ADR-051)
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0800");
    });
  });

  // #1268 review: an enum operand is E0810's (not a number), whatever its value
  describe("enum operands", () => {
    it.each(["RED", "GREEN"])("leaves n / EColor.%s to E0810", (member) => {
      const code = `
        enum EColor { RED, GREEN }
        void main() {
          u32 n <- 10;
          u32 x <- n / EColor.${member};
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const errors = new DivisionByZeroAnalyzer(context).analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // #1268 review: safe_div is the help only where a statement can call it
  describe("help outside a statement", () => {
    it("says the divisor must not be zero in an array dimension", () => {
      const code = `
        u8[4 / (2 - 2)] g;
        void main() {}
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const errors = new DivisionByZeroAnalyzer(context).analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].helpText).toBe(
        "A divisor known at compile time must not be zero",
      );
    });
  });

  // A literal is zero by its value, whatever its spelling (#1664 box 7)
  describe("literal spellings", () => {
    it.each([
      ["0x00", 1],
      ["0x00u8", 1],
      ["0b000i16", 1],
      ["0.0", 1],
      ["0.0f32", 1],
      [".0", 1],
      ["0e0", 1],
      ["0x10", 0],
      ["0.5f64", 0],
    ])("k / %s reports %i error(s)", (literal, count) => {
      const code = `
        void main() {
          f64 k <- 1.0;
          f64 x <- k / ${literal};
        }
      `;
      const { tree, context } = testAnalysisContextFor(code, {
        cppMode: false,
      });
      const errors = new DivisionByZeroAnalyzer(context).analyze(tree);

      expect(errors).toHaveLength(count);
    });
  });
});
