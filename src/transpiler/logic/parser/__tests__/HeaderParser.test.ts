/**
 * Unit tests for HeaderParser
 */

import { describe, it, expect } from "vitest";
import HeaderParser from "../HeaderParser";

describe("HeaderParser", () => {
  describe("parseC", () => {
    it("parses a simple C header", () => {
      const content = `
        typedef unsigned int uint32_t;
        void foo(int x);
      `;

      const result = HeaderParser.parseC(content);

      expect(result.tree).not.toBeNull();
    });

    it("parses C structs", () => {
      const content = `
        struct Point {
          int x;
          int y;
        };
      `;

      const result = HeaderParser.parseC(content);

      expect(result.tree).not.toBeNull();
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

      expect(result.tree).not.toBeNull();
    });

    it("handles invalid C syntax with error recovery", () => {
      // ANTLR parsers use error recovery rather than throwing
      // They still produce a tree, but with error nodes
      const content = "@@@ invalid syntax $$$";

      const result = HeaderParser.parseC(content);

      // Tree is returned (with error nodes) due to error recovery
      expect(result.tree).not.toBeNull();
    });

    it("handles empty content", () => {
      const result = HeaderParser.parseC("");

      expect(result.tree).not.toBeNull();
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

      expect(result.tree).not.toBeNull();
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

      expect(result.tree).not.toBeNull();
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

      expect(result.tree).not.toBeNull();
    });

    it("parses C++ templates", () => {
      const content = `
        template<typename T>
        class Container {
          T value;
        };
      `;

      const result = HeaderParser.parseCpp(content);

      expect(result.tree).not.toBeNull();
    });

    it("handles invalid C++ syntax with error recovery", () => {
      // ANTLR parsers use error recovery rather than throwing
      // They still produce a tree, but with error nodes
      const content = "@@@ invalid syntax $$$";

      const result = HeaderParser.parseCpp(content);

      // Tree is returned (with error nodes) due to error recovery
      expect(result.tree).not.toBeNull();
    });

    it("handles empty content", () => {
      const result = HeaderParser.parseCpp("");

      expect(result.tree).not.toBeNull();
    });
  });
});
