import { describe, expect, it } from "vitest";

import CNextSourceParser from "../CNextSourceParser";

/**
 * ADR-045's string declaration forms, which 1.2 reports (#1322, #1991): E0862
 * (a capacity has to be stated or inferable) and E0863 (a file-scope string
 * takes only a literal). Whether an initializer fits is 2.1's.
 */
const errors = (source: string) =>
  CNextSourceParser.parse(source)
    .formErrors.filter((e) => /^error\[E086[23]\]/.test(e.message))
    .map((e) => ({
      code: /E086[23]/.exec(e.message)![0],
      line: e.line,
      column: e.column,
      message: e.message,
    }));

const codes = (source: string) => errors(source).map((e) => e.code);
const inMain = (body: string) => `void f() {\n${body}\n}`;

describe("StringForm", () => {
  describe("E0862 -- a capacity has to be stated, or inferable", () => {
    it("requires an explicit capacity on a string ARRAY", () => {
      const [found] = errors("string[4] names;");
      expect(found.code).toBe("E0862");
      expect(found.message).toContain("string array requires an explicit");
    });

    it("requires one on a `mut` string, which cannot infer", () => {
      const [found] = errors(inMain('    mut string s <- "hi";'));
      expect(found.code).toBe("E0862");
      expect(found.message).toContain("A `mut` string");
    });

    it("requires an initializer on a read-only string with no capacity", () => {
      const [found] = errors("string s;");
      expect(found.code).toBe("E0862");
      expect(found.message).toContain("requires an initializer");
    });

    it("requires that initializer to be a LITERAL, not another string", () => {
      const [found] = errors('string<8> other <- "hi";\nstring s <- other;');
      expect(found.code).toBe("E0862");
      expect(found.message).toContain("requires a string literal");
    });

    it("accepts a read-only string whose capacity comes from its literal", () => {
      expect(codes('string s <- "hello";')).toEqual([]);
    });
  });

  describe("E0863 -- at file scope, only a literal", () => {
    // Three throws collapsed into one rule: copying, concatenating and
    // extracting a substring all need a runtime call, and C makes none before
    // `main`. The shape of the initializer is the whole question.
    it("rejects a copy, a concatenation and a substring alike", () => {
      const source = [
        'string<8> src <- "hi";',
        "string<16> copied <- src;",
        'string<16> joined <- src + "!";',
        "string<16> part <- src[0, 2];",
      ].join("\n");
      expect(codes(source)).toEqual(["E0863", "E0863", "E0863"]);
    });

    it("accepts the same three inside a function", () => {
      const source = [
        'string<8> src <- "hi";',
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

  describe("a literal is the literal itself, not text in quotes", () => {
    it("rejects inferring a capacity from two literals added", () => {
      const [found] = errors('string s <- "ab" + "cd";');
      expect(found.code).toBe("E0862");
      expect(found.message).toContain("requires a string literal");
    });

    it("rejects two literals added at file scope, spelled as written", () => {
      expect(errors('string<8> s <- "ab" + "cd";')).toEqual([
        {
          code: "E0863",
          line: 1,
          column: 15,
          message: expect.stringContaining(`not '"ab" + "cd"'`),
        },
      ]);
    });

    it("counts a scope's method as inside a function", () => {
      const source = [
        'string<8> src <- "hi";',
        "scope S {",
        "    public void f() {",
        "        string<16> copied <- src;",
        "    }",
        "    string<16> member <- src;",
        "}",
      ].join("\n");
      expect(errors(source).map((e) => [e.code, e.line])).toEqual([
        ["E0863", 6],
      ]);
    });
  });

  it("leaves a sized string array at file scope to the array rules", () => {
    expect(codes('string<8>[2] NAMES <- ["a", "b"];')).toEqual([]);
  });
});
