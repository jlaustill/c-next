/**
 * Basic formatting tests for the C-Next Prettier plugin
 */

import * as prettier from "prettier";
import * as path from "node:path";

const pluginPath = path.resolve(__dirname, "../dist/index.js");

async function format(code: string): Promise<string> {
  return prettier.format(code, {
    parser: "cnext",
    plugins: [pluginPath],
    tabWidth: 4,
  });
}

describe("C-Next Prettier Plugin", () => {
  describe("Variable declarations", () => {
    it("should format variable declarations with proper spacing", async () => {
      const input = "u32 x<-5;";
      const expected = "u32 x <- 5;\n";
      expect(await format(input)).toBe(expected);
    });

    it("should handle const and volatile modifiers", async () => {
      const input = "const u8 MAX<-255;";
      const expected = "const u8 MAX <- 255;\n";
      expect(await format(input)).toBe(expected);
    });
  });

  describe("Functions", () => {
    it("should format function declarations with same-line braces", async () => {
      const input = "void main(){}";
      const expected = "void main() {}\n";
      expect(await format(input)).toBe(expected);
    });

    it("should indent function body with 4 spaces", async () => {
      const input = "void main(){u32 x<-1;}";
      const expected = `void main() {
    u32 x <- 1;
}
`;
      expect(await format(input)).toBe(expected);
    });

    it("should format function parameters", async () => {
      const input = "u32 add(u32 a,u32 b){return a+b;}";
      const expected = `u32 add(u32 a, u32 b) {
    return a + b;
}
`;
      expect(await format(input)).toBe(expected);
    });
  });

  describe("Control flow", () => {
    it("should format if statements with blocks", async () => {
      const input = "void test(){if(x>5){y<-1;}}";
      const expected = `void test() {
    if (x > 5) {
        y <- 1;
    }
}
`;
      expect(await format(input)).toBe(expected);
    });

    it("should preserve single-statement if without braces", async () => {
      const input = "void test(){if(x>5)return 1;}";
      const expected = `void test() {
    if (x > 5) return 1;
}
`;
      expect(await format(input)).toBe(expected);
    });

    it("should format for loops with blocks", async () => {
      const input = "void test(){for(u32 i<-0;i<10;i+<-1){sum+<-i;}}";
      const expected = `void test() {
    for (u32 i <- 0; i < 10; i +<- 1) {
        sum +<- i;
    }
}
`;
      expect(await format(input)).toBe(expected);
    });
  });

  describe("Scopes", () => {
    it("should format scope declarations", async () => {
      const input =
        "scope Motor{u8 speed<-0;public void setSpeed(u8 s){this.speed<-s;}}";
      const expected = `scope Motor {
    u8 speed <- 0;
    public void setSpeed(u8 s) {
        this.speed <- s;
    }
}
`;
      expect(await format(input)).toBe(expected);
    });
  });

  describe("Comments", () => {
    it("should preserve line comments", async () => {
      const input = `// This is a comment
u32 x <- 5;`;
      const result = await format(input);
      expect(result).toContain("// This is a comment");
    });

    it("should preserve block comments", async () => {
      const input = `/* Block comment */
u32 x <- 5;`;
      const result = await format(input);
      expect(result).toContain("/* Block comment */");
    });
  });

  describe("Structs", () => {
    it("should format struct declarations", async () => {
      const input = "struct Point{u32 x;u32 y;}";
      const expected = `struct Point {
    u32 x;
    u32 y;
}
`;
      expect(await format(input)).toBe(expected);
    });
  });

  describe("Enums", () => {
    it("should format enum declarations", async () => {
      const input = "enum Color{RED<-0,GREEN<-1,BLUE<-2}";
      const expected = `enum Color {
    RED <- 0,
    GREEN <- 1,
    BLUE <- 2
}
`;
      expect(await format(input)).toBe(expected);
    });
  });

  describe("Array dimensions", () => {
    it("should preserve empty array dimensions in parameters", async () => {
      const input = "u32 main(string args[]){return 0;}";
      const expected = `u32 main(string args[]) {
    return 0;
}
`;
      expect(await format(input)).toBe(expected);
    });

    it("should preserve sized array dimensions in parameters", async () => {
      const input = "void process(u8 data[10]){return;}";
      const expected = `void process(u8 data[10]) {
    return;
}
`;
      expect(await format(input)).toBe(expected);
    });

    it("should handle multi-dimensional arrays", async () => {
      const input = "void matrix(u32 m[3][3]){return;}";
      const expected = `void matrix(u32 m[3][3]) {
    return;
}
`;
      expect(await format(input)).toBe(expected);
    });
  });

  describe("Nested templates", () => {
    it("keeps the space that stops >> lexing as a right shift", async () => {
      const input = "Container<Pair<Element, Element> > nestedPair;";
      const result = await format(input);
      // `>>` would lex as a shift operator, making the output unparseable.
      expect(result).not.toContain(">>");
      expect(result).toContain("Element> >");
      // The strongest form of the assertion: the output must re-parse.
      await expect(format(result)).resolves.toBe(result);
    });
  });

  describe("Comment placement", () => {
    it("keeps a trailing comment on its own statement", async () => {
      const input = "u32 f() {\n    return 1; // one\n}\n";
      const result = await format(input);
      expect(result).toContain("return 1; // one");
    });

    it("does not migrate a comment across an operator", async () => {
      const input = "u32 f() {\n    return 1 /* c */ + 2;\n}\n";
      const once = await format(input);
      expect(once).toContain("1 /* c */ + 2");
      expect(await format(once)).toBe(once);
    });

    it("keeps a comment before a closing brace inside the block", async () => {
      const input = "u32 f() {\n    u32 a <- 1;\n    // done\n}\n";
      const result = await format(input);
      expect(result).toContain("    // done\n}");
    });
  });

  describe("Comments the review found being lost (#1372)", () => {
    it("keeps a comment anchored to a bit-range comma", async () => {
      const input =
        "u32 main() {\n    u32 v <- flags[0, /* width */ 4];\n    return 0;\n}\n";
      const result = await format(input);
      expect(result).toContain("flags[0, /* width */ 4]");
    });

    it("keeps a comment anchored to a bit-range comma in a write position", async () => {
      const input = "void main() {\n    flags[0, /* width */ 4] <- 3;\n}\n";
      const result = await format(input);
      expect(result).toContain("flags[0, /* width */ 4]");
    });

    it("does not merge two line comments in an argument list", async () => {
      const input =
        "void main() {\n    helper(\n        1, // first\n        2 // second\n    );\n}\n";
      const result = await format(input);
      // A flat layout deferred both to the same newline, nesting the second
      // comment inside the first: `helper(1, 2); // first // second`.
      expect(result).toContain("// first");
      expect(result).toContain("// second");
      expect(result).not.toContain("// first // second");
      expect(await format(result)).toBe(result);
    });

    it("keeps a comment on a struct initializer trailing comma", async () => {
      const input =
        "struct Point { u32 x; u32 y; }\nvoid main() {\n    Point p <- {\n        x: 10,\n        y: 20, // the last one\n    };\n}\n";
      const result = await format(input);
      expect(result).toContain("// the last one");
      expect(await format(result)).toBe(result);
    });

    it("keeps a comment on an array initializer trailing comma", async () => {
      const input =
        "void main() {\n    u8[3] a <- [\n        1,\n        2,\n        3, // last element\n    ];\n}\n";
      const result = await format(input);
      expect(result).toContain("// last element");
      expect(await format(result)).toBe(result);
    });

    it("is idempotent for a block comment after an opening brace", async () => {
      // The classification used to depend on where the formatter put the line
      // breaks, so pass 2 read this comment as leading rather than trailing.
      for (const input of [
        "enum EColor { /* colors */ RED <- 0, GREEN, BLUE }\n",
        "struct P { /* 2D */ u32 x; u32 y; }\n",
        "void main() { /* body */ u32 x <- 1; }\n",
        "enum EColor { RED, GREEN /* last */ }\n",
      ]) {
        const once = await format(input);
        expect(await format(once)).toBe(once);
      }
    });

    it("does not synthesize a register-member comma the author omitted", async () => {
      const input =
        "register GPIO @ 0x40020000 {\n    moder: u32 rw @ 0x00\n}\n";
      const result = await format(input);
      expect(result).toContain("moder: u32 rw @ 0x00");
      expect(result).not.toContain("0x00,");
    });
  });

  describe("Blank line preservation", () => {
    it("should preserve blank lines between statements in blocks", async () => {
      const input = `void test() {
    u32 a <- 1;

    u32 b <- 2;
}`;
      const result = await format(input);
      // Should have a blank line between the two variable declarations
      expect(result).toContain("u32 a <- 1;\n\n    u32 b <- 2;");
    });

    it("should not add blank lines where none exist", async () => {
      const input = `void test() {
    u32 a <- 1;
    u32 b <- 2;
}`;
      const result = await format(input);
      // Should have only single newline between statements
      expect(result).toContain("u32 a <- 1;\n    u32 b <- 2;");
    });
  });
});
