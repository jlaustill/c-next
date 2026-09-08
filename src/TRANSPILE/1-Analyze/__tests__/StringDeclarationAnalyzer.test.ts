import { afterEach, describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import StringDeclarationAnalyzer from "../StringDeclarationAnalyzer";

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
  const { tree } = CNextSourceParser.parse(source);
  return new StringDeclarationAnalyzer().analyze(tree);
};

const codes = (source: string) => errors(source).map((e) => e.code);
const inMain = (body: string) => `void f() {\n${body}\n}`;

afterEach(() => {
  CodeGenState.reset();
});

describe("StringDeclarationAnalyzer", () => {
  describe("E0862 -- a capacity has to be stated, or inferable", () => {
    it("requires an explicit capacity on a string ARRAY", () => {
      const [found] = errors("string[4] names;");
      expect(found.code).toBe("E0862");
      expect(found.message).toContain("string array requires an explicit");
    });

    it("requires one on a non-const string, which cannot infer", () => {
      const [found] = errors(inMain('    string s <- "hi";'));
      expect(found.code).toBe("E0862");
      expect(found.message).toContain("non-const string");
    });

    it("requires an initializer on a const string with no capacity", () => {
      const [found] = errors("const string s;");
      expect(found.code).toBe("E0862");
      expect(found.message).toContain("requires an initializer");
    });

    it("requires that initializer to be a LITERAL, not another string", () => {
      const [found] = errors(
        'const string<8> other <- "hi";\nconst string s <- other;',
      );
      expect(found.code).toBe("E0862");
      expect(found.message).toContain("requires a string literal");
    });

    it("accepts a const string whose capacity comes from its literal", () => {
      expect(codes('const string s <- "hello";')).toEqual([]);
    });
  });

  describe("E0863 -- at file scope, only a literal", () => {
    // Three throws collapsed into one rule: copying, concatenating and
    // extracting a substring all need a runtime call, and C makes none before
    // `main`. The shape of the initializer is the whole question.
    it("rejects a copy, a concatenation and a substring alike", () => {
      const source = [
        'const string<8> src <- "hi";',
        "string<16> copied <- src;",
        'string<16> joined <- src + "!";',
        "string<16> part <- src[0, 2];",
      ].join("\n");
      expect(codes(source)).toEqual(["E0863", "E0863", "E0863"]);
    });

    it("accepts the same three inside a function", () => {
      const source = [
        'const string<8> src <- "hi";',
        inMain(
          [
            "    string<16> copied <- src;",
            '    string<16> joined <- src + "!";',
            "    string<16> part <- src[0, 2];",
          ].join("\n"),
        ),
      ].join("\n");
      expect(codes(source)).toEqual([]);
    });

    it("accepts a literal at file scope", () => {
      expect(codes('string<16> greeting <- "hello";')).toEqual([]);
    });
  });

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
});
