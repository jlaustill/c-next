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
});
