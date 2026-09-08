import { afterEach, describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import BareEnumMemberAnalyzer from "../BareEnumMemberAnalyzer";

/**
 * #1322. ADR-017's bare-member rule (E0424): an enum member written bare is
 * accepted where its position names the enum -- a declaration or assignment
 * of the type, a return from a function of the type, a field or element of
 * the type -- and rejected everywhere else, with the enums that declare it.
 * Four codegen throws decided this by which generator happened to be running.
 *
 * The rule reads the per-file symbol view, so the tests set it directly and
 * `reset()` runs after each (CLAUDE.md, analyzer test isolation).
 */
const symbols = (
  enums: Record<string, string[]>,
  structs: Record<string, Record<string, string>> = {},
): void => {
  CodeGenState.symbols = {
    knownScopes: new Set<string>(),
    knownEnums: new Set(Object.keys(enums)),
    knownRegisters: new Set<string>(),
    knownStructs: new Set(Object.keys(structs)),
    knownBitmaps: new Set<string>(),
    knownVariables: new Set<string>(),
    opaqueTypes: new Set<string>(),
    scopedRegisters: new Map(),
    registerMemberAccess: new Map(),
    enumMembers: new Map(
      Object.entries(enums).map(([name, members]) => [
        name,
        new Map(members.map((m, i) => [m, i])),
      ]),
    ),
    scopeMembers: new Map(),
    scopeMemberVisibility: new Map(),
    structFields: new Map(
      Object.entries(structs).map(([name, fields]) => [
        name,
        new Map(Object.entries(fields)),
      ]),
    ),
    structFieldDimensions: new Map(),
    functionReturnTypes: new Map(),
  } as unknown as typeof CodeGenState.symbols;
};

const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new BareEnumMemberAnalyzer().analyze(tree);
};

afterEach(() => {
  CodeGenState.reset();
});

describe("BareEnumMemberAnalyzer (E0424)", () => {
  it("accepts a bare member where the position names its enum", () => {
    symbols({ Color: ["RED", "GREEN"] }, { P: { c: "Color" } });
    const source = [
      "Color g <- RED;",
      "P p <- { c: GREEN };",
      "Color[2] pair <- [RED, GREEN];",
      "Color pick(bool f) {",
      "    Color c <- (f = true) ? RED : GREEN;",
      "    c <- GREEN;",
      "    p.c <- RED;",
      "    pair[0] <- GREEN;",
      "    return RED;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("rejects a bare member where nothing names the enum, with the suggestion", () => {
    symbols({ Color: ["RED", "GREEN"] });
    const source = [
      "u8 g <- RED;",
      "u8 f(Color c) {",
      "    if (c = RED) {",
      "    }",
      "    u8 v <- RED + 1;",
      "    return GREEN;",
      "}",
    ].join("\n");
    const found = errors(source);
    expect(found.map((e) => [e.code, e.line])).toEqual([
      ["E0424", 1],
      ["E0424", 3],
      ["E0424", 5],
      ["E0424", 6],
    ]);
    expect(found[0].message).toBe(
      "'RED' is not defined; did you mean 'Color.RED'?",
    );
    expect(found[0].column).toBeGreaterThan(0);
  });

  it("names every enum that declares an ambiguous member", () => {
    symbols({ Color: ["RED"], Status: ["RED"] });
    const [found] = errors("u8 g <- RED;");
    expect(found.message).toBe(
      "'RED' is not defined; did you mean 'Color.RED' or 'Status.RED'?",
    );
  });

  it("rejects a member of the OTHER enum under an enum-typed position (the closed hole)", () => {
    // `Color c <- YELLOW` resolved nothing and codegen emitted `YELLOW` into C.
    symbols({ Color: ["RED"], Status: ["YELLOW"] });
    const found = errors("Color c <- YELLOW;");
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("'Status.YELLOW'");
  });

  it("clears the expectation inside a call's arguments, a subscript and a dimension", () => {
    symbols({ Color: ["RED", "COUNT"] });
    const source = [
      "void take(Color c) {",
      "}",
      "u8[COUNT] data;",
      "void main() {",
      "    take(RED);",
      "    u8 v <- data[COUNT];",
      "}",
    ].join("\n");
    expect(errors(source).map((e) => e.line)).toEqual([3, 5, 6]);
  });

  it("leaves a declared name of the same spelling alone", () => {
    // A local, a parameter or a const wins over the enum member, as codegen
    // resolved a declared name before ever asking the enums.
    symbols({ Color: ["RED"] });
    const source = [
      "void f(u8 RED) {",
      "    u8 v <- RED;",
      "}",
      "void g() {",
      "    u8 RED <- 1;",
      "    u8 w <- RED;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("says nothing without a symbol view", () => {
    expect(errors("u8 g <- RED;")).toEqual([]);
  });
});
