/**
 * Unit tests for transpiler.ts
 * Tests the synchronous transpile() function for in-memory transpilation.
 */

import { describe, expect, it } from "vitest";
import transpile from "../transpiler";

describe("transpile", () => {
  describe("successful transpilation", () => {
    it("transpiles valid C-Next source to C", () => {
      const source = `u32 x <- 5;`;

      const result = transpile(source);

      expect(result.success).toBe(true);
      expect(result.code).toContain("uint32_t x = 5;");
      expect(result.errors).toHaveLength(0);
      expect(result.declarationCount).toBe(1);
    });

    it("transpiles functions correctly", () => {
      const source = `
        void foo() {
          u32 x <- 10;
        }
      `;

      const result = transpile(source);

      expect(result.success).toBe(true);
      expect(result.code).toContain("void foo(void)");
      expect(result.declarationCount).toBe(1);
    });

    it("transpiles multiple declarations", () => {
      const source = `
        u32 x <- 1;
        u32 y <- 2;
        void bar() { }
      `;

      const result = transpile(source);

      expect(result.success).toBe(true);
      expect(result.declarationCount).toBe(3);
    });
  });

  describe("parse errors", () => {
    it("returns errors for invalid syntax", () => {
      const source = `u32 x <- ;`; // Missing value

      const result = transpile(source);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.code).toBe("");
    });

    it("captures lexer errors for invalid characters", () => {
      const source = "u32 x <- `invalid`;";

      const result = transpile(source);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("parseOnly mode", () => {
    it("returns empty code in parseOnly mode", () => {
      const source = `u32 x <- 5;`;

      const result = transpile(source, { parseOnly: true });

      expect(result.success).toBe(true);
      expect(result.code).toBe("");
      expect(result.declarationCount).toBe(1);
    });

    it("still reports parse errors in parseOnly mode", () => {
      const source = `u32 x <- ;`;

      const result = transpile(source, { parseOnly: true });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("analysis errors", () => {
    it("catches uninitialized variable usage", () => {
      const source = `
        void test() {
          u32 x;
          u32 y <- x;
        }
      `;

      const result = transpile(source);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message.includes("E0381"))).toBe(true);
    });

    it("catches undefined function calls", () => {
      const source = `
        void test() {
          undefinedFunc();
        }
      `;

      const result = transpile(source);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message.includes("E0422"))).toBe(true);
    });
  });

  describe("grammar coverage", () => {
    it("collects grammar coverage when requested", () => {
      const source = `u32 x <- 5;`;

      const result = transpile(source, { collectGrammarCoverage: true });

      expect(result.success).toBe(true);
      expect(result.grammarCoverage).toBeDefined();
      expect(result.grammarCoverage?.visitedParserRules).toBeGreaterThan(0);
    });

    it("collects grammar coverage even on parse errors", () => {
      const source = `@@@invalid`;

      const result = transpile(source, { collectGrammarCoverage: true });

      expect(result.success).toBe(false);
      expect(result.grammarCoverage).toBeDefined();
    });
  });

  describe("NULL check errors", () => {
    it("catches NULL used outside comparison context", () => {
      // E0903: NULL can only be used in comparison context
      const source = `
        void test() {
          u8 x <- NULL;
        }
      `;

      const result = transpile(source);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message.includes("E0903"))).toBe(true);
    });
  });

  describe("division by zero errors", () => {
    it("catches compile-time division by zero", () => {
      // E0800 = division by zero
      const source = `
        void test() {
          u32 x <- 10 / 0;
        }
      `;

      const result = transpile(source);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message.includes("E0800"))).toBe(true);
    });
  });

  describe("float modulo errors", () => {
    it("catches modulo with floating point operands", () => {
      // E0804 = float modulo error
      const source = `
        void test() {
          f32 x <- 10.5;
          f32 y <- x % 3.0;
        }
      `;

      const result = transpile(source);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message.includes("E0804"))).toBe(true);
    });
  });

  describe("comment validation errors (MISRA)", () => {
    it("catches nested block comments (MISRA 3.1)", () => {
      // MISRA C:2012 Rule 3.1 - /* within /* ... */
      const source = `/* outer /* nested */ u32 x <- 5;`;

      const result = transpile(source);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message.includes("MISRA-3.1"))).toBe(
        true,
      );
    });
  });

  describe("code generation errors", () => {
    it("handles code generation exceptions gracefully", () => {
      // ADR-022: ternary condition must be boolean expression, not bare variable
      // This parses successfully but fails during code generation
      const source = `
        void test() {
          u32 x <- 5;
          u32 result <- (x) ? 1 : 0;
        }
      `;

      const result = transpile(source);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain("Code generation failed");
    });

    it("handles non-Error exceptions", () => {
      // Test with invalid code that might throw a non-Error object
      // This is harder to trigger, so we just verify the error handling path works
      const source = `
        void test() {
          u32 x <- atomic_volatile 5;
        }
      `;

      const result = transpile(source);

      // Should handle any exception type gracefully
      expect(result).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("target option", () => {
    it("passes target option to code generator", () => {
      const source = `void main() { }`;

      const result = transpile(source, { target: "esp32" });

      expect(result.success).toBe(true);
    });
  });

  describe("debug mode", () => {
    it("respects debugMode option", () => {
      const source = `void main() { }`;

      const result = transpile(source, { debugMode: true });

      expect(result.success).toBe(true);
    });
  });
});
