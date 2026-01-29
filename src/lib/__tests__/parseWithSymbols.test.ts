/**
 * Unit tests for parseWithSymbols.ts
 * Tests symbol extraction for IDE features like autocomplete.
 */

import { describe, expect, it } from "vitest";
import parseWithSymbols from "../parseWithSymbols";

describe("parseWithSymbols", () => {
  describe("successful parsing", () => {
    it("extracts variable symbols", () => {
      const source = `u32 counter <- 0;`;

      const result = parseWithSymbols(source);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.symbols.some((s) => s.name === "counter")).toBe(true);
    });

    it("extracts function symbols", () => {
      const source = `void myFunction() { }`;

      const result = parseWithSymbols(source);

      expect(result.success).toBe(true);
      const func = result.symbols.find((s) => s.name === "myFunction");
      expect(func).toBeDefined();
      expect(func?.kind).toBe("function");
    });

    it("extracts scope symbols", () => {
      const source = `
        scope LED {
          void on() { }
          void off() { }
        }
      `;

      const result = parseWithSymbols(source);

      expect(result.success).toBe(true);
      // Scope is extracted as a namespace
      const scope = result.symbols.find((s) => s.name === "LED");
      expect(scope).toBeDefined();
      expect(scope?.kind).toBe("namespace");
      // Scope functions get prefixed names like LED_on
      const onFunc = result.symbols.find((s) => s.fullName === "LED_on");
      expect(onFunc).toBeDefined();
      expect(onFunc?.kind).toBe("function");
    });

    it("extracts struct symbols", () => {
      const source = `
        struct Point {
          i32 x;
          i32 y;
        }
      `;

      const result = parseWithSymbols(source);

      expect(result.success).toBe(true);
      const struct = result.symbols.find((s) => s.name === "Point");
      expect(struct).toBeDefined();
      expect(struct?.kind).toBe("struct");
    });
  });

  describe("error handling", () => {
    it("returns errors for invalid syntax but still extracts partial symbols", () => {
      const source = `
        u32 validVar <- 5;
        u32 invalid <- ;
      `;

      const result = parseWithSymbols(source);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should still extract the valid symbol
      expect(result.symbols.some((s) => s.name === "validVar")).toBe(true);
    });

    it("captures lexer errors", () => {
      const source = "u32 x <- `backtick`;";

      const result = parseWithSymbols(source);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("symbol info properties", () => {
    it("includes type information", () => {
      const source = `i64 bigNumber <- 100;`;

      const result = parseWithSymbols(source);

      const sym = result.symbols.find((s) => s.name === "bigNumber");
      expect(sym?.type).toBe("i64");
    });

    it("includes line information", () => {
      const source = `
        u32 first <- 1;
        u32 second <- 2;
      `;

      const result = parseWithSymbols(source);

      const first = result.symbols.find((s) => s.name === "first");
      const second = result.symbols.find((s) => s.name === "second");
      expect(first?.line).toBeLessThan(second?.line ?? 0);
    });
  });
});
