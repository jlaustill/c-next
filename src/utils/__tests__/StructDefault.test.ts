/**
 * Unit tests for StructDefault -- #1283 / #1570 / #1565: which fields of a
 * struct ADR-029 gives a non-zero default.
 */
import { describe, it, expect } from "vitest";
import StructDefault from "../StructDefault";
import type IStructDefaultFacts from "../../types/IStructDefaultFacts";

function facts(
  structs: Record<string, Record<string, string>>,
  callbacks: string[] = ["onTick"],
): IStructDefaultFacts {
  return {
    structFields: new Map(
      Object.entries(structs).map(([name, fields]) => [
        name,
        new Map(Object.entries(fields)),
      ]),
    ),
    isCallbackType: (typeName) => callbacks.includes(typeName),
  };
}

describe("StructDefault", () => {
  it("gives a callback field its function", () => {
    const f = facts({ Ticker: { handler: "onTick", count: "u32" } });

    expect(StructDefault.fieldsOf("Ticker", f)).toEqual([
      {
        fieldName: "handler",
        value: { kind: "callback", functionName: "onTick" },
      },
    ]);
  });

  it("gives a nested struct field its struct's default (#1570)", () => {
    const f = facts({
      Outer: { inner: "Inner", plain: "Plain" },
      Inner: { handler: "onTick" },
      Plain: { v: "u8" },
    });

    expect(StructDefault.fieldsOf("Outer", f)).toEqual([
      {
        fieldName: "inner",
        value: { kind: "struct", structName: "Inner" },
      },
    ]);
  });

  it("does not depend on declaration order (#1570)", () => {
    const innerFirst = facts({
      Inner: { handler: "onTick" },
      Outer: { inner: "Inner" },
    });
    const outerFirst = facts({
      Outer: { inner: "Inner" },
      Inner: { handler: "onTick" },
    });

    expect(StructDefault.fieldsOf("Outer", outerFirst)).toEqual(
      StructDefault.fieldsOf("Outer", innerFirst),
    );
  });

  it("has no default for an all-zero struct or a non-struct", () => {
    const f = facts({ Plain: { v: "u8" } });

    expect(StructDefault.hasDefault("Plain", f)).toBe(false);
    expect(StructDefault.hasDefault("u32", f)).toBe(false);
  });
  describe("factsOf (#1283 review: one builder for every reader)", () => {
    it("reads the struct table and the C-Next functions", () => {
      const structFields = new Map([
        ["Ticker", new Map([["handler", "onTick"]])],
      ]);
      const f = StructDefault.factsOf({
        structFields,
        functionReturnTypes: new Map([["onTick", "u32"]]),
      });

      expect(f.structFields).toBe(structFields);
      expect(f.isCallbackType("onTick")).toBe(true);
      expect(f.isCallbackType("Ticker")).toBe(false);
    });
  });

  describe("initializedPaths", () => {
    const f = facts({
      Ticker: { handler: "onTick", count: "u32" },
      Inner: { handler: "onTick" },
      Holder: { ticker: "Ticker", inner: "Inner", total: "u32" },
      Deep: { holder: "Holder" },
    });

    it("names each callback field", () => {
      expect(StructDefault.initializedPaths("Ticker", f)).toEqual(["handler"]);
    });

    it("names a nested struct whole when its default covers every field", () => {
      expect(StructDefault.initializedPaths("Holder", f)).toContain("inner");
    });

    it("names only the defaulted paths inside a partly-defaulted struct", () => {
      expect(StructDefault.initializedPaths("Holder", f)).toEqual([
        "ticker.handler",
        "inner",
      ]);
      expect(StructDefault.initializedPaths("Deep", f)).toEqual([
        "holder.ticker.handler",
        "holder.inner",
      ]);
    });

    it("is empty for a struct with no default, or no struct", () => {
      expect(StructDefault.initializedPaths("Missing", f)).toEqual([]);
    });
  });

  describe("spelledElement", () => {
    const f = facts({
      Ticker: { handler: "onTick" },
      Plain: { v: "u8" },
    });
    const enums = new Set(["Mode"]);

    it.each([
      [{ kind: "struct", name: "onTick" }, null, "onTick"],
      [{ kind: "struct", name: "Ticker" }, null, "Ticker"],
      [
        {
          kind: "array",
          elementType: { kind: "struct", name: "Ticker" },
          dimensions: [2],
        },
        null,
        "Ticker",
      ],
      [{ kind: "enum", name: "Mode" }, "Ticker", "Mode"],
      [{ kind: "enum", name: "Mode" }, "Plain", null],
      [{ kind: "enum", name: "Mode" }, null, null],
      [{ kind: "struct", name: "Plain" }, null, null],
      [{ kind: "primitive", primitive: "u8" }, null, null],
    ] as const)("%j in %s spells %s", (type, owner, expected) => {
      expect(StructDefault.spelledElement(type, owner, f, enums)).toBe(
        expected,
      );
    });
  });
});
