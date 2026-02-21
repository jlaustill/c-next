/**
 * Unit tests for ArrayIndexTypeAnalyzer
 * Tests detection of signed/float types used as array and bit subscript indexes (ADR-054)
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import ArrayIndexTypeAnalyzer from "../ArrayIndexTypeAnalyzer";

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

describe("ArrayIndexTypeAnalyzer", () => {
  // ========================================================================
  // Allowed types (0 errors expected)
  // ========================================================================

  describe("allowed unsigned types", () => {
    it("should allow u8 variable as array index", () => {
      const tree = parse(
        `void main() { u8[10] arr; u8 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should allow u16 variable as array index", () => {
      const tree = parse(
        `void main() { u8[10] arr; u16 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should allow u32 variable as array index", () => {
      const tree = parse(
        `void main() { u8[10] arr; u32 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should allow u64 variable as array index", () => {
      const tree = parse(
        `void main() { u8[10] arr; u64 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should allow bool variable as array index", () => {
      const tree = parse(
        `void main() { u8[2] arr; bool idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should allow integer literal as array index", () => {
      const tree = parse(`void main() { u8[10] arr; arr[3] <- 1; }`);
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should allow enum member as array index", () => {
      const tree = parse(`
        enum EColor { RED, GREEN, BLUE, COUNT }
        void main() { u8[4] arr; arr[EColor.RED] <- 1; }
      `);
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should allow unsigned for-loop variable as index", () => {
      const tree = parse(`
        void main() {
          u8[10] arr;
          for (u32 i <- 0; i < 10; i <- i + 1) {
            arr[i] <- 0;
          }
        }
      `);
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });

    it("should allow unsigned function parameter as index", () => {
      const tree = parse(`
        void setElement(u8[10] arr, u32 idx) {
          arr[idx] <- 1;
        }
      `);
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Rejected signed types (E0850)
  // ========================================================================

  describe("rejected signed types", () => {
    it("should reject i8 variable as array index", () => {
      const tree = parse(
        `void main() { u8[10] arr; i8 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i8");
      expect(errors[0].message).toContain("unsigned integer type");
      expect(errors[0].message).toContain("i8");
    });

    it("should reject i16 variable as array index", () => {
      const tree = parse(
        `void main() { u8[10] arr; i16 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i16");
    });

    it("should reject i32 variable as array index", () => {
      const tree = parse(
        `void main() { u8[10] arr; i32 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });

    it("should reject i64 variable as array index", () => {
      const tree = parse(
        `void main() { u8[10] arr; i64 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i64");
    });

    it("should reject signed for-loop variable as index", () => {
      const tree = parse(`
        void main() {
          u8[10] arr;
          for (i32 i <- 0; i < 10; i <- i + 1) {
            arr[i] <- 0;
          }
        }
      `);
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });

    it("should reject signed function parameter as index", () => {
      const tree = parse(`
        void setElement(u8[10] arr, i32 idx) {
          arr[idx] <- 1;
        }
      `);
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });
  });

  // ========================================================================
  // Rejected float types (E0851)
  // ========================================================================

  describe("rejected float types", () => {
    it("should reject f32 variable as array index", () => {
      const tree = parse(
        `void main() { u8[10] arr; f32 idx <- 0.0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0851");
      expect(errors[0].actualType).toBe("f32");
      expect(errors[0].message).toContain("unsigned integer type");
      expect(errors[0].message).toContain("f32");
    });

    it("should reject f64 variable as array index", () => {
      const tree = parse(
        `void main() { u8[10] arr; f64 idx <- 0.0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0851");
      expect(errors[0].actualType).toBe("f64");
    });
  });

  // ========================================================================
  // Bit indexing (same rules apply)
  // ========================================================================

  describe("bit indexing", () => {
    it("should reject signed type for single bit access", () => {
      const tree = parse(
        `void main() { u32 flags <- 0; i32 bit <- 0; u8 val <- flags[bit]; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
      expect(errors[0].actualType).toBe("i32");
    });

    it("should reject signed type for bit range start", () => {
      const tree = parse(
        `void main() { u32 flags <- 0; i32 start <- 0; u8 val <- flags[start, 4]; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
    });

    it("should reject signed type for bit range width", () => {
      const tree = parse(
        `void main() { u32 flags <- 0; i32 width <- 4; u8 val <- flags[0, width]; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
    });

    it("should allow unsigned type for bit access", () => {
      const tree = parse(
        `void main() { u32 flags <- 0; u8 bit <- 0; u8 val <- flags[bit]; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Edge cases
  // ========================================================================

  describe("edge cases", () => {
    it("should report multiple errors in same function", () => {
      const tree = parse(`
        void main() {
          u8[10] arr;
          i32 a <- 0;
          i32 b <- 1;
          arr[a] <- 1;
          arr[b] <- 2;
        }
      `);
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(2);
      expect(errors[0].code).toBe("E0850");
      expect(errors[1].code).toBe("E0850");
    });

    it("should pass through unresolvable expression (function call)", () => {
      const tree = parse(`
        u32 getIndex() { return 0; }
        void main() {
          u8[10] arr;
          arr[getIndex()] <- 1;
        }
      `);
      const analyzer = new ArrayIndexTypeAnalyzer();
      const errors = analyzer.analyze(tree);
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // getErrors() accessor
  // ========================================================================

  describe("getErrors accessor", () => {
    it("should access errors via getErrors method", () => {
      const tree = parse(
        `void main() { u8[10] arr; i32 idx <- 0; arr[idx] <- 1; }`,
      );
      const analyzer = new ArrayIndexTypeAnalyzer();
      analyzer.analyze(tree);

      const errors = analyzer.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0850");
    });
  });
});
