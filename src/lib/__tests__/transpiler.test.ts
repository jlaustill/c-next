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
  });
});
