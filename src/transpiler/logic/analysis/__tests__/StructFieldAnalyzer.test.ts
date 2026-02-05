/**
 * Unit tests for StructFieldAnalyzer
 * Validates struct field names don't conflict with C-Next reserved property names
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import StructFieldAnalyzer from "../StructFieldAnalyzer";

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

describe("StructFieldAnalyzer", () => {
  describe("reserved field name detection", () => {
    it("should detect reserved field name 'length'", () => {
      const code = `
        struct MyStruct {
          u32 length;
        }
      `;
      const tree = parse(code);
      const analyzer = new StructFieldAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0355");
      expect(errors[0].fieldName).toBe("length");
      expect(errors[0].structName).toBe("MyStruct");
    });

    it("should not flag non-reserved field names", () => {
      const code = `
        struct Point {
          u32 x;
          u32 y;
          u32 count;
        }
      `;
      const tree = parse(code);
      const analyzer = new StructFieldAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should detect reserved field among multiple fields", () => {
      const code = `
        struct Data {
          u32 count;
          u32 length;
          u32 size;
        }
      `;
      const tree = parse(code);
      const analyzer = new StructFieldAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].fieldName).toBe("length");
      expect(errors[0].structName).toBe("Data");
    });
  });

  describe("error details", () => {
    it("should report correct error code and message format", () => {
      const code = `
        struct Buffer {
          u32 length;
        }
      `;
      const tree = parse(code);
      const analyzer = new StructFieldAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].code).toBe("E0355");
      expect(errors[0].message).toContain("reserved C-Next property name");
      expect(errors[0].message).toContain("'length'");
      expect(errors[0].message).toContain("'Buffer'");
    });

    it("should provide help text with alternatives", () => {
      const code = `
        struct Buffer {
          u32 length;
        }
      `;
      const tree = parse(code);
      const analyzer = new StructFieldAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].helpText).toContain("Reserved field names:");
      expect(errors[0].helpText).toContain("length");
      expect(errors[0].helpText).toContain("len");
      expect(errors[0].helpText).toContain("size");
      expect(errors[0].helpText).toContain("count");
    });

    it("should report correct line and column", () => {
      const code = `struct S {
  u32 length;
}`;
      const tree = parse(code);
      const analyzer = new StructFieldAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].line).toBe(2);
      expect(errors[0].column).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty program", () => {
      const code = ``;
      const tree = parse(code);
      const analyzer = new StructFieldAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should handle multiple structs with mixed fields", () => {
      const code = `
        struct Good {
          u32 x;
        }
        struct Bad {
          u32 length;
        }
      `;
      const tree = parse(code);
      const analyzer = new StructFieldAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].structName).toBe("Bad");
    });

    it("should be reusable across multiple analyze calls", () => {
      const analyzer = new StructFieldAnalyzer();

      const code1 = `struct A { u32 length; }`;
      const errors1 = analyzer.analyze(parse(code1));
      expect(errors1).toHaveLength(1);

      const code2 = `struct B { u32 count; }`;
      const errors2 = analyzer.analyze(parse(code2));
      expect(errors2).toHaveLength(0);
    });
  });
});
