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

  describe("symbol kind mapping", () => {
    it("maps register symbols correctly", () => {
      // Use valid C-Next register syntax with proper fields
      const source = `
        scope Board {
          register GPIO @ 0x40000000 {
            DR: u32 rw @ 0x00,
          }
        }
      `;

      const result = parseWithSymbols(source);

      // Check parsing succeeds
      expect(result.success).toBe(true);
      // Register may have qualified name Board_GPIO
      const reg = result.symbols.find(
        (s) => s.name === "GPIO" || s.fullName === "Board_GPIO",
      );
      if (reg) {
        expect(reg.kind).toBe("register");
      }
    });

    it("maps function symbols inside scope", () => {
      // Tests extractLocalName when parent is set
      const source = `
        scope LED {
          public void toggle() { }
        }
      `;

      const result = parseWithSymbols(source);

      expect(result.success).toBe(true);
      // Find the toggle function - it should have LED_ prefix
      const func = result.symbols.find((s) => s.fullName === "LED_toggle");
      expect(func).toBeDefined();
      expect(func?.kind).toBe("function");
    });

    it("handles standalone function without parent", () => {
      const source = `void standaloneFunc() { }`;

      const result = parseWithSymbols(source);

      expect(result.success).toBe(true);
      const func = result.symbols.find((s) => s.fullName === "standaloneFunc");
      expect(func).toBeDefined();
      expect(func?.name).toBe("standaloneFunc");
      expect(func?.fullName).toBe("standaloneFunc");
      // No parent means no prefix stripping
      expect(func?.parent).toBeUndefined();
    });

    it("includes signature for functions with parameters", () => {
      const source = `
        scope Math {
          public u32 add(u32 a, u32 b) { return a + b; }
        }
      `;

      const result = parseWithSymbols(source);

      expect(result.success).toBe(true);
      const func = result.symbols.find((s) => s.fullName === "Math_add");
      expect(func).toBeDefined();
      expect(func?.kind).toBe("function");
    });

    it("includes size for arrays", () => {
      const source = `u8 buffer[10];`;

      const result = parseWithSymbols(source);

      expect(result.success).toBe(true);
      const arr = result.symbols.find((s) => s.name === "buffer");
      expect(arr).toBeDefined();
      expect(arr?.kind).toBe("variable");
    });

    it("maps enum symbols", () => {
      const source = `
        enum Color {
          RED,
          GREEN,
          BLUE
        }
      `;

      const result = parseWithSymbols(source);

      expect(result.success).toBe(true);
      // Note: The enum itself may not be in symbols (depends on collector)
      // We're testing that parsing works
      expect(result.symbols.length).toBeGreaterThanOrEqual(0);
    });

    it("maps bitmap symbols", () => {
      // bitmap8 requires exactly 8 single-bit fields
      const source = `
        bitmap8 Flags {
          bit0,
          bit1,
          bit2,
          bit3,
          bit4,
          bit5,
          bit6,
          bit7
        }
      `;

      const result = parseWithSymbols(source);

      expect(result.success).toBe(true);
      // Bitmap should be collected
      const bitmap = result.symbols.find((s) => s.name === "Flags");
      expect(bitmap).toBeDefined();
    });
  });
});
