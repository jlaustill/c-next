/**
 * Unit tests for BooleanOperandAnalyzer
 * Tests detection of arithmetic, bitwise, shift and relational operators
 * applied to an essentially Boolean operand
 * (MISRA C:2012 Rule 10.1, Issue #1183).
 */
import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import BooleanOperandAnalyzer from "../BooleanOperandAnalyzer";

function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  return parser.program();
}

function analyze(source: string) {
  return new BooleanOperandAnalyzer().analyze(parse(source));
}

/** Wrap a statement in a function with two bool locals and an integer local. */
function inMain(statement: string) {
  return `
    void main() {
      bool a <- true;
      bool b <- false;
      u8 n <- 1;
      ${statement}
    }
  `;
}

describe("BooleanOperandAnalyzer", () => {
  describe("bool operands of guarded operators (rejected)", () => {
    it.each([
      ["+", "bool c <- a + b;"],
      ["-", "bool c <- a - b;"],
      ["*", "bool c <- a * b;"],
      ["/", "bool c <- a / b;"],
      ["%", "bool c <- a % b;"],
    ])("rejects arithmetic operator %s on two bools", (operator, statement) => {
      const errors = analyze(inMain(statement));
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0807");
      expect(errors[0].message).toBe(
        `Operator '${operator}' is not valid on a bool operand`,
      );
    });

    it.each([
      ["&", "bool c <- a & b;"],
      ["|", "bool c <- a | b;"],
      ["^", "bool c <- a ^ b;"],
    ])("rejects bitwise operator %s on two bools", (operator, statement) => {
      const errors = analyze(inMain(statement));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain(`Operator '${operator}'`);
    });

    it.each([
      ["<<", "u8 c <- a << 1;"],
      [">>", "u8 c <- a >> 1;"],
    ])("rejects shift operator %s on a bool", (operator, statement) => {
      const errors = analyze(inMain(statement));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain(`Operator '${operator}'`);
    });

    // Boolean values are not ordered, so relational comparison is meaningless.
    it.each([
      ["<", "bool c <- (a < b);"],
      [">", "bool c <- (a > b);"],
      ["<=", "bool c <- (a <= b);"],
      [">=", "bool c <- (a >= b);"],
    ])("rejects relational operator %s on two bools", (operator, statement) => {
      const errors = analyze(inMain(statement));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain(`Operator '${operator}'`);
    });

    it.each([
      ["-", "i8 c <- -a;"],
      ["~", "bool c <- ~a;"],
    ])("rejects prefix operator %s on a bool", (operator, statement) => {
      const errors = analyze(inMain(statement));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain(`Operator '${operator}'`);
    });

    // Every shape a Boolean operand can take, each reported exactly once: the
    // count also pins that a two-bool operator reports per operator, not per
    // operand.
    it.each([
      ["a bool mixed with an integer operand", "u8 c <- a + n;"],
      ["a bool on the right-hand side of an integer", "u8 c <- n * a;"],
      ["true/false literal operands", "bool c <- true + false;"],
      ["a negation result used as an operand", "u8 c <- !a + n;"],
      ["a parenthesised bool operand", "u8 c <- (a) + n;"],
      ["both operands bool, reported once", "bool c <- a / b;"],
    ])("rejects %s", (_label, statement) => {
      const errors = analyze(inMain(statement));
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0807");
    });

    it("reports each offending operator in a chain", () => {
      const errors = analyze(inMain("bool c <- a + b + a;"));
      expect(errors).toHaveLength(2);
    });

    it("reports the position of the offending operand", () => {
      const errors = analyze(inMain("bool c <- a / b;"));
      expect(errors[0].line).toBeGreaterThan(0);
      expect(errors[0].column).toBeGreaterThanOrEqual(0);
    });

    it("carries help text naming the rule and the valid operators", () => {
      const errors = analyze(inMain("bool c <- a + b;"));
      expect(errors[0].helpText).toContain("Rule 10.1");
      expect(errors[0].helpText).toContain("&&");
    });
  });

  describe("operators that remain valid on a bool (accepted)", () => {
    it.each([
      ["logical and", "bool c <- a && b;"],
      ["logical or", "bool c <- a || b;"],
      ["negation", "bool c <- !a;"],
      ["equality", "bool c <- (a = b);"],
      ["inequality", "bool c <- (a != b);"],
      ["plain assignment", "a <- b;"],
      ["negating assignment", "a <- !a;"],
    ])("accepts %s", (_label, statement) => {
      expect(analyze(inMain(statement))).toHaveLength(0);
    });

    it("accepts a bool comparison as a controlling expression", () => {
      expect(analyze(inMain("if (a = true) { n <- 2; }"))).toHaveLength(0);
    });

    it("accepts arithmetic on integers", () => {
      expect(analyze(inMain("u8 c <- n + n;"))).toHaveLength(0);
    });

    it("accepts arithmetic on integers compared with a relational operator", () => {
      expect(analyze(inMain("bool c <- (n < 2);"))).toHaveLength(0);
    });
  });

  describe("scope resolution", () => {
    it("does not flag a same-named integer in another function", () => {
      const errors = analyze(`
        void first() {
          bool value <- true;
          bool other <- false;
          bool c <- value && other;
        }
        void second() {
          u8 value <- 1;
          u8 c <- value + 1;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("resolves a bool shadowing an outer integer of the same name", () => {
      const errors = analyze(`
        void main() {
          u8 value <- 1;
          {
            bool value <- true;
            u8 c <- value + 1;
          }
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0807");
    });

    it("flags a bool parameter used in arithmetic", () => {
      const errors = analyze(`
        void go(bool flag) {
          u8 c <- flag + 1;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("flags a global bool used in arithmetic inside a function", () => {
      const errors = analyze(`
        bool ready <- false;
        void main() {
          u8 c <- ready + 1;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("returns no errors for a program with no bool operands", () => {
      expect(analyze("void main() { u8 c <- 1 + 2; }")).toHaveLength(0);
    });
  });
});
