/**
 * Where CResolver takes a typedef or variable name from, on 1.2's lowered
 * header (#1991): the first declarator, else the declaration specifiers.
 */
import { describe, it, expect } from "vitest";
import CResolver from "../index";
import SymbolTable from "../../SymbolTable";
import TestHelpers from "./testHelpers";

function resolve(source: string, table: SymbolTable): string[] {
  return CResolver.resolve(
    TestHelpers.parseC(source)!,
    "t.h",
    table,
  ).symbols.map((s) => `${s.kind}:${s.name}`);
}

describe("CResolver typedef names", () => {
  it("names a pointer typedef after its first declarator", () => {
    const table = new SymbolTable();
    expect(resolve("typedef struct Node *NodePtr;", table)).toEqual([
      "struct:Node",
      "type:NodePtr",
    ]);
    expect(table.isPointerTypedef("NodePtr")).toBe(true);
  });

  it("does not declare a variable that repeats the enum's own tag", () => {
    expect(resolve("enum Mode { A } Mode;", new SymbolTable())).toEqual([
      "enum:Mode",
      "enum_member:A",
    ]);
  });

  it("does not declare a variable that repeats the struct's own tag", () => {
    expect(
      resolve("struct Point { int x; } Point;", new SymbolTable()),
    ).not.toContain("variable:Point");
  });
});
