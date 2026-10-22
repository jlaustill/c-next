/**
 * Unit tests for StructFieldAnalyzer
 * Validates struct field names don't conflict with cnx reserved property names
 *
 * Note: ADR-058 removed "length" from reserved names since .length is deprecated.
 * Currently there are no reserved field names.
 */
import { describe, it, expect } from "vitest";
import CnxSourceParser from "../../../PARSE/2-Parse/CnxSourceParser";
import StructFieldAnalyzer from "../StructFieldAnalyzer";

/**
 * Helper to parse cnx code and return 1.2's syntax
 */
function parse(source: string) {
  return CnxSourceParser.parse(source).program;
}

describe("StructFieldAnalyzer", () => {
  describe("reserved field name detection (ADR-058: no reserved names)", () => {
    // ADR-058: "length" is no longer reserved since .length was deprecated
    it("should allow 'length' field name after ADR-058 deprecation", () => {
      const code = `
        struct MyStruct {
          u32 length;
        }
      `;
      const tree = parse(code);
      const analyzer = new StructFieldAnalyzer();
      const errors = analyzer.analyze(tree);

      // No errors since "length" is no longer reserved
      expect(errors).toHaveLength(0);
    });

    it("should allow any field names (no reserved names)", () => {
      const code = `
        struct Point {
          u32 x;
          u32 y;
          u32 count;
          u32 length;
          u32 size;
        }
      `;
      const tree = parse(code);
      const analyzer = new StructFieldAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
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

    it("should handle multiple structs", () => {
      const code = `
        struct Good {
          u32 x;
        }
        struct WithLength {
          u32 length;
        }
      `;
      const tree = parse(code);
      const analyzer = new StructFieldAnalyzer();
      const errors = analyzer.analyze(tree);

      // No errors since "length" is no longer reserved
      expect(errors).toHaveLength(0);
    });

    it("should be reusable across multiple analyze calls", () => {
      const analyzer = new StructFieldAnalyzer();

      const code1 = `struct A { u32 length; }`;
      const errors1 = analyzer.analyze(parse(code1));
      expect(errors1).toHaveLength(0);

      const code2 = `struct B { u32 count; }`;
      const errors2 = analyzer.analyze(parse(code2));
      expect(errors2).toHaveLength(0);
    });
  });
});
