/**
 * Issue #957: Test pointer typedef detection
 */

import { describe, expect, it } from "vitest";
import CResolver from "../index";
import TestHelpers from "./testHelpers";
import SymbolTable from "../../../../transpiler/logic/symbols/SymbolTable";

describe("Issue #957 - Pointer Typedef Detection", () => {
  it("should NOT mark pointer typedef as opaque", () => {
    const symbolTable = new SymbolTable();
    const tree = TestHelpers.parseC(
      `typedef struct spi_device_t *spi_device_handle_t;`,
    );

    CResolver.resolve(tree!, "test.h", symbolTable);

    // spi_device_handle_t should NOT be marked as opaque
    // because the typedef has a pointer declarator (*spi_device_handle_t)
    expect(symbolTable.isOpaqueType("spi_device_handle_t")).toBe(false);
  });

  it("should mark forward-declared struct typedef as opaque", () => {
    const symbolTable = new SymbolTable();
    const tree = TestHelpers.parseC(`typedef struct _widget_t widget_t;`);

    CResolver.resolve(tree!, "test.h", symbolTable);

    // widget_t SHOULD be marked as opaque because it's a forward declaration
    // without a pointer declarator
    expect(symbolTable.isOpaqueType("widget_t")).toBe(true);
  });

  it("should unmark opaque when full definition follows", () => {
    const symbolTable = new SymbolTable();
    const tree = TestHelpers.parseC(`
      typedef struct _widget_t widget_t;
      struct _widget_t { int x; };
    `);

    CResolver.resolve(tree!, "test.h", symbolTable);

    // widget_t should NOT be opaque because full definition was found
    expect(symbolTable.isOpaqueType("widget_t")).toBe(false);
  });
});

describe("Issue #1178 - typedef records declarator indirection", () => {
  /** The `type` a resolver recorded for the named typedef. */
  const recordedTypedefType = (source: string, name: string): string => {
    const tree = TestHelpers.parseC(source);
    const { symbols } = CResolver.resolve(tree!, "test.h", new SymbolTable());
    const typedef = symbols.find((s) => s.kind === "type" && s.name === name);
    expect(typedef).toBeDefined();
    return (typedef as { type: string }).type;
  };

  it("keeps the pointer of a pointer typedef", () => {
    // The `*` lives in the declarator, not the declaration specifiers. Dropping
    // it told consumers a handle was the struct itself, so "can the callee
    // write through this parameter?" was answered no.
    expect(
      recordedTypedefType(
        `typedef struct Sample *SampleHandle;`,
        "SampleHandle",
      ),
    ).toContain("*");
  });

  it("records a plain typedef without inventing indirection", () => {
    expect(
      recordedTypedefType(`typedef unsigned char byte_t;`, "byte_t"),
    ).not.toContain("*");
  });

  it("records the declarator's pointer depth, not merely its presence", () => {
    // The symbol model is shared; a consumer that wants the pointer wants the
    // right number of them.
    expect(
      recordedTypedefType(`typedef struct Sample **Grid;`, "Grid"),
    ).toContain("**");
  });

  it("still reconstructs a function-pointer typedef", () => {
    expect(
      recordedTypedefType(`typedef void (*Callback)(int);`, "Callback"),
    ).toContain("(*)");
  });
});
