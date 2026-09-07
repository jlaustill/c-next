import { afterEach, describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import BitmapAccessAnalyzer from "../BitmapAccessAnalyzer";

/**
 * #1322. ADR-034's three access rules: E0881 (a literal too wide for the
 * field), E0882 (a member the bitmap does not declare) and E0883 (bracket
 * indexing where a named field is required).
 *
 * A bitmap's layouts come from the per-file symbol view, set directly here and
 * reset after each test. The register route needs `knownRegisters` and
 * `registerMemberTypes` as well, which is what separates the two ways a bitmap
 * is reached.
 */
const symbols = (overrides: Record<string, unknown>) => {
  CodeGenState.symbols = {
    knownStructs: new Set<string>(),
    knownEnums: new Set<string>(),
    knownScopes: new Set<string>(),
    knownRegisters: new Set<string>(),
    knownBitmaps: new Set<string>(),
    knownVariables: new Set<string>(),
    structFields: new Map(),
    structFieldArrays: new Map(),
    structFieldDimensions: new Map(),
    scopeMembers: new Map(),
    bitmapFields: new Map(),
    registerMemberAccess: new Map(),
    registerMemberTypes: new Map(),
    functionReturnTypes: new Map(),
    ...overrides,
  } as unknown as typeof CodeGenState.symbols;
};

const flags = () =>
  new Map([
    [
      "Flags",
      new Map([
        ["Mode", { offset: 0, width: 3 }],
        ["Enable", { offset: 3, width: 1 }],
      ]),
    ],
  ]);

const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new BitmapAccessAnalyzer().analyze(tree);
};

afterEach(() => {
  CodeGenState.reset();
});

describe("BitmapAccessAnalyzer (E0881)", () => {
  it("rejects a value wider than the field, in every literal base", () => {
    symbols({ bitmapFields: flags() });
    const found = errors(
      [
        "Flags f;",
        "void t() {",
        "    f.Mode <- 8;",
        "    f.Mode <- 0x8;",
        "    f.Mode <- 0b1000;",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.line])).toEqual([
      ["E0881", 3],
      ["E0881", 4],
      ["E0881", 5],
    ]);
    expect(found[0].message).toBe(
      "Value 8 exceeds 3-bit field 'Mode' maximum of 7",
    );
  });

  it("accepts the widest value the field holds, and declines a runtime one", () => {
    symbols({ bitmapFields: flags() });
    expect(
      errors(
        [
          "Flags f;",
          "void t(u8 v) {",
          "    f.Mode <- 7;",
          "    f.Enable <- 1;",
          "    f.Mode <- v;",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});

describe("BitmapAccessAnalyzer (E0882)", () => {
  it("rejects a member the bitmap does not declare, and names the ones it does", () => {
    symbols({ bitmapFields: flags() });
    const [found] = errors("Flags f;\nvoid t() {\n    f.Missing <- 1;\n}");
    expect(found.code).toBe("E0882");
    expect(found.message).toBe("Unknown bitmap field 'Missing' on 'Flags'");
    expect(found.helpText).toContain("'Mode'");
  });

  it("does not report ADR-058's shape properties as unknown fields", () => {
    // They describe the type rather than name a field. Both analyzers read one
    // shared list so this cannot drift; before it was shared, `f.bit_length`
    // reported "Unknown bitmap field" while ADR-058 defined it.
    symbols({ bitmapFields: flags() });
    expect(
      errors(
        "Flags f;\nvoid t() {\n    u8 a <- f.bit_length;\n    u8 b <- f.byte_length;\n}",
      ),
    ).toEqual([]);
  });
});

describe("BitmapAccessAnalyzer (E0883)", () => {
  it("rejects bracket indexing on a bitmap VARIABLE -- the route codegen could not see", () => {
    symbols({ bitmapFields: flags() });
    const [found] = errors("Flags f;\nvoid t() {\n    bool b <- f[0];\n}");
    expect(found.code).toBe("E0883");
    expect(found.message).toBe(
      "Cannot use bracket indexing on bitmap type 'Flags'",
    );
  });

  it("rejects it through a register member typed by a bitmap, read and written", () => {
    symbols({
      bitmapFields: flags(),
      knownRegisters: new Set(["R"]),
      registerMemberAccess: new Map([["R__CTRL", "rw"]]),
      registerMemberTypes: new Map([["R__CTRL", "Flags"]]),
    });
    const found = errors(
      [
        "void t() {",
        "    bool b <- R.CTRL[0];",
        "    R.CTRL[1] <- true;",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.line])).toEqual([
      ["E0883", 2],
      ["E0883", 3],
    ]);
  });

  it("accepts the named-field form on both routes", () => {
    symbols({
      bitmapFields: flags(),
      knownRegisters: new Set(["R"]),
      registerMemberAccess: new Map([["R__CTRL", "rw"]]),
      registerMemberTypes: new Map([["R__CTRL", "Flags"]]),
    });
    expect(
      errors(
        [
          "Flags f;",
          "void t() {",
          "    bool a <- f.Enable;",
          "    f.Mode <- 1;",
          "    bool b <- R.CTRL.Enable;",
          "    R.CTRL.Mode <- 1;",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});
