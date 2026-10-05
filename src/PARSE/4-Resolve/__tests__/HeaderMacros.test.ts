/**
 * Unit tests for HeaderMacros (#1688, ADR-024)
 */

import { describe, it, expect } from "vitest";
import HeaderMacros from "../HeaderMacros";

describe("HeaderMacros.collect", () => {
  const typeOf = (text: string, name: string) =>
    HeaderMacros.collect(text).get(name);

  it("types a floating literal anywhere as floating, with its C type", () => {
    const macros = HeaderMacros.collect(
      [
        "#define SCALE_F 2.5f",
        "#define SCALE_D (2.5)",
        "#define BIG 1e3",
        "#define VREF 3.3",
        "#define VREF_SCALED (VREF / 4096.0)",
        "#define MIXED (SCALE_F * 2.0)",
        "#define LONG_D 1.5L",
        "#define HEX_F 0x1.8p1f",
      ].join("\n"),
    );
    expect(macros.get("SCALE_F")).toEqual({
      kind: "floating",
      typeName: "f32",
    });
    expect(macros.get("SCALE_D")).toEqual({
      kind: "floating",
      typeName: "f64",
    });
    expect(macros.get("BIG")).toEqual({ kind: "floating", typeName: "f64" });
    expect(macros.get("VREF_SCALED")).toEqual({
      kind: "floating",
      typeName: "f64",
    });
    expect(macros.get("MIXED")).toEqual({ kind: "floating", typeName: "f64" });
    expect(macros.get("LONG_D")).toEqual({ kind: "floating", typeName: null });
    expect(macros.get("HEX_F")).toEqual({ kind: "floating", typeName: "f32" });
  });

  it("follows a macro that only names a floating one", () => {
    const text = "#define ALIAS SCALE\n#define SCALE 0.5f";
    expect(typeOf(text, "ALIAS")).toEqual({
      kind: "floating",
      typeName: "f32",
    });
  });

  it("types integer literals, operators and integer macros as integer", () => {
    const macros = HeaderMacros.collect(
      [
        "#define LIMIT 10",
        "#define MASK (0xFFu << 4)",
        "#define BITS 0b1010",
        "#define DERIVED ((LIMIT * 2) | MASK)",
        "#define HEXF 0x1F",
      ].join("\n"),
    );
    for (const name of ["LIMIT", "MASK", "BITS", "DERIVED", "HEXF"]) {
      expect(macros.get(name)).toEqual({ kind: "integer" });
    }
  });

  it("leaves a call, cast, dereference, string or unknown name unreadable, whatever a cast or call holds", () => {
    const macros = HeaderMacros.collect(
      [
        "#include <stdint.h>",
        "#define _MMIO_BYTE(mem_addr) (*(volatile uint8_t *)(mem_addr))",
        "#define _SFR_IO8(io_addr) _MMIO_BYTE((io_addr) + 0x20)",
        "#define PINB _SFR_IO8(0x03)",
        "#define CAST ((uint32_t)5)",
        "#define CALL get_value()",
        '#define TEXT "hello"',
        "#define OTHER some_variable",
        "#define GUARD_H",
        "#define SELF SELF",
        "#define CYCLE_A CYCLE_B",
        "#define CYCLE_B CYCLE_A",
        "#define F_CPU 16000000UL",
        "#define TICKS ((uint16_t)(F_CPU / 1000.0))",
        "#define TRUNC ((int)2.5)",
        "#define WIDENED ((double)2.5f)",
        "#define ROUNDED lround(1.5)",
        "#define TICKS_PLUS (TICKS + 1)",
      ].join("\n"),
    );
    for (const name of [
      "PINB",
      "CAST",
      "CALL",
      "TEXT",
      "OTHER",
      "GUARD_H",
      "SELF",
      "CYCLE_A",
      "CYCLE_B",
      "TICKS",
      "TRUNC",
      "WIDENED",
      "ROUNDED",
      "TICKS_PLUS",
    ]) {
      expect(macros.get(name), name).toEqual({ kind: "unreadable" });
    }
  });

  it("types a character constant alone as character, and mixed as unreadable", () => {
    const macros = HeaderMacros.collect(
      [
        "#define LETTER_A 'A'",
        "#define CR ('\\r')",
        "#define QUOTE '\\''",
        "#define ALIAS LETTER_A",
        "#define NEXT ('A' + 1)",
        "#define WIDE L'A'",
      ].join("\n"),
    );
    for (const name of ["LETTER_A", "CR", "QUOTE", "ALIAS"]) {
      expect(macros.get(name), name).toEqual({ kind: "character" });
    }
    for (const name of ["NEXT", "WIDE"]) {
      expect(macros.get(name), name).toEqual({ kind: "unreadable" });
    }
  });

  it("does not collect a function-like macro", () => {
    const macros = HeaderMacros.collect("#define SQUARE(x) ((x) * (x))");
    expect(macros.has("SQUARE")).toBe(false);
  });

  it("reads a -dM dump, builtins included", () => {
    const macros = HeaderMacros.collect(
      [
        "#define __FLT_EPSILON__ 1.19209289550781250000000000000000000e-7F",
        "#define FLT_EPSILON __FLT_EPSILON__",
        "#define M_PI 3.14159265358979323846",
        '#define NAN (__builtin_nanf (""))',
        "#define __GNUC__ 11",
      ].join("\n"),
    );
    expect(macros.get("FLT_EPSILON")).toEqual({
      kind: "floating",
      typeName: "f32",
    });
    expect(macros.get("M_PI")).toEqual({ kind: "floating", typeName: "f64" });
    expect(macros.get("NAN")).toEqual({ kind: "unreadable" });
    expect(macros.get("__GNUC__")).toEqual({ kind: "integer" });
  });
});
