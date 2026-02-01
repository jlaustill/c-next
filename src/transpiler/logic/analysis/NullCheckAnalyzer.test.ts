/**
 * Unit tests for NullCheckAnalyzer
 * Tests NULL safety enforcement for C library interop (ADR-046)
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../parser/grammar/CNextLexer";
import { CNextParser } from "../parser/grammar/CNextParser";
import NullCheckAnalyzer from "./NullCheckAnalyzer";

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

describe("NullCheckAnalyzer", () => {
  // ========================================================================
  // E0901: Missing null check on nullable C functions
  // ========================================================================

  describe("E0901 - missing null check", () => {
    it("should detect unchecked strchr call", () => {
      const code = `
        void main() {
          cstring str <- "hello";
          strchr(str, 'x');
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0901");
      expect(errors[0].functionName).toBe("strchr");
      expect(errors[0].message).toContain("can return NULL");
    });

    it("should detect unchecked strstr call", () => {
      const code = `
        void main() {
          cstring str <- "hello world";
          strstr(str, "world");
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0901");
      expect(errors[0].functionName).toBe("strstr");
    });

    it("should detect unchecked getenv call", () => {
      const code = `
        void main() {
          getenv("PATH");
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0901");
      expect(errors[0].functionName).toBe("getenv");
    });

    it("should not flag nullable function in equality comparison", () => {
      const code = `
        void main() {
          cstring str <- "hello";
          if (strchr(str, 'x') != NULL) {
            // valid
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag nullable function stored with c_ prefix", () => {
      const code = `
        void main() {
          cstring str <- "hello";
          cstring c_result <- strchr(str, 'x');
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // E0902: Forbidden functions (dynamic allocation - ADR-003)
  // ========================================================================

  describe("E0902 - forbidden functions", () => {
    it("should detect malloc usage", () => {
      const code = `
        void main() {
          malloc(100);
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0902");
      expect(errors[0].functionName).toBe("malloc");
      expect(errors[0].message).toContain("forbidden");
    });

    it("should detect calloc usage", () => {
      const code = `
        void main() {
          calloc(10, 4);
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0902");
      expect(errors[0].functionName).toBe("calloc");
    });

    it("should detect realloc usage", () => {
      const code = `
        void main() {
          cstring c_ptr <- strchr("test", 't');
          realloc(c_ptr, 200);
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // Should have E0902 for realloc
      const reallocErrors = errors.filter((e) => e.code === "E0902");
      expect(reallocErrors).toHaveLength(1);
      expect(reallocErrors[0].functionName).toBe("realloc");
    });

    it("should detect free usage", () => {
      const code = `
        void main() {
          cstring c_ptr <- strchr("test", 't');
          free(c_ptr);
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      const freeErrors = errors.filter((e) => e.code === "E0902");
      expect(freeErrors).toHaveLength(1);
      expect(freeErrors[0].functionName).toBe("free");
    });
  });

  // ========================================================================
  // E0903: NULL outside comparison context
  // ========================================================================

  describe("E0903 - NULL outside comparison", () => {
    it("should detect NULL in assignment", () => {
      const code = `
        void main() {
          cstring c_ptr <- NULL;
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0903");
      expect(errors[0].message).toContain("comparison context");
    });

    it("should not flag NULL in equality comparison (!=)", () => {
      const code = `
        void main() {
          cstring c_ptr <- strchr("test", 't');
          if (c_ptr != NULL) {
            // valid
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag NULL in equality comparison (=)", () => {
      const code = `
        void main() {
          cstring c_ptr <- strchr("test", 't');
          if (c_ptr = NULL) {
            // valid - checking if NULL
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // E0904: Invalid storage of nullable result
  // ========================================================================

  describe("E0904 - invalid storage", () => {
    it("should detect assignment to non-c_ variable", () => {
      const code = `
        void main() {
          cstring result <- strchr("test", 't');
          result <- strchr("test", 'x');
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // First declaration should get E0905 (missing c_ prefix)
      // Second assignment should get E0904
      const e0904Errors = errors.filter((e) => e.code === "E0904");
      expect(e0904Errors).toHaveLength(1);
      expect(e0904Errors[0].message).toContain("Cannot store");
    });

    it("should allow reassignment to c_ variable", () => {
      const code = `
        void main() {
          cstring c_result <- strchr("test", 't');
          c_result <- strchr("test", 'x');
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // E0905: Missing c_ prefix for nullable C type
  // ========================================================================

  describe("E0905 - missing c_ prefix", () => {
    it("should detect missing c_ prefix for strchr result", () => {
      const code = `
        void main() {
          cstring result <- strchr("test", 't');
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0905");
      expect(errors[0].message).toContain("Missing 'c_' prefix");
    });

    it("should detect missing c_ prefix for fopen result", () => {
      const code = `
        void main() {
          FILE file <- fopen("test.txt", "r");
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0905");
      expect(errors[0].functionName).toBe("fopen");
    });

    it("should not flag variable with c_ prefix", () => {
      const code = `
        void main() {
          cstring c_result <- strchr("test", 't');
          FILE c_file <- fopen("test.txt", "r");
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // E0906: Invalid c_ prefix on non-nullable type
  // ========================================================================

  describe("E0906 - invalid c_ prefix", () => {
    it("should detect c_ prefix on u32 type", () => {
      const code = `
        void main() {
          u32 c_count <- 10;
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0906");
      expect(errors[0].message).toContain("non-nullable type");
    });

    it("should detect c_ prefix on i32 type", () => {
      const code = `
        void main() {
          i32 c_value <- -5;
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0906");
    });

    it("should not flag c_ prefix on nullable cstring type", () => {
      const code = `
        void main() {
          cstring c_str <- strchr("test", 't');
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag c_ prefix on FILE type", () => {
      const code = `
        void main() {
          FILE c_file <- fopen("test.txt", "r");
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // E0907: NULL comparison on non-nullable variable
  // ========================================================================

  describe("E0907 - NULL comparison on non-nullable", () => {
    it("should detect NULL comparison on regular variable", () => {
      const code = `
        void main() {
          cstring str <- "hello";
          if (str = NULL) {
            // invalid
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0907");
      expect(errors[0].message).toContain("non-nullable variable");
    });

    it("should not flag NULL comparison on c_ variable", () => {
      const code = `
        void main() {
          cstring c_str <- strchr("hello", 'x');
          if (c_str = NULL) {
            // valid
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // E0908: c_ variable used without NULL check (flow analysis)
  // ========================================================================

  describe("E0908 - unchecked c_ variable usage", () => {
    it("should detect unchecked c_ variable passed to function", () => {
      const code = `
        void process(cstring s) { }
        void main() {
          cstring c_result <- strchr("test", 't');
          process(c_result);
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0908");
      expect(errors[0].message).toContain("without NULL check");
    });

    it("should not flag c_ variable after != NULL check", () => {
      const code = `
        void process(cstring s) { }
        void main() {
          cstring c_result <- strchr("test", 't');
          if (c_result != NULL) {
            process(c_result);
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should not flag c_ variable after guard clause", () => {
      const code = `
        void process(cstring s) { }
        u32 main() {
          cstring c_result <- strchr("test", 't');
          if (c_result = NULL) {
            return 1;
          }
          process(c_result);
          return 0;
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Static Methods
  // ========================================================================

  describe("static methods", () => {
    describe("hasNullablePrefix", () => {
      it("should return true for c_ prefixed names", () => {
        expect(NullCheckAnalyzer.hasNullablePrefix("c_result")).toBe(true);
        expect(NullCheckAnalyzer.hasNullablePrefix("c_file")).toBe(true);
        expect(NullCheckAnalyzer.hasNullablePrefix("c_ptr")).toBe(true);
      });

      it("should return false for non-prefixed names", () => {
        expect(NullCheckAnalyzer.hasNullablePrefix("result")).toBe(false);
        expect(NullCheckAnalyzer.hasNullablePrefix("file")).toBe(false);
        expect(NullCheckAnalyzer.hasNullablePrefix("ptr")).toBe(false);
      });

      it("should return false for partial prefix", () => {
        expect(NullCheckAnalyzer.hasNullablePrefix("c")).toBe(false);
        expect(NullCheckAnalyzer.hasNullablePrefix("cresult")).toBe(false);
      });
    });

    describe("isNullableCType", () => {
      it("should return true for FILE type", () => {
        expect(NullCheckAnalyzer.isNullableCType("FILE")).toBe(true);
      });

      it("should return true for cstring type", () => {
        expect(NullCheckAnalyzer.isNullableCType("cstring")).toBe(true);
      });

      it("should return true for pointer types", () => {
        expect(NullCheckAnalyzer.isNullableCType("char*")).toBe(true);
        expect(NullCheckAnalyzer.isNullableCType("void*")).toBe(true);
      });

      it("should return false for primitive types", () => {
        expect(NullCheckAnalyzer.isNullableCType("u32")).toBe(false);
        expect(NullCheckAnalyzer.isNullableCType("i32")).toBe(false);
        expect(NullCheckAnalyzer.isNullableCType("f32")).toBe(false);
        expect(NullCheckAnalyzer.isNullableCType("bool")).toBe(false);
      });
    });

    describe("isNullableFunction", () => {
      it("should return true for nullable C functions", () => {
        expect(NullCheckAnalyzer.isNullableFunction("strchr")).toBe(true);
        expect(NullCheckAnalyzer.isNullableFunction("strstr")).toBe(true);
        expect(NullCheckAnalyzer.isNullableFunction("fopen")).toBe(true);
        expect(NullCheckAnalyzer.isNullableFunction("getenv")).toBe(true);
        expect(NullCheckAnalyzer.isNullableFunction("memchr")).toBe(true);
      });

      it("should return false for non-nullable functions", () => {
        expect(NullCheckAnalyzer.isNullableFunction("strlen")).toBe(false);
        expect(NullCheckAnalyzer.isNullableFunction("printf")).toBe(false);
        expect(NullCheckAnalyzer.isNullableFunction("memcpy")).toBe(false);
      });
    });

    describe("isForbiddenFunction", () => {
      it("should return true for forbidden allocation functions", () => {
        expect(NullCheckAnalyzer.isForbiddenFunction("malloc")).toBe(true);
        expect(NullCheckAnalyzer.isForbiddenFunction("calloc")).toBe(true);
        expect(NullCheckAnalyzer.isForbiddenFunction("realloc")).toBe(true);
        expect(NullCheckAnalyzer.isForbiddenFunction("free")).toBe(true);
      });

      it("should return false for allowed functions", () => {
        expect(NullCheckAnalyzer.isForbiddenFunction("strchr")).toBe(false);
        expect(NullCheckAnalyzer.isForbiddenFunction("fopen")).toBe(false);
        expect(NullCheckAnalyzer.isForbiddenFunction("strlen")).toBe(false);
      });
    });

    describe("getNullableFunctionInfo", () => {
      it("should return metadata for known nullable functions", () => {
        const info = NullCheckAnalyzer.getNullableFunctionInfo("strchr");
        expect(info).not.toBeNull();
        expect(info?.header).toBe("string.h");
        expect(info?.nullMeaning).toBe("Character not found");
      });

      it("should return null for unknown functions", () => {
        const info = NullCheckAnalyzer.getNullableFunctionInfo("strlen");
        expect(info).toBeNull();
      });
    });

    describe("getStructPointerFunctions", () => {
      it("should return file-related functions", () => {
        const funcs = NullCheckAnalyzer.getStructPointerFunctions();
        expect(funcs.has("fopen")).toBe(true);
        expect(funcs.has("freopen")).toBe(true);
        expect(funcs.has("tmpfile")).toBe(true);
      });

      it("should not include string functions", () => {
        const funcs = NullCheckAnalyzer.getStructPointerFunctions();
        expect(funcs.has("strchr")).toBe(false);
        expect(funcs.has("strstr")).toBe(false);
      });
    });
  });

  // ========================================================================
  // All Nullable C Functions Coverage
  // ========================================================================

  describe("nullable C function coverage", () => {
    const nullableFunctions = [
      { name: "fgets", args: "(buf, 100, c_file)" },
      { name: "fputs", args: '("test", c_file)' },
      { name: "fgetc", args: "(c_file)" },
      { name: "fputc", args: "('x', c_file)" },
      { name: "gets", args: "(buf)" },
      { name: "fopen", args: '("test.txt", "r")' },
      { name: "freopen", args: '("test.txt", "r", c_file)' },
      { name: "tmpfile", args: "()" },
      { name: "strstr", args: '("hello", "ll")' },
      { name: "strchr", args: "(\"hello\", 'l')" },
      { name: "strrchr", args: "(\"hello\", 'l')" },
      { name: "memchr", args: "(\"hello\", 'l', 5)" },
      { name: "getenv", args: '("PATH")' },
    ];

    for (const func of nullableFunctions) {
      it(`should detect unchecked ${func.name} call`, () => {
        const code = `
          void main() {
            u8[100] buf;
            FILE c_file <- fopen("test.txt", "r");
            if (c_file != NULL) {
              ${func.name}${func.args};
            }
          }
        `;
        const tree = parse(code);
        const analyzer = new NullCheckAnalyzer();
        const errors = analyzer.analyze(tree);

        // fopen is properly stored with c_ prefix, so we should only get E0901 for unchecked func
        const e0901Errors = errors.filter((e) => e.code === "E0901");
        expect(e0901Errors.length).toBeGreaterThanOrEqual(1);
        expect(e0901Errors.some((e) => e.functionName === func.name)).toBe(
          true,
        );
      });
    }
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe("edge cases", () => {
    it("should handle empty program", () => {
      const code = ``;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should handle program with no null-related code", () => {
      const code = `
        void main() {
          u32 x <- 5;
          u32 y <- x + 10;
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should handle multiple errors in same function", () => {
      const code = `
        void main() {
          strchr("a", 'a');
          strstr("b", "b");
          getenv("X");
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(3);
      expect(errors.every((e) => e.code === "E0901")).toBe(true);
    });

    it("should provide correct line numbers", () => {
      const code = `void main() {
  strchr("test", 't');
}`;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].line).toBe(2);
    });
  });

  // ========================================================================
  // Include Header Tracking
  // ========================================================================

  describe("include tracking", () => {
    it("should track stdio.h include", () => {
      const code = `
        #include <stdio.h>
        void main() { }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      analyzer.analyze(tree);

      expect(analyzer.hasStdioIncluded()).toBe(true);
    });

    it("should return false when stdio.h not included", () => {
      const code = `
        void main() { }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      analyzer.analyze(tree);

      expect(analyzer.hasStdioIncluded()).toBe(false);
    });

    it("should track quoted include", () => {
      const code = `
        #include "stdio.h"
        void main() { }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      analyzer.analyze(tree);

      expect(analyzer.hasStdioIncluded()).toBe(true);
    });
  });

  // ========================================================================
  // While-Loop Flow Analysis (E0908)
  // ========================================================================

  describe("while-loop flow analysis", () => {
    it("should not flag c_ variable in while (c_var != NULL) body", () => {
      const code = `
        void process(cstring s) { }
        void main() {
          cstring c_line <- fgets(buf, 100, c_file);
          while (c_line != NULL) {
            process(c_line);
            c_line <- fgets(buf, 100, c_file);
          }
        }
        u8[100] buf;
        FILE c_file <- fopen("test.txt", "r");
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // Should not have E0908 for c_line inside while body
      const e0908Errors = errors.filter((e) => e.code === "E0908");
      expect(e0908Errors).toHaveLength(0);
    });

    it("should flag c_ variable after while loop exits", () => {
      const code = `
        void process(cstring s) { }
        void main() {
          cstring c_line <- fgets(buf, 100, c_file);
          while (c_line != NULL) {
            c_line <- fgets(buf, 100, c_file);
          }
          process(c_line);
        }
        u8[100] buf;
        FILE c_file <- fopen("test.txt", "r");
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // After while exits, c_line could be NULL (loop terminated), should flag
      const e0908Errors = errors.filter((e) => e.code === "E0908");
      expect(e0908Errors).toHaveLength(1);
    });

    it("should handle while without null check condition", () => {
      const code = `
        void main() {
          u32 i <- 0;
          while (i < 10) {
            i <- i + 1;
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should handle nested while loops", () => {
      const code = `
        void process(cstring s) { }
        void main() {
          cstring c_outer <- strchr("abc", 'a');
          while (c_outer != NULL) {
            cstring c_inner <- strchr("xyz", 'x');
            while (c_inner != NULL) {
              process(c_inner);
              c_inner <- strchr("xyz", 'y');
            }
            process(c_outer);
            c_outer <- strchr("abc", 'b');
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // Both variables should be checked within their respective while bodies
      const e0908Errors = errors.filter((e) => e.code === "E0908");
      expect(e0908Errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Guard Clause Variations
  // ========================================================================

  describe("guard clause variations", () => {
    it("should NOT mark checked when guard clause has else branch", () => {
      const code = `
        void process(cstring s) { }
        u32 main() {
          cstring c_result <- strchr("test", 't');
          if (c_result = NULL) {
            return 1;
          } else {
            return 2;
          }
          process(c_result);
          return 0;
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // With else branch, guard clause doesn't guarantee variable is checked after
      // However, the code after if-else is unreachable, so this is a bit of an edge case
      // The analyzer should still flag if process(c_result) is reachable
      const e0908Errors = errors.filter((e) => e.code === "E0908");
      expect(e0908Errors).toHaveLength(1);
    });

    it("should mark checked after guard clause without return", () => {
      const code = `
        void error_handler() { }
        void process(cstring s) { }
        void main() {
          cstring c_result <- strchr("test", 't');
          if (c_result = NULL) {
            error_handler();
          }
          process(c_result);
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // Without return in guard clause, variable is NOT marked as checked
      const e0908Errors = errors.filter((e) => e.code === "E0908");
      expect(e0908Errors).toHaveLength(1);
    });

    it("should handle multiple guard clauses", () => {
      const code = `
        void process(cstring s, cstring t) { }
        u32 main() {
          cstring c_a <- strchr("test", 't');
          cstring c_b <- strstr("hello", "ll");
          if (c_a = NULL) {
            return 1;
          }
          if (c_b = NULL) {
            return 2;
          }
          process(c_a, c_b);
          return 0;
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // Both variables should be checked after their respective guard clauses
      const e0908Errors = errors.filter((e) => e.code === "E0908");
      expect(e0908Errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Nested If Statements
  // ========================================================================

  describe("nested if statements", () => {
    it("should handle nested if without null check", () => {
      const code = `
        void main() {
          u32 x <- 5;
          if (x > 3) {
            if (x < 10) {
              x <- x + 1;
            }
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });

    it("should track null check state in nested if", () => {
      const code = `
        void process(cstring s) { }
        void main() {
          cstring c_result <- strchr("test", 't');
          u32 flag <- 1;
          if (flag > 0) {
            if (c_result != NULL) {
              process(c_result);
            }
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // c_result is checked in the inner if, so no E0908
      const e0908Errors = errors.filter((e) => e.code === "E0908");
      expect(e0908Errors).toHaveLength(0);
    });

    it("should handle deeply nested if with null check", () => {
      const code = `
        void process(cstring s) { }
        void main() {
          cstring c_result <- strchr("test", 't');
          u32 flag <- 1;
          if (flag > 0) {
            if (c_result != NULL) {
              process(c_result);
            }
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // c_result is checked in nested if body, so no error there
      const e0908Errors = errors.filter((e) => e.code === "E0908");
      expect(e0908Errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Reassignment Resets State
  // ========================================================================

  describe("reassignment state reset", () => {
    it("should reset state to unchecked after reassignment from nullable", () => {
      const code = `
        void process(cstring s) { }
        void main() {
          cstring c_result <- strchr("test", 't');
          if (c_result != NULL) {
            process(c_result);
            c_result <- strchr("test", 'x');
            process(c_result);
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // After reassignment, c_result is unchecked again
      const e0908Errors = errors.filter((e) => e.code === "E0908");
      expect(e0908Errors).toHaveLength(1);
    });

    it("should track multiple reassignments correctly", () => {
      const code = `
        void process(cstring s) { }
        u32 main() {
          cstring c_result <- strchr("test", 'a');
          if (c_result = NULL) { return 1; }
          process(c_result);

          c_result <- strchr("test", 'b');
          if (c_result = NULL) { return 2; }
          process(c_result);

          c_result <- strchr("test", 'c');
          if (c_result = NULL) { return 3; }
          process(c_result);

          return 0;
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // Each reassignment is followed by a guard clause, so all are safe
      const e0908Errors = errors.filter((e) => e.code === "E0908");
      expect(e0908Errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Multiple Functions with Separate Scopes
  // ========================================================================

  describe("function scope isolation", () => {
    it("should track variables independently per function", () => {
      const code = `
        void process(cstring s) { }

        void func1() {
          cstring c_a <- strchr("test", 't');
          if (c_a != NULL) {
            process(c_a);
          }
        }

        void func2() {
          cstring c_b <- strchr("test", 't');
          process(c_b);
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // func1's c_a is checked, func2's c_b is not
      const e0908Errors = errors.filter((e) => e.code === "E0908");
      expect(e0908Errors).toHaveLength(1);
      expect(e0908Errors[0].functionName).toBe("c_b");
    });

    it("should reset scope tracking between functions", () => {
      const code = `
        void process(cstring s) { }

        void func1() {
          cstring c_ptr <- strchr("a", 'a');
          if (c_ptr != NULL) {
            process(c_ptr);
          }
        }

        void func2() {
          cstring c_ptr <- strchr("b", 'b');
          if (c_ptr != NULL) {
            process(c_ptr);
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // Both functions properly check their c_ptr
      const e0908Errors = errors.filter((e) => e.code === "E0908");
      expect(e0908Errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Complex Expressions
  // ========================================================================

  describe("complex expressions", () => {
    it("should detect nullable function as standalone call in expression", () => {
      const code = `
        void main() {
          cstring str <- "test";
          strchr(str, 't');
          strstr(str, "es");
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // Both strchr and strstr results are not checked or stored
      const e0901Errors = errors.filter((e) => e.code === "E0901");
      expect(e0901Errors).toHaveLength(2);
    });

    it("should handle nullable function with complex arguments", () => {
      const code = `
        void main() {
          u8[100] buf;
          cstring str <- "hello world";
          strstr(str + 6, "or");
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // strstr called without storing/checking result
      const e0901Errors = errors.filter((e) => e.code === "E0901");
      expect(e0901Errors).toHaveLength(1);
    });

    it("should handle multiple nullable calls in one statement", () => {
      const code = `
        void main() {
          cstring a <- "test";
          if (strchr(a, 't') != NULL && strstr(a, "es") != NULL) {
            // both checked
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // Both are in comparison context
      expect(errors).toHaveLength(0);
    });

    it("should detect forbidden function in variable declaration", () => {
      const code = `
        void main() {
          cstring c_ptr <- malloc(100);
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // malloc is detected (may be detected in multiple contexts)
      const e0902Errors = errors.filter((e) => e.code === "E0902");
      expect(e0902Errors.length).toBeGreaterThanOrEqual(1);
      expect(e0902Errors.every((e) => e.functionName === "malloc")).toBe(true);
    });
  });

  // ========================================================================
  // Equality Expression Edge Cases
  // ========================================================================

  describe("equality expression edge cases", () => {
    it("should handle comparison with non-identifier expressions", () => {
      const code = `
        void main() {
          cstring c_ptr <- strchr("test", 't');
          if (c_ptr + 1 != NULL) {
            // pointer arithmetic in comparison
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // This should still work, though c_ptr+1 isn't a simple identifier
      expect(errors).toHaveLength(0);
    });

    it("should handle multiple comparisons in chain", () => {
      const code = `
        void main() {
          u32 a <- 1;
          u32 b <- 2;
          u32 c <- 3;
          if (a = b && b = c) {
            // chained comparisons
          }
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // E0905/E0906 Edge Cases
  // ========================================================================

  describe("c_ prefix edge cases", () => {
    it("should allow c_ prefix on cstring with nullable function", () => {
      const code = `
        void main() {
          cstring c_ptr <- memchr("test", 't', 4);
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // cstring with c_ prefix storing nullable function result is valid
      expect(errors).toHaveLength(0);
    });

    it("should detect c_ prefix on bool type", () => {
      const code = `
        void main() {
          bool c_flag <- true;
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0906");
    });

    it("should detect c_ prefix on f32 type", () => {
      const code = `
        void main() {
          f32 c_value <- 3.14;
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0906");
    });
  });

  // ========================================================================
  // Error Reporting Details
  // ========================================================================

  describe("error reporting details", () => {
    it("should include function name in E0901 helpText", () => {
      const code = `
        void main() {
          strchr("test", 't');
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].helpText).toContain("strchr");
    });

    it("should include ADR reference in E0902 helpText", () => {
      const code = `
        void main() {
          malloc(100);
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].helpText).toContain("ADR-003");
    });

    it("should include suggested fix in E0905 helpText", () => {
      const code = `
        void main() {
          cstring result <- strchr("test", 't');
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].helpText).toContain("c_result");
    });

    it("should include suggested fix in E0906 helpText", () => {
      const code = `
        void main() {
          u32 c_count <- 10;
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].helpText).toContain("count");
    });

    it("should include check pattern in E0908 helpText", () => {
      const code = `
        void process(cstring s) { }
        void main() {
          cstring c_ptr <- strchr("test", 't');
          process(c_ptr);
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors[0].helpText).toContain("!= NULL");
    });
  });

  // ========================================================================
  // Variable Declaration Without Initializer
  // ========================================================================

  describe("variable declaration edge cases", () => {
    it("should handle variable without nullable function initializer", () => {
      const code = `
        void main() {
          cstring str <- "hello";
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      // Regular string assignment, no nullable function
      expect(errors).toHaveLength(0);
    });

    it("should not require c_ for non-function expressions", () => {
      const code = `
        void main() {
          cstring base <- "hello";
          cstring sub <- base;
        }
      `;
      const tree = parse(code);
      const analyzer = new NullCheckAnalyzer();
      const errors = analyzer.analyze(tree);

      expect(errors).toHaveLength(0);
    });
  });
});
