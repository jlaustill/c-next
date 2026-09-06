import { afterEach, describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import SwitchStatementAnalyzer from "../SwitchStatementAnalyzer";

/**
 * #1322. ADR-025's switch rules, E0711-E0714, replacing five throws in
 * `TypeValidator` that every one of them reported as `1:0`.
 *
 * These drive REAL SOURCE rather than mock contexts. The tests they replace
 * built `CaseLabelContext` mocks by hand, which can only ever assert that the
 * reader agrees with the mock -- and the case-label normalization is exactly
 * where a mock and the grammar could quietly disagree, since `-0x1` reaches it
 * as a MINUS token plus a HEX_LITERAL rather than as one negative literal.
 */
const withEnum = (name: string, ...members: string[]): void => {
  CodeGenState.symbols = {
    knownEnums: new Set([name]),
    knownStructs: new Set<string>(),
    knownBitmaps: new Set<string>(),
    structFields: new Map(),
    structFieldDimensions: new Map(),
    functionReturnTypes: new Map(),
    enumMembers: new Map([[name, new Map(members.map((m, i) => [m, i]))]]),
  } as unknown as typeof CodeGenState.symbols;
};

const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new SwitchStatementAnalyzer().analyze(tree);
};

afterEach(() => {
  CodeGenState.reset();
});

describe("SwitchStatementAnalyzer", () => {
  it("rejects a switch on a bool, with a real position", () => {
    const found = errors(
      [
        "bool flag <- true;",
        "u32 main() {",
        "    switch (flag) {",
        "        case true { }",
        "        default { }",
        "    }",
        "    return 0;",
        "}",
      ].join("\n"),
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0711");
    expect(found[0].line).toBe(3);
    expect(found[0].column).toBeGreaterThan(0);
  });

  it("rejects a switch with fewer than two clauses", () => {
    const found = errors(
      [
        "u32 main() {",
        "    u32 n <- 1;",
        "    switch (n) {",
        "        case 1 { }",
        "    }",
        "    return 0;",
        "}",
      ].join("\n"),
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0712");
  });

  it("accepts two clauses, the boundary the rule is one past", () => {
    expect(
      errors(
        [
          "u32 main() {",
          "    u32 n <- 1;",
          "    switch (n) {",
          "        case 1 { }",
          "        default { }",
          "    }",
          "    return 0;",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("rejects a duplicate case value", () => {
    const found = errors(
      [
        "u32 main() {",
        "    u32 n <- 1;",
        "    switch (n) {",
        "        case 1 { }",
        "        case 1 { }",
        "        default { }",
        "    }",
        "    return 0;",
        "}",
      ].join("\n"),
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0713");
    expect(found[0].message).toContain("'1'");
  });

  it("sees through the spelling: -1 and -0x1 are the same case", () => {
    // The reason the label value is normalized rather than compared as text.
    const found = errors(
      [
        "u32 main() {",
        "    i32 n <- 1;",
        "    switch (n) {",
        "        case -1 { }",
        "        case -0x1 { }",
        "        default { }",
        "    }",
        "    return 0;",
        "}",
      ].join("\n"),
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0713");
  });

  it("does not confuse 0b10 with 10", () => {
    // The mirror of the case above: normalizing has to change the VALUE, not
    // just strip the prefix. `0b10` is 2, and 2 is not 10.
    expect(
      errors(
        [
          "u32 main() {",
          "    u32 n <- 1;",
          "    switch (n) {",
          "        case 0b10 { }",
          "        case 10 { }",
          "        default { }",
          "    }",
          "    return 0;",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  describe("enum exhaustiveness (E0714)", () => {
    const source = (cases: string): string =>
      [
        "enum EState { IDLE, RUNNING, STOPPED }",
        "u32 main() {",
        "    EState s <- EState.IDLE;",
        "    switch (s) {",
        cases,
        "    }",
        "    return 0;",
        "}",
      ].join("\n");

    it("rejects a switch that misses a variant", () => {
      withEnum("EState", "IDLE", "RUNNING", "STOPPED");
      const found = errors(
        source("        case EState.IDLE { }\n        case EState.RUNNING { }"),
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0714");
      expect(found[0].message).toContain("missing 1");
    });

    it("accepts a switch that covers every variant", () => {
      withEnum("EState", "IDLE", "RUNNING", "STOPPED");
      expect(
        errors(
          source(
            "        case EState.IDLE { }\n        case EState.RUNNING { }\n        case EState.STOPPED { }",
          ),
        ),
      ).toEqual([]);
    });

    it("counts what a `default(N)` says it absorbs", () => {
      withEnum("EState", "IDLE", "RUNNING", "STOPPED");
      expect(
        errors(source("        case EState.IDLE { }\n        default(2) { }")),
      ).toEqual([]);
    });

    it("rejects a `default(N)` whose count does not add up", () => {
      withEnum("EState", "IDLE", "RUNNING", "STOPPED");
      const found = errors(
        source("        case EState.IDLE { }\n        default(1) { }"),
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0714");
      expect(found[0].message).toContain("2 of 3");
    });

    it("says nothing about a bare `default`, which states no count", () => {
      // A `default` with no number makes no claim about how many variants it
      // absorbs, so there is nothing to check. Treating it as covering zero
      // would reject every switch that uses one.
      withEnum("EState", "IDLE", "RUNNING", "STOPPED");
      expect(
        errors(source("        case EState.IDLE { }\n        default { }")),
      ).toEqual([]);
    });

    it("says nothing when the switch expression is not an enum", () => {
      withEnum("EState", "IDLE", "RUNNING", "STOPPED");
      expect(
        errors(
          [
            "enum EState { IDLE, RUNNING, STOPPED }",
            "u32 main() {",
            "    u32 n <- 1;",
            "    switch (n) {",
            "        case 1 { }",
            "        default { }",
            "    }",
            "    return 0;",
            "}",
          ].join("\n"),
        ),
      ).toEqual([]);
    });
  });
});
