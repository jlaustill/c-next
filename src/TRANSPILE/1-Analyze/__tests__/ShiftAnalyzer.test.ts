/**
 * Unit tests for ShiftAnalyzer
 * Tests detection of shift operators with signed integer types (E0805), and
 * of shift amounts outside the shifted operand's width (E0873, #1322).
 */
import { describe, it, expect } from "vitest";
import ShiftAnalyzer from "../ShiftAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";
import SymbolTable from "../../../PARSE/3-Declare/SymbolTable";
import TestSourceSpan from "../../../transpiler/types/__testUtils__/testSourceSpan";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";

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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag shift with integer literals", () => {
      const code = `
        void main() {
          u32 result <- 1 << 3;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors[0].helpText).toContain("undefined");
      expect(errors[0].helpText).toContain("unsigned types");
    });

    it("should report correct line number", () => {
      const code = `void main() {
  i32 x <- 5;
  i32 result <- x << 2;
}`;
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Struct Member Compound Shift-Assign (PR #1013 review feedback)
  // ========================================================================

  describe("struct member compound shift-assign", () => {
    it("should detect left shift compound-assign on signed struct field", () => {
      // #1668: this used to assert 0 errors, "because getStructFieldType
      // returns undefined without populated symbols" -- a test of the unit
      // harness's missing facts, contradicting its own title. With the real
      // program the field's i8 type is known and the rule fires, as it does
      // in production.
      const code = `
        struct Data { i8 val; }
        void main() {
          Data d <- {val: 1};
          d.val <<<- 2;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code);
      const errors = new ShiftAnalyzer(context).analyze(tree);
      expect(errors.map((e) => [e.code, e.line])).toEqual([["E0805", 5]]);
    });

    it("should not flag unsigned struct field shift", () => {
      const code = `
        struct Data { u8 val; }
        void main() {
          Data d <- {val: 1};
          d.val <<<- 2;
        }
      `;
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
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
      const { tree, context } = testAnalysisContextFor(code);
      const analyzer = new ShiftAnalyzer(context);
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0805");
      expect(errors[0].message).toContain("<<<-");
    });
  });
});

describe("ShiftAnalyzer -- E0873 shift amount (MISRA C:2012 Rule 12.2)", () => {
  const errors = (code: string) => {
    const { tree, context } = testAnalysisContextFor(code);
    return new ShiftAnalyzer(context).analyze(tree);
  };
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
    // `tests/bitwise/shift-width-uncovered-arms-error` asserts the struct
    // member arm, `d.value >><- 9`, end to end.
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

// #1668: every operand typed by the one operand typer
describe("ShiftAnalyzer -- operands typed by the one operand typer", () => {
  function analyze(source: string, symbolTable?: SymbolTable) {
    const { tree, context } = testAnalysisContextFor(source, { symbolTable });
    return new ShiftAnalyzer(context).analyze(tree);
  }

  it.each([
    ["a signed cast", "u32 w <- 1; u32 r <- (i32)w << 2;"],
    ["a signed element", "i32[2] v <- [1, 2]; i32 r <- v[0] << 2;"],
    ["a signed call result", "i32 r <- minusOne() << 2;"],
  ])("rejects %s (E0805)", (_why, body) => {
    const errors = analyze(
      `i32 minusOne() { return -1; } void main() { ${body} }`,
    );
    expect(errors.map((e) => e.code)).toEqual(["E0805"]);
  });

  it.each([
    [
      "a signed ternary condition",
      "i32 s <- 1; u32 a <- 1; u32 b <- 2; u32 r <- ((s > 0) ? a : b) << 2;",
    ],
    ["a negated composite", "u32 w <- 1; u32 r <- -(5 + w) << 2;"],
    ["a leading-zero amount (#1728)", "u32 w <- 1; u32 r <- w << 037;"],
  ])("accepts %s", (_why, body) => {
    expect(analyze(`void main() { ${body} }`)).toHaveLength(0);
  });

  it("rejects a signed C header operand, and checks a C operand's width", () => {
    const symbolTable = new SymbolTable();
    for (const [name, type] of [
      ["cSigned", "int"],
      ["cByte", "uint8_t"],
    ]) {
      symbolTable.addCSymbol({
        kind: "variable",
        name,
        type,
        sourceFile: "api.h",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      });
    }
    const errors = analyze(
      "void main() { u32 a <- cSigned << 2; u8 b <- cByte << 9; }",
      symbolTable,
    );
    expect(errors.map((e) => e.code)).toEqual(["E0805", "E0873"]);
  });
});
