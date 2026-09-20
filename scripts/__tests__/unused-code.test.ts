/**
 * #1556: the filter that separates authored dead code from generated output.
 *
 * The whole risk here is over-filtering. A check that drops too much reports
 * "no unused declarations" forever and looks exactly like a clean codebase,
 * so every case below has a counterpart that must survive.
 */

import UnusedCode from "../unused-code/UnusedCode";

/** The real shape: three distinct `-o` roots across four antlr scripts. */
const SCRIPTS: Record<string, string> = {
  antlr: "antlr4ng -o src/transpiler/logic/parser grammar/CNext.g4",
  "antlr:c": "antlr4ng -o src/transpiler/logic/parser/c grammar/C.g4",
  "antlr:cpp:lexer":
    "antlr4ng -o src/transpiler/logic/parser/cpp grammar/CPP14Lexer.g4",
  "antlr:cpp": "npm run antlr:cpp:lexer && npm run antlr:cpp:parser",
  build: "esbuild src/index.ts",
};

describe("UnusedCode.generatedRoots (#1556)", () => {
  it("collects EVERY antlr script's -o, not just the first", () => {
    // The C and C++ roots nest under the C-Next one, so reading only `antlr`
    // covered them by accident. Move either out and the accident stops
    // holding -- a dozen generated findings become "authored dead code" with
    // nothing pointing at the cause (#1580 review).
    expect(UnusedCode.generatedRoots(SCRIPTS)).toEqual([
      "src/transpiler/logic/parser",
      "src/transpiler/logic/parser/c",
      "src/transpiler/logic/parser/cpp",
    ]);
  });

  it("ignores scripts that are not antlr, and antlr scripts with no -o", () => {
    // Negative control: `build` must not contribute a root, and `antlr:cpp`
    // delegates without an -o of its own.
    expect(UnusedCode.generatedRoots(SCRIPTS)).not.toContain("src/index.ts");
    expect(UnusedCode.generatedRoots(SCRIPTS)).toHaveLength(3);
  });

  it("throws rather than defaulting when no antlr script has an -o", () => {
    // A silent fallback would pass over generated files it no longer
    // recognizes -- failing open, which is the defect #1556 is about.
    expect(() => UnusedCode.generatedRoots({ antlr: "antlr4ng x.g4" })).toThrow(
      /no `antlr\*` script has an -o/,
    );
  });
});

describe("UnusedCode.ranAtAll (#1580 review)", () => {
  it.each([
    [
      "a config error",
      "error TS5058: The specified path does not exist: 'nope.json'.",
    ],
    ["a spawn failure", "spawnSync npx ENOENT"],
    ["empty output", ""],
  ])("reports that tsc did not run for %s", (_label, output) => {
    // Each of these exits non-zero and carries no positioned diagnostic, so
    // `parse()` drops it and the finding list is empty. Treated as success the
    // gate prints "No unused declarations" and exits 0 -- indistinguishable
    // from a clean codebase.
    expect(UnusedCode.ranAtAll(output)).toBe(false);
  });

  it("reports that tsc ran when a positioned diagnostic is present", () => {
    // Control: the check must not reject real output, or it fails closed on
    // every run and is just as useless in the other direction.
    expect(
      UnusedCode.ranAtAll(
        "src/x.ts(9,1): error TS6133: 'a' is declared but its value is never read.",
      ),
    ).toBe(true);
  });
});

describe("UnusedCode.isGenerated (#1556)", () => {
  const root = UnusedCode.generatedRoots(SCRIPTS);

  it.each([
    ["src/transpiler/logic/parser/grammar/CNextParser.ts", true],
    ["src/transpiler/logic/parser/c/grammar/CLexer.ts", true],
    ["src/transpiler/logic/parser/cpp/grammar/CPP14Parser.ts", true],
  ])("treats %s as generated", (file, expected) => {
    expect(UnusedCode.isGenerated(file, root)).toBe(expected);
  });

  it.each([
    // authored code INSIDE the generated root -- the case a bare prefix test
    // would wrongly exempt
    ["src/transpiler/logic/parser/CNextSourceParser.ts", false],
    // a grammar directory OUTSIDE the root -- the case a bare "/grammar/" test
    // would wrongly exempt
    ["src/elsewhere/grammar/Handwritten.ts", false],
    ["src/transpiler/state/CodeGenState.ts", false],
  ])("treats %s as authored", (file, expected) => {
    expect(UnusedCode.isGenerated(file, root)).toBe(expected);
  });
});

describe("UnusedCode.authored (#1556)", () => {
  const output = [
    "src/transpiler/logic/parser/c/grammar/CParser.ts(4,1): error TS6133: 'Token' is declared but its value is never read.",
    "src/transpiler/state/CodeGenState.ts(906,10): error TS6133: 'isKnownRegister' is declared but its value is never read.",
    "src/utils/TTypeUtils.ts(165,10): error TS6138: Property 'isDeferred' is declared but its value is never read.",
    "src/TRANSPILE/3-Render/codegen/CodeGenerator.ts(12,6): error TS6196: 'TUnused' is declared but never used.",
    "src/transpiler/state/SymbolTable.ts(1,1): error TS2304: Cannot find name 'Foo'.",
  ].join("\n");

  it("keeps authored findings and drops generated ones", () => {
    const found = UnusedCode.authored(output, SCRIPTS);
    expect(found.map((f) => f.file)).toEqual([
      "src/transpiler/state/CodeGenState.ts",
      "src/utils/TTypeUtils.ts",
      "src/TRANSPILE/3-Render/codegen/CodeGenerator.ts",
    ]);
  });

  it("ignores diagnostics that are not about unused declarations", () => {
    // Negative control on the code filter: TS2304 above is a real error and
    // must not be reported here, or this check would duplicate `typecheck`.
    expect(
      UnusedCode.authored(output, SCRIPTS).some((f) =>
        f.message.includes("Cannot find name"),
      ),
    ).toBe(false);
  });

  it("reports position and message, not just the file", () => {
    const first = UnusedCode.authored(output, SCRIPTS)[0];
    expect(first.line).toBe(906);
    expect(first.column).toBe(10);
    expect(first.message).toContain("isKnownRegister");
  });

  it("finds nothing in empty output", () => {
    expect(UnusedCode.authored("", SCRIPTS)).toEqual([]);
  });
});
