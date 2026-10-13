/**
 * #1991: 2.2 plans the type each value is written against (MISRA 7.2's `U`,
 * a bare enum member's qualification, a struct initializer's type) before 2.3
 * writes it, from 2.1's one walk of where each value stands. 2.3 checks every
 * value it writes against this plan.
 */
import { describe, it, expect } from "vitest";
import ProgramGeneration from "./ProgramGeneration";
import TestSymbolTable from "../../../../cnx/TRANSPILE/__tests__/TestSymbolTable";
import CodeGenWalker from "../../../../cnx/TRANSPILE/CodeGenWalker";
import CodeGenerator from "../../../../cnx/TRANSPILE/3-Render/codegen/CodeGenerator";
import CNextSourceParser from "../../../../cnx/PARSE/2-Parse/CNextSourceParser";
import ProgramLowering from "../../../../cnx/PARSE/2-Parse/ProgramLowering";
import SymbolTable from "../../../../cnx/PARSE/3-Declare/SymbolTable";
import CNextResolver from "../../../../cnx/PARSE/3-Declare/cnext/index";
import TSymbolInfoAdapter from "../../../../cnx/PARSE/3-Declare/cnext/adapters/TSymbolInfoAdapter";
import SymbolRegistry from "../../../../cnx/PARSE/3-Declare/SymbolRegistry";
import Program from "../../../../cnx/PARSE/4-Resolve/Program";

/** Each literal's planned type, keyed by its text */
function plannedLiteralTypes(source: string): Map<string, string | null> {
  const parsed = CNextSourceParser.parse(source);
  expect(parsed.parseErrors).toEqual([]);
  const registry = new SymbolRegistry();
  const declared = CNextResolver.resolve(
    ProgramLowering.program(parsed.tree, null),
    "test.cnx",
    registry,
  );
  const symbols = [
    ...Program.build([declared], { cppMode: false, registry }).symbolsInFile(
      "test.cnx",
    ),
  ];
  const symbolTable = new SymbolTable();
  symbolTable.addTSymbols(symbols);
  const host = new CodeGenerator();
  const generator = new CodeGenWalker(host);
  TestSymbolTable.install(host.state, symbolTable);
  const plan = ProgramGeneration.plan(
    generator,
    parsed.tree,
    parsed.program,
    {
      cppMode: false,
      symbolInfo: TSymbolInfoAdapter.convert(symbols),
      sourcePath: "test.cnx",
    },
    new SymbolRegistry(),
  );
  const types = new Map<string, string | null>();
  for (const entry of plan.expectedTypes) {
    if (entry[0].kind === "literal") types.set(entry[0].text, entry[1].type);
  }
  return types;
}

describe("2.2 plans the type each value is written against", () => {
  it("takes it from the innermost site that names a type", () => {
    const types = plannedLiteralTypes(
      [
        "struct P { u8 a; }",
        "u32 f(u8[4] buf, u8 i) {",
        "  u8 x <- 5;",
        "  x <- 6;",
        "  P p <- { a: 7 };",
        "  x <- buf[2];",
        "  return 1;",
        "}",
        "",
      ].join("\n"),
    );
    expect(types.get("5")).toBe("u8");
    expect(types.get("6")).toBe("u8");
    expect(types.get("7")).toBe("u8");
    expect(types.get("2")).toBe("size_t");
    expect(types.get("1")).toBe("u32");
  });

  it("gives a comparison operand, a target's index and a copied string none", () => {
    const types = plannedLiteralTypes(
      [
        "void f(u8[4] buf) {",
        "  bool b <- buf[0] = 9;",
        "  buf[3] <- 4;",
        '  string<8> s <- "ab";',
        "}",
        "",
      ].join("\n"),
    );
    expect(types.get("9")).toBeNull();
    expect(types.get("3")).toBeNull();
    expect(types.get('"ab"')).toBeNull();
    expect(types.get("4")).toBe("u8");
  });

  it("gives a scope's string its C type", () => {
    const types = plannedLiteralTypes(
      'scope Names {\n  public string<8> first <- "cd";\n}\n',
    );
    expect(types.get('"cd"')).toBe("char");
  });
});
