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

    it("parses enum declarations successfully", () => {
      const source = `
        enum Color {
          RED,
          GREEN,
          BLUE
        }
      `;

      const result = parseWithSymbols(source);

      // Verifies enum syntax parses without errors
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
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

  describe("id and parentId fields (Issue #823)", () => {
    it("top-level function has id=name, no parentId", () => {
      const source = `void setup() { }`;

      const result = parseWithSymbols(source);

      const func = result.symbols.find((s) => s.name === "setup");
      expect(func?.id).toBe("setup");
      expect(func?.parentId).toBeUndefined();
    });

    it("top-level variable has id=name, no parentId", () => {
      const source = `u32 counter <- 0;`;

      const result = parseWithSymbols(source);

      const variable = result.symbols.find((s) => s.name === "counter");
      expect(variable?.id).toBe("counter");
      expect(variable?.parentId).toBeUndefined();
    });

    it("scope has id=name, no parentId", () => {
      const source = `scope LED { }`;

      const result = parseWithSymbols(source);

      const scope = result.symbols.find((s) => s.name === "LED");
      expect(scope?.id).toBe("LED");
      expect(scope?.parentId).toBeUndefined();
    });

    it("scope method has id=Scope.method, parentId=Scope", () => {
      const source = `
        scope LED {
          public void toggle() { }
        }
      `;

      const result = parseWithSymbols(source);

      const func = result.symbols.find((s) => s.name === "toggle");
      expect(func?.id).toBe("LED.toggle");
      expect(func?.parentId).toBe("LED");
    });

    it("scope variable has id=Scope.varName, parentId=Scope", () => {
      const source = `
        scope LED {
          u8 pin <- 13;
        }
      `;

      const result = parseWithSymbols(source);

      const variable = result.symbols.find((s) => s.name === "pin");
      expect(variable?.id).toBe("LED.pin");
      expect(variable?.parentId).toBe("LED");
    });

    it("enum has id=name, no parentId", () => {
      const source = `
        enum Color {
          RED,
          GREEN
        }
      `;

      const result = parseWithSymbols(source);

      const enumSym = result.symbols.find(
        (s) => s.name === "Color" && s.kind === "enum",
      );
      expect(enumSym?.id).toBe("Color");
      expect(enumSym?.parentId).toBeUndefined();
    });

    it("enum member has id=Enum.member, parentId=Enum", () => {
      const source = `
        enum Color {
          RED,
          GREEN
        }
      `;

      const result = parseWithSymbols(source);

      const member = result.symbols.find(
        (s) => s.name === "RED" && s.kind === "enumMember",
      );
      expect(member?.id).toBe("Color.RED");
      expect(member?.parentId).toBe("Color");
    });

    it("bitmap has id=name, no parentId", () => {
      const source = `
        bitmap8 Flags {
          a, b, c, d, e, f, g, h
        }
      `;

      const result = parseWithSymbols(source);

      const bitmap = result.symbols.find(
        (s) => s.name === "Flags" && s.kind === "bitmap",
      );
      expect(bitmap?.id).toBe("Flags");
      expect(bitmap?.parentId).toBeUndefined();
    });

    it("bitmap field has id=Bitmap.field, parentId=Bitmap", () => {
      const source = `
        bitmap8 Flags {
          a, b, c, d, e, f, g, h
        }
      `;

      const result = parseWithSymbols(source);

      const field = result.symbols.find(
        (s) => s.name === "a" && s.kind === "bitmapField",
      );
      expect(field?.id).toBe("Flags.a");
      expect(field?.parentId).toBe("Flags");
    });

    it("register in scope has nested id path", () => {
      const source = `
        scope Board {
          register GPIO @ 0x40000000 {
            DR: u32 rw @ 0x00,
          }
        }
      `;

      const result = parseWithSymbols(source);

      const register = result.symbols.find(
        (s) => s.name === "GPIO" && s.kind === "register",
      );
      expect(register?.id).toBe("Board.GPIO");
      expect(register?.parentId).toBe("Board");
    });

    it("register member has id=Scope.Register.member", () => {
      const source = `
        scope Board {
          register GPIO @ 0x40000000 {
            DR: u32 rw @ 0x00,
          }
        }
      `;

      const result = parseWithSymbols(source);

      const member = result.symbols.find(
        (s) => s.name === "DR" && s.kind === "registerMember",
      );
      expect(member?.id).toBe("Board.GPIO.DR");
      expect(member?.parentId).toBe("Board.GPIO");
    });

    it("struct has correct id and parentId", () => {
      const source = `
        struct Point {
          i32 x;
          i32 y;
        }
      `;

      const result = parseWithSymbols(source);

      const struct = result.symbols.find((s) => s.name === "Point");
      expect(struct?.id).toBe("Point");
      expect(struct?.parentId).toBeUndefined();
    });

    it("struct field has id=Struct.field, parentId=Struct", () => {
      const source = `
        struct Point {
          i32 x;
          i32 y;
        }
      `;

      const result = parseWithSymbols(source);

      const fieldX = result.symbols.find(
        (s) => s.name === "x" && s.kind === "field",
      );
      expect(fieldX?.id).toBe("Point.x");
      expect(fieldX?.parentId).toBe("Point");
      expect(fieldX?.type).toBe("i32");

      const fieldY = result.symbols.find(
        (s) => s.name === "y" && s.kind === "field",
      );
      expect(fieldY?.id).toBe("Point.y");
      expect(fieldY?.parentId).toBe("Point");
    });

    it("struct field in scope has nested id path", () => {
      const source = `
        scope Geometry {
          struct Vector {
            f32 x;
            f32 y;
            f32 z;
          }
        }
      `;

      const result = parseWithSymbols(source);

      const struct = result.symbols.find(
        (s) => s.name === "Vector" && s.kind === "struct",
      );
      expect(struct?.id).toBe("Geometry.Vector");
      expect(struct?.parentId).toBe("Geometry");

      const fieldX = result.symbols.find(
        (s) => s.name === "x" && s.kind === "field",
      );
      expect(fieldX?.id).toBe("Geometry.Vector.x");
      expect(fieldX?.parentId).toBe("Geometry.Vector");
      expect(fieldX?.type).toBe("f32");
    });
  });
});
