/**
 * Basic formatting tests for the C-Next Prettier plugin
 */

import * as prettier from "prettier";
import * as path from "path";

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
