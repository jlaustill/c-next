import { afterEach, describe, expect, it } from "vitest";

import CodeGenState from "../../../transpiler/state/CodeGenState";
import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import EnumTypeSafetyAnalyzer from "../EnumTypeSafetyAnalyzer";

/**
 * #1322. ADR-017 enum type safety: E0428 (assignment) and E0434 (comparison),
 * replacing EIGHT throws in `output/` -- five in `EnumAssignmentValidator` and
 * three in `BinaryExprUtils`.
 *
 * The rule needs `knownEnums`, which lives on `CodeGenState.symbols` and is
 * populated before `runAnalyzers`. These tests set it directly, which is why
 * `reset()` runs after each one (CLAUDE.md, analyzer test isolation).
 */
const withEnums = (...names: string[]): void => {
  CodeGenState.symbols = {
    knownEnums: new Set(names),
    knownStructs: new Set<string>(),
    knownBitmaps: new Set<string>(),
    structFields: new Map(),
    structFieldDimensions: new Map(),
    functionReturnTypes: new Map(),
  } as unknown as typeof CodeGenState.symbols;
};

const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new EnumTypeSafetyAnalyzer().analyze(tree);
};

afterEach(() => {
  CodeGenState.reset();
});

describe("EnumTypeSafetyAnalyzer", () => {
  describe("assignment (E0428)", () => {
    it("rejects an integer literal, with a real position", () => {
      withEnums("State");
      const found = errors(
        "enum State { IDLE, RUNNING }\nvoid main() {\n    State s <- State.IDLE;\n    s <- 1;\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0428");
      expect(found[0].line).toBe(4);
      expect(found[0].column).toBeGreaterThan(0);
      expect(found[0].message).toContain("integer");
    });

    it("rejects an arithmetic expression of integers -- the folded case", () => {
      // REGRESSION. The codegen check matched the source text against a pattern for a bare
      // integer literal, so `1 + 1` was not one; constant folding to `2`
      // happens later, in codegen, and it emitted `State d = 2;`.
      withEnums("State");
      const found = errors(
        "enum State { IDLE, RUNNING }\nvoid main() {\n    State d <- 1 + 1;\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain("integer");
    });

    it("rejects a member of a different enum", () => {
      withEnums("State", "Power");
      const found = errors(
        "enum State { IDLE }\nenum Power { ON }\nvoid main() {\n    State s <- Power.ON;\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].message).toBe("Cannot assign Power enum to State enum");
    });

    it("accepts a member of the target enum", () => {
      withEnums("State");
      expect(
        errors(
          "enum State { IDLE, RUNNING }\nvoid main() {\n    State s <- State.IDLE;\n}",
        ),
      ).toEqual([]);
    });

    it("accepts an explicit cast, which ADR-017 makes the conversion", () => {
      // The control the rule turns on. Typing a cast by what is INSIDE the
      // parentheses would see the literal and reject the sanctioned form.
      withEnums("State");
      expect(
        errors(
          "enum State { IDLE }\nvoid main() {\n    State s <- (State)1;\n}",
        ),
      ).toEqual([]);
    });

    it("says nothing when nothing declares the value", () => {
      // An undeclared name is E0427's to report. Guessing here would produce a
      // second diagnostic for one mistake, and would fire on valid code
      // wherever this resolver has a gap.
      withEnums("State");
      expect(
        errors(
          "enum State { IDLE }\nvoid main() {\n    State s <- undeclared;\n}",
        ),
      ).toEqual([]);
    });

    it("reports every offending assignment, not just the first", () => {
      withEnums("State");
      const found = errors(
        "enum State { IDLE }\nvoid main() {\n    State a <- 1;\n    State b <- 2;\n}",
      );
      expect(found).toHaveLength(2);
    });

    it("says nothing about a compound operator, which is E0857's", () => {
      // One mistake must not yield two diagnostics.
      withEnums("State");
      expect(
        errors(
          "enum State { IDLE }\nvoid main() {\n    State s <- State.IDLE;\n    s +<- 1;\n}",
        ).filter((e) => e.code === "E0428"),
      ).toEqual([]);
    });
  });

  describe("comparison (E0434)", () => {
    it("rejects an enum compared to an integer", () => {
      withEnums("State");
      const found = errors(
        "enum State { IDLE }\nvoid main() {\n    State s <- State.IDLE;\n    if (s = 0) { }\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0434");
      expect(found[0].line).toBe(4);
    });

    it("rejects two different enum types", () => {
      withEnums("State", "Power");
      const found = errors(
        "enum State { IDLE }\nenum Power { ON }\nvoid main() {\n    State s <- State.IDLE;\n    if (s = Power.ON) { }\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].message).toBe("Cannot compare State enum to Power enum");
    });

    it("accepts an enum compared to its own member", () => {
      withEnums("State");
      expect(
        errors(
          "enum State { IDLE }\nvoid main() {\n    State s <- State.IDLE;\n    if (s = State.IDLE) { }\n}",
        ),
      ).toEqual([]);
    });

    it("accepts a comparison with no enum on either side", () => {
      withEnums("State");
      expect(
        errors(
          "enum State { IDLE }\nvoid main() {\n    u32 n <- 1;\n    if (n = 0) { }\n}",
        ),
      ).toEqual([]);
    });
  });

  describe("name resolution", () => {
    it("resolves a scope's own enum written bare, with `this.`, and qualified", () => {
      // The three spellings of one type. An earlier version resolved only some
      // of them, which INVERTED the rule inside a scope: correct assignments
      // were reported as non-enum values, and twelve fixtures caught it.
      withEnums("Motor__Mode");
      const source = [
        "scope Motor {",
        "    public enum Mode { SLOW, FAST }",
        "    public this.Mode bare() {",
        "        this.Mode a <- Mode.SLOW;",
        "        this.Mode b <- this.Mode.FAST;",
        "        return a;",
        "    }",
        "}",
      ].join("\n");
      expect(errors(source)).toEqual([]);
    });

    it("resolves a global enum written with `global.`", () => {
      // `global.` states FILE scope, so it must NOT be qualified by the
      // enclosing scope -- doing so produced a name matching nothing, which
      // read as "not an enum".
      withEnums("EGlobal");
      const source = [
        "enum EGlobal { A, B }",
        "scope S {",
        "    public EGlobal read() {",
        "        global.EGlobal v <- global.EGlobal.A;",
        "        return v;",
        "    }",
        "}",
      ].join("\n");
      expect(errors(source)).toEqual([]);
    });
  });
});
