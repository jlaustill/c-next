/**
 * Unit tests for detectAssemblySyntax
 *
 * Some framework headers (e.g. xtensa `coreasm.h`, pulled in transitively by
 * FreeRTOS port headers) are GNU-assembler sources, not C: they `#define
 * _ASMLANGUAGE` and contain `.macro` bodies whose instruction mnemonics (e.g.
 * `loop`) were mis-collected as C symbols, causing false "defined in multiple
 * languages" conflicts against C-Next symbols like Arduino `loop()`.
 * detectAssemblySyntax lets the header pipeline skip such files.
 */
import { describe, it, expect } from "vitest";
import detectAssemblySyntax from "../detectAssemblySyntax";

describe("detectAssemblySyntax", () => {
  describe("assembler sources - should return true", () => {
    it("detects a GAS .macro block (xtensa coreasm.h shape)", () => {
      const coreasm = [
        "#define _ASMLANGUAGE",
        "\t.macro\tfloop_\tar, startlabel, endlabelref",
        "\tloop\t\\ar, \\endlabelref",
        "\t.endm",
      ].join("\n");
      expect(detectAssemblySyntax(coreasm)).toBe(true);
    });

    it("detects the _ASMLANGUAGE marker on its own", () => {
      expect(detectAssemblySyntax("#define _ASMLANGUAGE 1\n")).toBe(true);
    });

    it("detects section/global directives at line start", () => {
      expect(detectAssemblySyntax("  .section .text\n  .global _start\n")).toBe(
        true,
      );
    });

    it("detects .macro regardless of leading whitespace", () => {
      expect(detectAssemblySyntax("    .macro find_ms_setbit ad, as\n")).toBe(
        true,
      );
    });

    it("detects a spaced '# define _ASMLANGUAGE' directive", () => {
      expect(detectAssemblySyntax("# define _ASMLANGUAGE\n")).toBe(true);
    });

    it("detects portable assembly markers defined whole-file", () => {
      expect(detectAssemblySyntax("#define __ASSEMBLY__ 1\n")).toBe(true);
      expect(detectAssemblySyntax("#define __ASSEMBLER__\n")).toBe(true);
    });
  });

  describe("C / C++ headers - should return false", () => {
    it("returns false for a C function named loop", () => {
      expect(
        detectAssemblySyntax("void loop(void);\nint add(int a, int b);"),
      ).toBe(false);
    });

    it("returns false for structs, enums, typedefs", () => {
      expect(
        detectAssemblySyntax(
          "typedef struct { int x; } Point;\nenum Color { RED, GREEN };",
        ),
      ).toBe(false);
    });

    it("does not false-positive on member access or identifiers containing 'macro'", () => {
      expect(
        detectAssemblySyntax("int y = p.x;\nint n = cfg.macro_count;"),
      ).toBe(false);
    });

    it("returns false for a C++ class header", () => {
      expect(
        detectAssemblySyntax("class Foo : public Bar { public: int x; };"),
      ).toBe(false);
    });

    it("returns false for a C header that guards prototypes with #ifndef _ASMLANGUAGE", () => {
      // xtensa xtruntime.h shape: raw-fallback content still holds the guard
      // line. The C prototypes inside must NOT be dropped as assembler.
      const xtruntime = [
        "#ifndef _ASMLANGUAGE",
        "extern void xthal_window_spill(void);",
        "extern unsigned xthal_get_ccount(void);",
        "#endif",
      ].join("\n");
      expect(detectAssemblySyntax(xtruntime)).toBe(false);
    });

    it("returns false for a C header guarded by #ifndef __ASSEMBLY__ / #ifdef __ASSEMBLER__", () => {
      // Linux-kernel-style guards fence the C prototypes; on the raw-fallback
      // path the guard lines survive but the file is still a normal C header.
      const guarded = [
        "#ifndef __ASSEMBLY__",
        "extern int kernel_init(void);",
        "#endif",
        "#ifdef __ASSEMBLER__",
        "/* asm-only region */",
        "#endif",
      ].join("\n");
      expect(detectAssemblySyntax(guarded)).toBe(false);
    });

    it("does not match a longer macro name that merely starts with _ASMLANGUAGE", () => {
      // Exact-token match: `#define _ASMLANGUAGE_CONFIG 1` is not the marker.
      expect(detectAssemblySyntax("#define _ASMLANGUAGE_CONFIG 1\n")).toBe(
        false,
      );
    });

    it("returns false for empty content", () => {
      expect(detectAssemblySyntax("")).toBe(false);
    });
  });
});
