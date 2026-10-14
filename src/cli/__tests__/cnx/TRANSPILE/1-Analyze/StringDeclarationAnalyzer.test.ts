import { describe, expect, it } from "vitest";

import StringDeclarationAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/StringDeclarationAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-045's string declaration rules -- E0862 (a capacity has to be
 * stated or inferable), E0863 (a file-scope string takes only a literal),
 * E0864 (the initializer has to fit), E0865 (a substring's bounds have to be
 * inside its source) -- replacing fourteen `StringDeclHelper` throws, the
 * largest single-file group this card moved.
 *
 * Three of those throws ("from a variable", "concatenation", "substring" at
 * global scope) were ONE rule about the initializer's FORM, which is why E0863
 * is a single check with three shapes exercised below.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new StringDeclarationAnalyzer(context).analyze(syntax);
};

const codes = (source: string) => errors(source).map((e) => e.code);
const inMain = (body: string) => `void f() {\n${body}\n}`;

describe("StringDeclarationAnalyzer", () => {
  describe("E0864 -- the initializer has to fit", () => {
    it("rejects a literal longer than the declared capacity", () => {
      const [found] = errors('string<4> s <- "hello";');
      expect(found.code).toBe("E0864");
      expect(found.message).toContain("(5 chars) exceeds string<4>");
    });

    it("rejects a WIDER source string, which may not fit at runtime", () => {
      const [found] = errors(
        'const string<16> src <- "hi";\n' + inMain("    string<4> s <- src;"),
      );
      expect(found.code).toBe("E0864");
      expect(found.message).toContain("from string<16>");
    });

    it("rejects a concatenation whose combined capacity overflows", () => {
      const [found] = errors(
        'const string<8> a <- "hi";\nconst string<8> b <- "yo";\n' +
          inMain("    string<8> s <- a + b;"),
      );
      expect(found.code).toBe("E0864");
      expect(found.message).toContain("requires capacity 16");
    });

    it("rejects a substring longer than the destination", () => {
      const [found] = errors(
        'const string<16> src <- "hi";\n' +
          inMain("    string<2> s <- src[0, 8];"),
      );
      expect(found.code).toBe("E0864");
      expect(found.message).toContain("Substring length 8 exceeds");
    });
  });

  describe("E0865 -- a substring stays inside its source", () => {
    it("rejects bounds that run past the source's capacity", () => {
      const [found] = errors(
        'const string<8> src <- "hi";\n' +
          inMain("    string<16> s <- src[6, 4];"),
      );
      expect(found.code).toBe("E0865");
      expect(found.message).toContain("[6, 4] exceed the source string<8>");
    });

    it("accepts bounds that end exactly at the capacity", () => {
      expect(
        codes(
          'const string<8> src <- "hi";\n' +
            inMain("    string<16> s <- src[4, 4];"),
        ),
      ).toEqual([]);
    });
  });

  it("stays silent on the forms ADR-045 allows", () => {
    const source = [
      'const string<8> src <- "hi";',
      'string<16> greeting <- "hello";',
      "string<32>[2] names;",
      inMain(
        [
          '    string<16> copied <- "ok";',
          "    string<16> fromVar <- src;",
          '    string<24> joined <- src + "!!";',
          "    string<8> part <- src[0, 4];",
          "    string<8> empty;",
        ].join("\n"),
      ),
    ].join("\n");
    expect(codes(source)).toEqual([]);
  });

  describe("what 1.2 reads, it leaves to 1.2 (#1991)", () => {
    it("judges a literal at file scope, and a string in a scope's method", () => {
      const source = [
        'string<1> greeting <- "hello";',
        "scope S {",
        "    public void f() {",
        '        string<1> s <- "hi";',
        "    }",
        "}",
      ].join("\n");
      expect(errors(source).map((e) => [e.code, e.line])).toEqual([
        ["E0864", 1],
        ["E0864", 4],
      ]);
    });
  });

  it("counts a literal operand of a concatenation by its length", () => {
    const found = errors(
      inMain('    string<2> src <- "hi";\n    string<3> joined <- src + "!!";'),
    );
    expect(found.map((e) => e.message)).toEqual([
      "String concatenation requires capacity 4, but the declaration is string<3>",
    ]);
  });

  it("reads a one-index substring as one character from that index", () => {
    expect(
      codes(inMain('    string<4> src <- "abcd";\n    string<1> c <- src[3];')),
    ).toEqual([]);
  });
});
