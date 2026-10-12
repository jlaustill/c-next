/**
 * CppResolver pointer and const spellings (#1991): what 1.2 lowers from `*`
 * and `const` reaches field and parameter symbols.
 */

import { describe, it, expect } from "vitest";
import CppResolver from "../index";
import SymbolTable from "../../SymbolTable";
import TestHelpers from "./testHelpers";
import ICppFunctionSymbol from "../../../../types/symbols/cpp/ICppFunctionSymbol";

function functionNamed(
  source: string,
  name: string,
): ICppFunctionSymbol | undefined {
  const header = TestHelpers.parseCpp(source);
  expect(header).not.toBeNull();
  const result = CppResolver.resolve(header!, "dev.hpp");
  return result.symbols.find(
    (symbol): symbol is ICppFunctionSymbol =>
      symbol.kind === "function" && symbol.name === name,
  );
}

describe("CppResolver pointer and const spellings", () => {
  it("keeps every `*` of a pointer field's type", () => {
    const symbolTable = new SymbolTable();
    const header = TestHelpers.parseCpp(`class Dev { int* p; int** pp; };`);
    expect(header).not.toBeNull();
    CppResolver.resolve(header!, "dev.hpp", symbolTable);

    const fields = symbolTable.getStructFields("Dev");
    expect(fields?.get("p")?.type).toBe("int*");
    expect(fields?.get("pp")?.type).toBe("int**");
  });

  it("types a named pointer parameter as a pointer", () => {
    const f = functionNamed(`struct Dev; void f(Dev* d);`, "f");
    expect(f?.parameters?.[0]).toMatchObject({ name: "d", type: "Dev*" });
  });

  it("types an unnamed pointer parameter as a pointer", () => {
    const g = functionNamed(`void g(int*);`, "g");
    expect(g?.parameters?.[0]?.type).toBe("int*");
  });

  it("leaves a value parameter's type alone", () => {
    const h = functionNamed(`void h(int n);`, "h");
    expect(h?.parameters?.[0]).toMatchObject({
      name: "n",
      type: "int",
      isConst: false,
    });
  });

  it("marks a const parameter const", () => {
    const k = functionNamed(`void k(const char* s);`, "k");
    expect(k?.parameters?.[0]).toMatchObject({ name: "s", isConst: true });
  });
});
