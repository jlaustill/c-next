/**
 * Unit tests for ShiftAnalyzer
 * Tests detection of shift operators with signed integer types (E0805), and
 * of shift amounts outside the shifted operand's width (E0873, #1322).
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../../transpiler/logic/parser/grammar/CNextLexer";
import { CNextParser } from "../../../transpiler/logic/parser/grammar/CNextParser";
import ShiftAnalyzer from "../ShiftAnalyzer";

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

describe("ShiftAnalyzer", () => {
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
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
      const analyzer = new ShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Compound Shift-Assign (Issue #1008)
  // ========================================================================

  describe("compound shift-assign (issue #1008)", () => {
    it("should detect left shift compound-assign with i8 target", () => {
      const code = `
        void main() {
          i8 x <- 1;
          x <<<- 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new ShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
      expect(errors[0].message).toContain("Shift operator '<<<-'");
      expect(errors[0].message).toContain("signed integer types");
    });

    it("should detect right shift compound-assign with i8 target", () => {
      const code = `
        void main() {
          i8 x <- 64;
          x >><- 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new ShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
      expect(errors[0].message).toContain("Shift operator '>><-'");
    });

    it("should detect left shift compound-assign with i16 target", () => {
      const code = `
        void main() {
          i16 x <- 1;
          x <<<- 4;
        }
      `;
      const tree = parse(code);
      const analyzer = new ShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
    });

    it("should detect left shift compound-assign with i32 target", () => {
      const code = `
        void main() {
          i32 x <- 1;
          x <<<- 8;
        }
      `;
      const tree = parse(code);
      const analyzer = new ShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
    });

    it("should detect left shift compound-assign with i64 target", () => {
      const code = `
        void main() {
          i64 x <- 1;
          x <<<- 16;
        }
      `;
      const tree = parse(code);
      const analyzer = new ShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
    });

    it("should not flag left shift compound-assign with u8 target", () => {
      const code = `
        void main() {
          u8 x <- 1;
          x <<<- 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new ShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag right shift compound-assign with u32 target", () => {
      const code = `
        void main() {
          u32 x <- 256;
          x >><- 4;
        }
      `;
      const tree = parse(code);
      const analyzer = new ShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should detect multiple compound shift-assign violations", () => {
      const code = `
        void main() {
          i8 a <- 1;
          a <<<- 2;
          i16 b <- 64;
          b >><- 3;
        }
      `;
      const tree = parse(code);
      const analyzer = new ShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(2);
      expect(errors[0].message).toContain("<<<-");
      expect(errors[1].message).toContain(">><-");
    });

    it("should not flag other compound-assign operators on signed types", () => {
      const code = `
        void main() {
          i32 x <- 10;
          x +<- 5;
          x -<- 2;
          x *<- 3;
          x /<- 2;
          x %<- 3;
          x &<- 0xFF;
          x |<- 0x0F;
          x ^<- 0xAA;
        }
      `;
      const tree = parse(code);
      const analyzer = new ShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Struct Member Compound Shift-Assign (PR #1013 review feedback)
  // ========================================================================

  describe("struct member compound shift-assign", () => {
    it("should detect left shift compound-assign on signed struct field", () => {
      // Note: This requires CodeGenState.symbols to have struct field info
      // In real usage, symbols are populated during transpilation
      // For unit tests without symbols, we rely on the integration tests
      const code = `
        struct Data { i8 val; }
        void main() {
          Data d <- {val: 1};
          d.val <<<- 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new ShiftAnalyzer();
      // Without CodeGenState.symbols populated, this won't detect the issue
      // The integration test covers this case
      const errors = analyzer.analyze(tree);
      // This returns 0 because CodeGenState.getStructFieldType returns undefined
      // without populated symbols. The integration test verifies the full path.
      expect(errors).toHaveLength(0);
    });

    it("should not flag unsigned struct field shift", () => {
      const code = `
        struct Data { u8 val; }
        void main() {
          Data d <- {val: 1};
          d.val <<<- 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new ShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should still detect simple signed variable shift alongside struct access", () => {
      const code = `
        struct Data { u8 val; }
        void main() {
          Data d <- {val: 1};
          i8 x <- 1;
          x <<<- 2;
        }
      `;
      const tree = parse(code);
      const analyzer = new ShiftAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
      expect(errors[0].message).toContain("<<<-");
    });
  });
});

describe("ShiftAnalyzer -- E0873 shift amount (MISRA C:2012 Rule 12.2)", () => {
  const errors = (code: string) => new ShiftAnalyzer().analyze(parse(code));
  const inMain = (body: string) => `void main() {\n    u8 a <- 1;\n${body}\n}`;

  it("rejects an amount at or beyond the width, at the amount's position", () => {
    const found = errors(inMain("    u8 b <- a << 8;"));
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0873");
    expect(found[0].line).toBe(3);
    expect(found[0].column).toBeGreaterThan(10);
    expect(found[0].message).toContain(
      "Shift amount (8) exceeds type width (8 bits) for type 'u8'",
    );
  });

  it("rejects a negative amount", () => {
    const found = errors(inMain("    u8 b <- a >> -1;"));
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("Negative shift amount (-1)");
  });

  it("accepts the last legal amount, zero, and every width", () => {
    const source = [
      "void main() {",
      "    u8 a <- 1;",
      "    u16 b <- 1;",
      "    u32 c <- 1;",
      "    u64 d <- 1;",
      "    u8 r1 <- a << 7;",
      "    u16 r2 <- b << 15;",
      "    u32 r3 <- c << 31;",
      "    u64 r4 <- d << 63;",
      "    u8 r5 <- a >> 0;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("rejects the compound forms, which codegen never checked", () => {
    // REGRESSION. `a <<<- 9` on a u8 emitted `a = (uint8_t)(a << 9U)`.
    const found = errors(inMain("    a <<<- 9;\n    a >><- 8;\n    a <<<- 7;"));
    expect(found.map((e) => [e.code, e.line])).toEqual([
      ["E0873", 3],
      ["E0873", 4],
    ]);
  });

  it("reads a hex, binary or suffixed literal amount", () => {
    const found = errors(
      inMain(
        "    u8 b <- a << 0x10;\n    u8 c <- a << 0b1000;\n    u8 d <- a << 8u8;",
      ),
    );
    expect(found).toHaveLength(3);
  });

  it("stays silent on a runtime amount, a literal left operand and a composite", () => {
    // A literal has no declared width; `(a + 1)` is a composite, untyped here
    // as it was in codegen -- reproduced, not widened.
    const source = [
      "void main(u8 s) {",
      "    u8 a <- 1;",
      "    u8 b <- a << s;",
      "    u8 c <- 1 << 9;",
      "    u8 d <- (a + 1) << 9;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("reports the signed rule and not the width rule on a signed operand", () => {
    // One diagnostic per shift: a signed operand is E0805's, whatever the
    // amount, so the two rules never both fire on the same operator.
    const found = errors(
      "void main() {\n    i8 a <- 1;\n    i8 b <- a << 9;\n}",
    );
    expect(found.map((e) => e.code)).toEqual(["E0805"]);
  });

  it("types an array element through the shared resolver", () => {
    // A struct member needs the per-file symbol view, which a unit test does
    // not build; `tests/bitwise/shift-width-uncovered-arms-error` asserts
    // `d.value >><- 9` end to end.
    const source = [
      "void main() {",
      "    u8[4] arr <- [1, 2, 3, 4];",
      "    u8 c <- arr[0] << 8;",
      "    arr[1] <<<- 8;",
      "}",
    ].join("\n");
    expect(errors(source).map((e) => e.line)).toEqual([3, 4]);
  });
});
