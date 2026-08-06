/**
 * Unit tests for IdentifierSyntaxAnalyzer
 * ADR-063 / Issue #1117: declared identifiers may not end with `_` or contain `__`
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import IdentifierSyntaxAnalyzer from "../IdentifierSyntaxAnalyzer";

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

/**
 * Helper to analyze a source snippet
 */
function analyze(source: string) {
  return new IdentifierSyntaxAnalyzer().analyze(parse(source));
}

describe("IdentifierSyntaxAnalyzer", () => {
  // ==========================================================================
  // Trailing underscore
  // ==========================================================================

  describe("trailing underscore", () => {
    it("rejects a global ending with an underscore", () => {
      const errors = analyze(`u8 value_ <- 1;`);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0201");
      expect(errors[0].identifierName).toBe("value_");
      expect(errors[0].violation).toBe("trailing");
    });

    it("suggests the name without the trailing underscore", () => {
      const errors = analyze(`u8 value_ <- 1;`);

      expect(errors[0].helpText).toContain("'value'");
    });

    it("reports the identifier's own position, not the declaration's", () => {
      const errors = analyze(`u8 value_ <- 1;`);

      expect(errors[0].line).toBe(1);
      // "u8 " is 3 characters, so the identifier starts at column 3 (0-based)
      expect(errors[0].column).toBe(3);
    });
  });

  // ==========================================================================
  // Consecutive underscores
  // ==========================================================================

  describe("consecutive underscores", () => {
    it("rejects a global containing a double underscore", () => {
      const errors = analyze(`u8 my__value <- 1;`);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0201");
      expect(errors[0].violation).toBe("consecutive");
    });

    it("collapses the run when suggesting a replacement", () => {
      const errors = analyze(`u8 my___value <- 1;`);

      expect(errors[0].helpText).toContain("'my_value'");
    });

    it.each([
      [`u8 my__value_ <- 1;`, "my_value"],
      [`u8 a__b_ <- 1;`, "a_b"],
    ])(
      "suggests a name that itself satisfies the rule for %s",
      (code, expected) => {
        // An identifier can break both clauses at once. classifyIdentifier
        // reports "consecutive" first, so fixing only that would suggest a name
        // E0201 still rejects (e.g. 'my_value_').
        const errors = analyze(code);

        expect(errors[0].helpText).toContain(`'${expected}'`);
        expect(errors[0].helpText).not.toContain(`'${expected}_'`);
        // and the suggestion must be legal under the analyzer's own rule
        expect(analyze(`u8 ${expected} <- 1;`)).toHaveLength(0);
      },
    );

    it("classifies as consecutive when both rules are broken", () => {
      const errors = analyze(`u8 my__value_ <- 1;`);

      expect(errors).toHaveLength(1);
      expect(errors[0].violation).toBe("consecutive");
    });
  });

  // ==========================================================================
  // Leading underscore stays legal (ADR-063)
  // ==========================================================================

  describe("leading underscore", () => {
    it("accepts a struct member with a leading underscore", () => {
      const errors = analyze(`
        struct Controller {
          u8 _handler;
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it("accepts a leading underscore on a global", () => {
      expect(analyze(`u8 _value <- 1;`)).toHaveLength(0);
    });

    it("still rejects a leading double underscore", () => {
      const errors = analyze(`u8 __value <- 1;`);

      expect(errors).toHaveLength(1);
      expect(errors[0].violation).toBe("consecutive");
    });
  });

  // ==========================================================================
  // Legal identifiers
  // ==========================================================================

  describe("legal identifiers", () => {
    it.each([
      ["camelCase", `u8 tickCount <- 1;`],
      ["snake_case", `u8 tick_count <- 1;`],
      ["SCREAMING_SNAKE", `u8 CONTROL_REG <- 1;`],
      ["mixed with digits", `u8 uart2_baud1 <- 1;`],
      ["CMSIS handler name", `void SysTick_Handler() { }`],
    ])("accepts %s", (_label, code) => {
      expect(analyze(code)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Declaration coverage
  // ==========================================================================

  describe("declaration contexts", () => {
    it.each([
      ["scope name", `scope Bad_ { }`],
      ["function name", `void fn_() { }`],
      ["parameter", `void fn(u8 param_) { }`],
      ["local variable", `void fn() { u8 local_ <- 1; }`],
      [
        "for-loop variable",
        `void fn() { for (u8 i_ <- 0; i_ < 3; i_ +<- 1) { } }`,
      ],
      ["struct name", `struct Bad_ { u8 a; }`],
      ["struct member", `struct Good { u8 field_; }`],
      ["enum name", `enum Bad_ { A }`],
      ["enum member", `enum Good { A_ }`],
      ["bitmap name", `bitmap8 Bad_ { a[8] }`],
      ["bitmap member", `bitmap8 Good { a_[8] }`],
      ["register name", `register Bad_ @ 0x1000 { A: u32 rw @ 0x00, }`],
      ["register member", `register Good @ 0x1000 { a_: u32 rw @ 0x00, }`],
    ])("flags a trailing underscore on a %s", (_label, code) => {
      const errors = analyze(code);

      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].code).toBe("E0201");
    });
  });

  // ==========================================================================
  // References are not checked (the C-interop carve-out)
  // ==========================================================================

  describe("references", () => {
    it("does not flag a call to an external symbol containing '__'", () => {
      const errors = analyze(`
        void fn() {
          __disable_irq();
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it("does not flag a read of an external symbol containing '__'", () => {
      const errors = analyze(`
        void fn() {
          u8 x <- __builtin_value;
        }
      `);

      expect(errors).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Multiple violations
  // ==========================================================================

  describe("multiple violations", () => {
    it("reports every offending declaration", () => {
      const errors = analyze(`
        u8 first_ <- 1;
        u8 second__value <- 2;
        u8 fine <- 3;
      `);

      expect(errors).toHaveLength(2);
      expect(errors.map((e) => e.identifierName)).toEqual([
        "first_",
        "second__value",
      ]);
    });
  });
});
