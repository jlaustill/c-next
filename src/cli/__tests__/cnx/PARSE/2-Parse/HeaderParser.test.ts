/**
 * Unit tests for HeaderParser
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import HeaderParser from "../../../../../cnx/PARSE/2-Parse/HeaderParser";
import parseCHeader from "../../../../../lib/parseCHeader";

describe("HeaderParser", () => {
  describe("parseC", () => {
    it("parses a simple C header", () => {
      const content = `
        typedef unsigned int uint32_t;
        void foo(int x);
      `;

      const result = HeaderParser.parseC(content);

      expect(result.syntax).not.toBeNull();
    });

    it("parses C structs", () => {
      const content = `
        struct Point {
          int x;
          int y;
        };
      `;

      const result = HeaderParser.parseC(content);

      expect(result.syntax).not.toBeNull();
    });

    it("parses C enums", () => {
      const content = `
        enum Color {
          RED,
          GREEN,
          BLUE
        };
      `;

      const result = HeaderParser.parseC(content);

      expect(result.syntax).not.toBeNull();
    });

    it("handles invalid C syntax with error recovery", () => {
      // ANTLR parsers use error recovery rather than throwing
      // They still produce a tree, but with error nodes
      const content = "@@@ invalid syntax $$$";

      const result = HeaderParser.parseC(content);

      // Tree is returned (with error nodes) due to error recovery
      expect(result.syntax).not.toBeNull();
    });

    it("handles empty content", () => {
      const result = HeaderParser.parseC("");

      expect(result.syntax).not.toBeNull();
    });
  });

  describe("parseCpp", () => {
    it("parses a simple C++ header", () => {
      const content = `
        class Foo {
        public:
          void bar();
        };
      `;

      const result = HeaderParser.parseCpp(content);

      expect(result.syntax).not.toBeNull();
    });

    it("parses C++ typed enums", () => {
      const content = `
        enum class Color : unsigned char {
          RED,
          GREEN,
          BLUE
        };
      `;

      const result = HeaderParser.parseCpp(content);

      expect(result.syntax).not.toBeNull();
    });

    it("parses C++ namespaces", () => {
      const content = `
        namespace MyLib {
          class Widget {
          public:
            void draw();
          };
        }
      `;

      const result = HeaderParser.parseCpp(content);

      expect(result.syntax).not.toBeNull();
    });

    it("parses C++ templates", () => {
      const content = `
        template<typename T>
        class Container {
          T value;
        };
      `;

      const result = HeaderParser.parseCpp(content);

      expect(result.syntax).not.toBeNull();
    });

    it("handles invalid C++ syntax with error recovery", () => {
      // ANTLR parsers use error recovery rather than throwing
      // They still produce a tree, but with error nodes
      const content = "@@@ invalid syntax $$$";

      const result = HeaderParser.parseCpp(content);

      // Tree is returned (with error nodes) due to error recovery
      expect(result.syntax).not.toBeNull();
    });

    it("handles empty content", () => {
      const result = HeaderParser.parseCpp("");

      expect(result.syntax).not.toBeNull();
    });
  });

  // #1377: `getText()` joins specifiers with no separator, so a type NAME
  // containing `const` must not be read as the qualifier, in either language.
  describe.each([
    ["C", (content: string) => HeaderParser.parseC(content).syntax],
    ["C++", (content: string) => HeaderParser.parseCpp(content).syntax],
  ])("parameter const-ness from %s headers (#1377)", (_language, parse) => {
    it("reads const from the qualifier token, not from a type name", () => {
      const syntax = parse(`
        struct constants { int a; };
        typedef struct constants constants_t;
        void takes_plain_struct(struct constants c);
        void takes_typedef(constants_t c);
        void takes_real_const(const int x);
        void takes_plain(int y);
      `);

      const constness = [
        ...JSON.stringify(syntax).matchAll(
          /"name":"(\w+)","type":"[^"]*","isConst":(true|false)/g,
        ),
      ].map((match) => [match[1], match[2]]);

      expect(constness).toEqual([
        ["c", "false"],
        ["c", "false"],
        ["x", "true"],
        ["y", "false"],
      ]);
    });
  });

  // ========================================================================
  // Silence, on BOTH listeners and BOTH callers
  //
  // The doc comment justifies removing the parser's listeners by measurement.
  // The lexer's were removed only in `src/lib/parseCHeader`, which had its own
  // copy of this pipeline -- so an unrecognizable token printed to stderr on the
  // transpiler path and was silent on the IDE path (#1306 review). The copy is
  // gone; this is what stops the divergence coming back without anyone noticing.
  // ========================================================================

  describe("error listener suppression", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    // `@` and a backtick are outside the C lexer's alphabet, so they reach the
    // LEXER's listener -- not the parser's, which the older assertions covered.
    const rejectedByLexer = "int ok(void);\n@ `\nint also_ok(void);\n";

    it("parseC writes nothing to the console for a token the lexer rejects", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = HeaderParser.parseC(rejectedByLexer);

      expect(result.syntax).not.toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });

    it("parseCpp writes nothing to the console for a token the lexer rejects", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      HeaderParser.parseCpp("int ok(void);\n` `\n");

      expect(spy).not.toHaveBeenCalled();
    });

    it("the IDE symbol path is as silent as the transpiler path", () => {
      // Same input, same silence, because it is now the same parse. This is the
      // assertion that would have caught the divergence.
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = parseCHeader(rejectedByLexer, "probe.h");

      expect(spy).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.symbols.map((s) => s.name)).toEqual(["ok", "also_ok"]);
    });
  });
});
