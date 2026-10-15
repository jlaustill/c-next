import { describe, expect, it } from "vitest";
import CPointerArgumentAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/CPointerArgumentAnalyzer";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1991: the check walks 1.2's syntax. A call by name to a C function with a
 * pointer parameter is checked argument by argument; anything chained after
 * the call is not a call by name.
 */
const at = (body: string[]): string[] => {
  const symbolTable = new SymbolTable();
  for (const [name, type] of [
    ["take", "uint8_t *"],
    ["peek", "const uint8_t *"],
    ["any", "void *"],
  ]) {
    symbolTable.addCSymbol({
      name,
      kind: "function",
      sourceLanguage: ESourceLanguage.C,
      sourceFile: "c.h",
      span: TestSourceSpan.at(1),
      visibility: "public",
      type: "uint8_t",
      parameters: [{ name: "p", type, isConst: false, isArray: false }],
    });
  }
  const source = ["void t() {", ...body.map((line) => `    ${line}`), "}"].join(
    "\n",
  );
  const { syntax, context } = testAnalysisContextFor(source, {
    symbolTable,
    cppMode: false,
  });
  return new CPointerArgumentAnalyzer(context)
    .analyze(syntax)
    .map((e) => `${e.code}@${e.line}:${e.column} ${e.message}`);
};

describe("CPointerArgumentAnalyzer on 1.2's syntax (#1991)", () => {
  it("warns that C-Next cannot see what a C function does with a pointer", () => {
    expect(at(["u8 b <- 1;", "take(b);", "any(b);"])).toEqual([
      "E0896@3:9 C-Next cannot see how 'take' uses parameter 1, so passing 'b' to it is not memory safe",
      "E0896@4:8 C-Next cannot see how 'any' uses parameter 1, so passing 'b' to it is not memory safe",
    ]);
  });

  it("rejects an argument of another type, spelt as written", () => {
    expect(at(["u16 w <- 1;", "take(w);"])).toEqual([
      "E0895@3:9 'w' is uint16_t, and parameter 1 of 'take' points to uint8_t",
    ]);
  });

  it("rejects a const argument only where the C pointer is not const", () => {
    expect(at(["u8 c <- 1;", "take(c);", "peek(c);"])).toEqual([
      "E0895@3:9 'c' is const uint8_t, and parameter 1 of 'take' is a pointer 'take' may write through",
      "E0896@4:9 C-Next cannot see how 'peek' uses parameter 1, so passing 'c' to it is not memory safe",
    ]);
  });

  it("checks no call with anything chained after it", () => {
    expect(at(["u8 b <- 1;", "u8 r <- take(b)[0];"])).toEqual([]);
  });
});
