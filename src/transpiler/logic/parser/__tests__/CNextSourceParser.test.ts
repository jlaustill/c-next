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

  /**
   * #1306 / ADR-016: a nested scope is rejected with E0430 rather than ANTLR's
   * recovery text.
   *
   * These cases exist because the corpus fixtures cannot reach them. The
   * over-enforcement cases below stay green under a mutation that deletes the
   * rule-stack half of the predicate -- and pinning them as `.expected.error`
   * fixtures would mean asserting the raw ANTLR token list, which is the exact
   * thing #1306 removes. So they are asserted here instead.
   */
  describe("nested scope rejection (E0430)", () => {
    it("reports E0430 at the inner scope keyword", () => {
      const source = `scope Outer {
    u8 v <- 1;
    scope Inner {
        u8 w <- 2;
    }
}`;

      const result = CNextSourceParser.parse(source);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "error[E0430]: nested scopes are not allowed (ADR-016); use a flat scope such as Hardware_GPIO",
      );
      expect(result.errors[0].line).toBe(3);
      expect(result.errors[0].column).toBe(4);
    });

    it("reports E0430 when the nested scope carries a visibility modifier", () => {
      // The prefixed form reaches the listener through a different ANTLR path:
      // the innermost rule is `scopeMember`, not `scopeDeclaration`, and the
      // exception is a NoViableAltException rather than null. Both spellings must
      // match or half the syntax goes unreported.
      const source = `scope Outer {
    private scope Inner { u8 w <- 2; }
}`;

      const result = CNextSourceParser.parse(source);

      expect(result.errors[0].message).toContain("error[E0430]");
      expect(result.errors[0].line).toBe(2);
    });

    it("suppresses the recovery cascade so only the rule is reported", () => {
      // ANTLR reparents the inner block and then calls the outer `}` extraneous.
      // Without suppression the fixture would assert a ~30-token expectation set.
      const source = `scope Outer {
    scope Inner { u8 w <- 2; }
}`;

      const result = CNextSourceParser.parse(source);

      expect(result.errors).toHaveLength(1);
    });

    it("reports every nested scope, not just the first", () => {
      // The cascade latch must drop recovery noise without swallowing a second
      // genuine finding.
      const source = `scope A {
    scope B { u8 x <- 1; }
}
scope C {
    scope D { u8 y <- 2; }
}`;

      const result = CNextSourceParser.parse(source);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[1].message).toContain("error[E0430]");
      expect(result.errors[1].line).toBe(5);
    });

    // OVER-ENFORCEMENT CONTROLS. A `scope` keyword in one of these positions is
    // still a syntax error, but it is NOT a nested scope, and calling it one would
    // tell the user to flatten a scope they never nested.
    it.each([
      ["a struct body", `struct S {\n    scope B { u8 x <- 1; }\n}`],
      ["a function body", `void main() {\n    scope B { u8 x <- 1; }\n}`],
      [
        "a register body",
        `register R @ 0x40000000 {\n    scope B { u8 x <- 1; }\n}`,
      ],
    ])(
      "does not claim a nested scope for a scope keyword in %s",
      (_, source) => {
        const result = CNextSourceParser.parse(source);

        expect(result.errors.length).toBeGreaterThan(0);
        for (const error of result.errors) {
          expect(error.message).not.toContain("E0430");
        }
      },
    );

    it("stays silent for a scope holding every legal member kind", () => {
      // The six alternatives `scopeMember` admits. Five open a brace, so a check
      // written against braces rather than against the `scope` keyword would fire
      // here.
      const source = `scope Legal {
    u8 plainValue <- 10;
    public enum Mode { OFF, ON }
    public struct Point { u32 x; }
    public bitmap8 Flags { Alpha, Rest[7] }
    register CTRL @ 0x40000000 { DR: u32 rw @ 0x00, }
    public u8 read() { return this.plainValue; }
}`;

      const result = CNextSourceParser.parse(source);

      expect(result.errors).toHaveLength(0);
    });

    it("still reports an ordinary syntax error when no scope is nested", () => {
      // The latch must not be armed by unrelated failures.
      const source = `scope A { u8 x <- 1; }
void main() { u8 y <- ; }`;

      const result = CNextSourceParser.parse(source);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).not.toContain("E0430");
    });
  });
});
