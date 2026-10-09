/**
 * Unit tests for StructDefaultInitializer -- #1283: the one spelling of a
 * struct's ADR-029 default, for declarations and for `<Struct>_init()`.
 */
import { describe, it, expect } from "vitest";
import StructDefaultInitializer from "../StructDefaultInitializer";
import type IStructDefaultRenderContext from "../../types/IStructDefaultRenderContext";

function ctx(cppMode: boolean): IStructDefaultRenderContext {
  return {
    structFields: new Map([
      [
        "Ticker",
        new Map([
          ["handler", "onTick"],
          ["count", "u32"],
          ["mode", "Mode"],
        ]),
      ],
      [
        "Outer",
        new Map([
          ["handlers", "onTick"],
          ["inner", "Ticker"],
        ]),
      ],
      ["Plain", new Map([["v", "u8"]])],
      ["Sized", new Map([["handlers", "onTick"]])],
    ]),
    structFieldDimensions: new Map<
      string,
      Map<string, readonly (number | string)[]>
    >([
      ["Outer", new Map([["handlers", [2]]])],
      ["Sized", new Map([["handlers", ["N"]]])],
    ]),
    isCallbackType: (typeName) => typeName === "onTick",
    cppMode,
    enumZeroOf: (typeName) => (typeName === "Mode" ? "Mode__IDLE" : null),
  };
}

describe("StructDefaultInitializer", () => {
  it("is null for a struct whose default is all zero", () => {
    expect(StructDefaultInitializer.render("Plain", [], ctx(false))).toBeNull();
  });

  it("names only the non-zero fields by designator in C", () => {
    expect(StructDefaultInitializer.render("Ticker", [], ctx(false))).toBe(
      "{ .handler = onTick, .mode = Mode__IDLE }",
    );
  });

  it("spells every field in order in C++, zero fields as {}", () => {
    expect(StructDefaultInitializer.render("Ticker", [], ctx(true))).toBe(
      "{ onTick, {}, Mode__IDLE }",
    );
  });

  it("fills every element of a callback array and nests structs", () => {
    // #1565 / #1570
    expect(StructDefaultInitializer.render("Outer", [], ctx(false))).toBe(
      "{ .handlers = { onTick, onTick }, .inner = { .handler = onTick, .mode = Mode__IDLE } }",
    );
  });

  it("repeats the default over every element of a declared array", () => {
    expect(StructDefaultInitializer.render("Ticker", [2, 1], ctx(true))).toBe(
      "{ { { onTick, {}, Mode__IDLE } }, { { onTick, {}, Mode__IDLE } } }",
    );
  });

  it("refuses an array size it cannot count", () => {
    expect(() =>
      StructDefaultInitializer.render("Sized", [], ctx(false)),
    ).toThrow("'N' is not a size C-Next can evaluate");
  });
});
