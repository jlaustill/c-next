/**
 * Issue #957: Test pointer typedef detection
 */

import { describe, expect, it } from "vitest";
import CResolver from "../index";
import TestHelpers from "./testHelpers";
import SymbolTable from "../../SymbolTable";

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
