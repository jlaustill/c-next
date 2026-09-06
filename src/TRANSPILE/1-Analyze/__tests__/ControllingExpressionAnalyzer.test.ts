import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import ControllingExpressionAnalyzer from "../ControllingExpressionAnalyzer";

/**
 * #1322. ADR-022's controlling-expression rule -- E0701 (MISRA C:2012 Rule
 * 14.4) and E0702 (Rule 13.5) -- replacing four throws in `TypeValidator` that
 * all reached the user as `1:0`.
 *
 * The rule is purely syntactic, so these drive real source: the decomposition
 * of `||` and `&&` down to leaf operands is the whole check, and asserting it
 * against the grammar is the only way to know the decomposition matches what
 * the parser actually builds.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new ControllingExpressionAnalyzer().analyze(tree);
};

const inIf = (condition: string): string =>
  `bool flag <- true;\nu32 n <- 1;\nvoid t() {\n    if (${condition}) { }\n}`;

describe("ControllingExpressionAnalyzer", () => {
  describe("E0701 -- a condition must be a comparison", () => {
    it("rejects a bare value, with a real position", () => {
      const found = errors(inIf("n"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0701");
      expect(found[0].line).toBe(4);
      expect(found[0].column).toBeGreaterThan(0);
    });

    it("rejects a bare bool and suggests the explicit form", () => {
      const [found] = errors(inIf("flag"));
      expect(found.helpText).toContain("flag = true");
    });

    it("rejects a negation and suggests its inverse", () => {
      // `!flag` is not a comparison, and the suggestion has to flip with the
      // negation or it tells the author to write something else entirely.
      const [found] = errors(inIf("!flag"));
      expect(found.helpText).toContain("flag = false");
    });

    it("suggests a numeric form for a non-bool", () => {
      const [found] = errors(inIf("n"));
      expect(found.helpText).toContain("n > 0");
    });

    it("accepts an equality and a relational comparison", () => {
      expect(errors(inIf("n = 1"))).toEqual([]);
      expect(errors(inIf("n > 0"))).toEqual([]);
      expect(errors(inIf("flag = true"))).toEqual([]);
    });

    it("requires EVERY leaf of a `&&` to be a comparison", () => {
      // The decomposition is the rule. `n > 0 && flag` has one good operand
      // and one bare bool, and a check that stopped at the first would pass it.
      expect(errors(inIf("n > 0 && flag"))).toHaveLength(1);
      expect(errors(inIf("flag && n > 0"))).toHaveLength(1);
      expect(errors(inIf("n > 0 && flag = true"))).toEqual([]);
    });

    it("requires EVERY leaf of a `||` to be a comparison", () => {
      expect(errors(inIf("n > 0 || flag"))).toHaveLength(1);
      expect(errors(inIf("n > 0 || flag = true"))).toEqual([]);
    });

    it("rejects a ternary used as a condition", () => {
      const found = errors(
        "u32 n <- 1;\nvoid t() {\n    if ((n > 0) ? 1 : 0) { }\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0701");
      expect(found[0].message).toContain("ternary");
    });
  });

  describe("E0702 -- a condition may not call a function", () => {
    const withCall = (condition: string): string =>
      `bool isValid() {\n    return true;\n}\nvoid t() {\n    if (${condition}) { }\n}`;

    it("rejects a call, with a real position", () => {
      const found = errors(withCall("isValid() = true"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0702");
      expect(found[0].line).toBe(5);
    });

    it("rejects a negated and a double-negated call", () => {
      expect(errors(withCall("!isValid()"))[0].code).toBe("E0702");
      expect(errors(withCall("!!isValid()"))[0].code).toBe("E0702");
    });

    it("accepts the call hoisted out of the condition", () => {
      // What the diagnostic tells the author to do. A rule that rejected the
      // CALL rather than the call IN A CONDITION would fail here.
      expect(
        errors(
          [
            "bool isValid() {",
            "    return true;",
            "}",
            "void t() {",
            "    bool ready <- isValid();",
            "    if (ready = true) { }",
            "}",
          ].join("\n"),
        ),
      ).toEqual([]);
    });
  });

  describe("the five productions that carry a controlling expression", () => {
    // The enumeration is the risk: they are five listener methods, and a sixth
    // production added later would be silently unchecked. Each is asserted
    // here, and `controlling-expression-every-kind-error` asserts all five at
    // once so a dropped kind changes that fixture's diagnostic COUNT.
    const cases: [string, string][] = [
      ["if", "void t() {\n    u32 n <- 1;\n    if (n) { }\n}"],
      ["while", "void t() {\n    u32 n <- 1;\n    while (n) { }\n}"],
      ["do-while", "void t() {\n    u32 n <- 1;\n    do { } while (n);\n}"],
      [
        "for",
        "void t() {\n    u32 n <- 1;\n    for (u32 i <- 0; n; i +<- 1) { }\n}",
      ],
      ["ternary", "void t() {\n    u32 n <- 1;\n    u32 r <- (n) ? 1 : 0;\n}"],
    ];

    it.each(cases)("reports a bare value in a %s condition", (kind, source) => {
      const found = errors(source);
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0701");
      expect(found[0].message).toContain(kind);
    });

    it("says nothing about `forever`, which has no condition", () => {
      // The one loop with no controlling expression, which is the point of it.
      // A rule that invented one would reject the language's own idiom.
      expect(
        errors(
          "u32 n <- 1;\nvoid t() {\n    forever {\n        n <- 1;\n    }\n}",
        ),
      ).toEqual([]);
    });

    it("says nothing about `for (;;)`, which E0707 owns", () => {
      expect(
        errors("void t() {\n    for (;;) { }\n}").filter(
          (e) => e.code === "E0701",
        ),
      ).toEqual([]);
    });
  });
});
