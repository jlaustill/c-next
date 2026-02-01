/**
 * Unit tests for CNextSourceParser.
 * Tests C-Next source parsing with error collection.
 */

import { describe, expect, it } from "vitest";
import CNextSourceParser from "../CNextSourceParser";

describe("CNextSourceParser", () => {
  describe("parse", () => {
    it("parses valid C-Next source and returns tree with no errors", () => {
      const source = `u32 x <- 5;`;

      const result = CNextSourceParser.parse(source);

      expect(result.errors).toHaveLength(0);
      expect(result.tree).toBeDefined();
      expect(result.tokenStream).toBeDefined();
      expect(result.declarationCount).toBe(1);
    });

    it("collects syntax errors with line and column info", () => {
      const source = `u32 x <- ;`; // Missing value

      const result = CNextSourceParser.parse(source);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].line).toBe(1);
      expect(result.errors[0].column).toBeGreaterThanOrEqual(0);
      expect(result.errors[0].severity).toBe("error");
      expect(result.errors[0].message).toBeDefined();
    });

    it("returns tree even when there are parse errors", () => {
      const source = `u32 x <- ;`; // Invalid syntax

      const result = CNextSourceParser.parse(source);

      // Tree is still returned (partial parse)
      expect(result.tree).toBeDefined();
      expect(result.tokenStream).toBeDefined();
    });

    it("counts multiple declarations correctly", () => {
      const source = `
        u32 x <- 5;
        u32 y <- 10;
        void foo() { }
      `;

      const result = CNextSourceParser.parse(source);

      expect(result.errors).toHaveLength(0);
      expect(result.declarationCount).toBe(3);
    });

    it("handles empty source", () => {
      const source = ``;

      const result = CNextSourceParser.parse(source);

      expect(result.errors).toHaveLength(0);
      expect(result.declarationCount).toBe(0);
    });

    it("collects lexer errors for invalid characters", () => {
      // Backtick is not a valid C-Next character - should trigger lexer error
      const source = "u32 x <- `invalid`;";

      const result = CNextSourceParser.parse(source);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].severity).toBe("error");
    });

    it("does not throw on malformed input", () => {
      // Even severely malformed input should return a result, not throw
      const source = "{{{{[[[[";

      expect(() => CNextSourceParser.parse(source)).not.toThrow();
      const result = CNextSourceParser.parse(source);
      expect(result.tree).toBeDefined();
    });
  });
});
