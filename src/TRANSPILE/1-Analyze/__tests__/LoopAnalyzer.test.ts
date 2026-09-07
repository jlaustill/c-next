import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import LoopAnalyzer from "../LoopAnalyzer";

/**
 * #1322. ADR-068's loop rules -- E0705 (`forever` in a non-void function),
 * E0707 (`for (;;)`, an always-true literal condition) -- and ADR-026's E0703
 * (`break`/`continue`), replacing four throws across three codegen files,
 * three of which reported `1:0`.
 *
 * Every fact is in the parse tree, so no symbol view is needed.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new LoopAnalyzer().analyze(tree);
};

const inRun = (body: string): string =>
  `void run() {\n    u8 state <- 0;\n${body}\n}`;

describe("LoopAnalyzer", () => {
  describe("E0703 -- break and continue", () => {
    it("rejects both, with the word's own position", () => {
      const found = errors(
        inRun(
          "    while (state < 3) {\n        break;\n    }\n    while (state < 3) {\n        continue;\n    }",
        ),
      );
      expect(found.map((e) => [e.code, e.line])).toEqual([
        ["E0703", 4],
        ["E0703", 7],
      ]);
      expect(found[0].message).toContain("'break'");
      expect(found[1].message).toContain("'continue'");
      expect(found[0].column).toBeGreaterThan(0);
    });

    it("says nothing about a variable that merely contains the word", () => {
      expect(
        errors(inRun("    u8 breakpoint <- 1;\n    state <- breakpoint;")),
      ).toEqual([]);
    });
  });

  describe("E0705 -- forever in a non-void function", () => {
    it("rejects it in a value-returning function and a scope method", () => {
      const source = [
        "u8 a() {",
        "    forever {",
        "    }",
        "}",
        "scope S {",
        "    public u32 b() {",
        "        forever {",
        "        }",
        "    }",
        "}",
      ].join("\n");
      expect(errors(source).map((e) => [e.code, e.line])).toEqual([
        ["E0705", 2],
        ["E0705", 7],
      ]);
    });

    it("accepts it in a void function", () => {
      expect(errors("void a() {\n    forever {\n    }\n}")).toEqual([]);
    });
  });

  describe("E0707 -- disguised infinite loops", () => {
    it("rejects `for (;;)`", () => {
      const found = errors(inRun("    for (;;) {\n    }"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0707");
      expect(found[0].message).toContain("no controlling expression");
    });

    it("rejects an always-true literal comparison in while, do-while and for", () => {
      const found = errors(
        inRun(
          "    while (1 = 1) {\n    }\n    do {\n    } while (5 > 3);\n    for (u8 i <- 0; true = true; i +<- 1) {\n    }",
        ),
      );
      expect(found.map((e) => e.code)).toEqual(["E0707", "E0707", "E0707"]);
      // The condition's text is the parse tree's spelling (whitespace dropped),
      // as codegen printed it.
      expect(found[0].message).toContain("'1=1' is always true");
      // The condition's own position, not the statement's.
      expect(found[1].line).toBe(6);
    });

    it("reads every literal spelling the rule covers", () => {
      // hex, binary, a type suffix, and `!=` on unequal literals.
      const found = errors(
        inRun(
          "    while (0x10 = 16) {\n    }\n    while (0b1 <= 1u8) {\n    }\n    while (1 != 2) {\n    }",
        ),
      );
      expect(found).toHaveLength(3);
    });

    it("leaves to #1076 what it does not decide", () => {
      // Always-false, a named constant, a compound condition, a float, and a
      // leading-zero (octal to C) integer: the literal slice stays silent.
      const source = [
        "const u8 ONE <- 1;",
        "void run() {",
        "    u8 state <- 0;",
        "    while (1 = 2) {",
        "    }",
        "    while (ONE = 1) {",
        "    }",
        "    while (1 = 1 && state < 3) {",
        "    }",
        "    while (1.0 = 1.0) {",
        "    }",
        "    while (0777 = 511) {",
        "    }",
        "}",
      ].join("\n");
      expect(errors(source)).toEqual([]);
    });

    it("accepts a loop whose condition names a variable", () => {
      expect(
        errors(inRun("    while (state < 10) {\n        state +<- 1;\n    }")),
      ).toEqual([]);
    });
  });
});
