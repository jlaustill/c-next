/**
 * #1668: `DeclaredPointer` -- whether a declaration is a C pointer, the one
 * decision the emitted declaration and its type info both read.
 */
import { describe, expect, it } from "vitest";
import HeaderParser from "../../PARSE/2-Parse/HeaderParser";
import CResolver from "../../PARSE/3-Declare/c/index";
import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import DeclaredPointer from "../DeclaredPointer";

function header(source: string): SymbolTable {
  const table = new SymbolTable();
  const tree = HeaderParser.parseC(source).tree;
  table.addCSymbols(CResolver.resolve(tree!, "api.h", table).symbols);
  return table;
}

describe("DeclaredPointer.of", () => {
  const c = header(`#include <stdio.h>
typedef struct widget widget_t;
typedef struct { int v; } handle_t;
widget_t *widget_create(void);
handle_t *handle_create(void);`);
  const facts = (
    overrides: Partial<Parameters<typeof DeclaredPointer.of>[0]>,
  ) => ({
    cType: "uint8_t",
    name: "x",
    initializerCallee: null,
    initialValue: null,
    ...overrides,
  });

  it("is a pointer when its C type already is (ADR-046 cstring)", () => {
    expect(DeclaredPointer.of(facts({ cType: "char*" }), c)).toBe(true);
  });

  it("is a pointer for an opaque C typedef struct (#958)", () => {
    expect(DeclaredPointer.of(facts({ cType: "widget_t" }), c)).toBe(true);
  });

  it("is not for a typedef struct with a body (#948), control", () => {
    expect(DeclaredPointer.of(facts({ cType: "handle_t" }), c)).toBe(false);
  });

  it("is a pointer when initialized from a C function returning T* (#895)", () => {
    expect(
      DeclaredPointer.of(
        facts({
          cType: "handle_t",
          initializerCallee: "handle_create",
          initialValue: "handle_create()",
        }),
        c,
      ),
    ).toBe(true);
  });

  it("is not when the C function returns a different pointer", () => {
    expect(
      DeclaredPointer.of(
        facts({
          cType: "uint8_t",
          initializerCallee: "widget_create",
          initialValue: "widget_create()",
        }),
        c,
      ),
    ).toBe(false);
  });

  it("is a pointer for a c_ variable from a struct-pointer function (ADR-046)", () => {
    expect(
      DeclaredPointer.of(
        facts({ cType: "FILE", name: "c_f", initialValue: 'fopen("a","r")' }),
        c,
      ),
    ).toBe(true);
  });

  it("is not without the c_ prefix", () => {
    expect(
      DeclaredPointer.of(
        facts({ cType: "FILE", name: "f", initialValue: 'fopen("a","r")' }),
        c,
      ),
    ).toBe(false);
  });

  it("is not with no initializer, beyond its own type", () => {
    expect(DeclaredPointer.of(facts({ cType: "handle_t" }), c)).toBe(false);
  });
});
