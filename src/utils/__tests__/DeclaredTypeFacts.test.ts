/**
 * `DeclaredTypeFacts.isStruct` -- the one implementation of the struct decision.
 *
 * ## Where these tests came from (#1656)
 *
 * Five of them are migrated from `SymbolLookupHelper.test.ts`, which tested one
 * of the three copies this collapsed. Two of its seven did NOT migrate, and
 * both of them were tests OF THE DEFECT rather than of the behavior:
 *
 * - *"returns false when all sources are undefined/null"* passed `null` as the
 *   symbol table. The table is a required collaborator now, so the case is not
 *   representable -- `tsc` rejects it rather than a test asserting it.
 * - *"handles symbol table without getStructFields method"* asserted that a
 *   table missing the method answers `false`. That was the hazard: the copy it
 *   tested optional-chained the METHOD, so a rename would flip the predicate
 *   silently, while the other two copies threw a `TypeError`. Required now,
 *   so a table without it is a type error at the call site.
 *
 * Retiring an assertion is not the same as migrating one, so both are named
 * here rather than quietly dropped from a count.
 */

import { describe, it, expect } from "vitest";
import DeclaredTypeFacts from "../DeclaredTypeFacts";
import type IDeclaredTypeSets from "../../transpiler/types/IDeclaredTypeSets";

function sets(
  structs: string[] = [],
  bitmaps: string[] = [],
): IDeclaredTypeSets {
  return {
    knownStructs: new Set(structs),
    knownEnums: new Set<string>(),
    knownBitmaps: new Set(bitmaps),
    bitmapBitWidth: new Map<string, number>(),
  };
}

/** A table that knows one struct, in the shape `SymbolTable` returns. */
const table = {
  getStructFields: (name: string): unknown =>
    name === "CStruct" ? new Map([["field", "int"]]) : undefined,
};

describe("DeclaredTypeFacts.isStruct", () => {
  it("answers from the per-file struct set", () => {
    expect(
      DeclaredTypeFacts.isStruct(sets(["MyStruct"]), table, "MyStruct"),
    ).toBe(true);
  });

  it("answers from the per-file bitmap set -- a bitmap is struct-like (#551)", () => {
    expect(
      DeclaredTypeFacts.isStruct(sets([], ["MyBitmap"]), table, "MyBitmap"),
    ).toBe(true);
  });

  it("falls back to the run-wide table for a struct from an included header", () => {
    // The per-file sets do not carry a header's structs, which is why both
    // sources are needed and why this takes two arguments (#1312).
    expect(DeclaredTypeFacts.isStruct(sets(), table, "CStruct")).toBe(true);
  });

  it("answers false when no source knows the name", () => {
    expect(DeclaredTypeFacts.isStruct(sets(), table, "Unknown")).toBe(false);
  });

  it("treats an absent symbol view as `nothing is known yet`, not `not a struct`", () => {
    // `sets` is nullable because the per-file view is not populated in every
    // phase. A null view must not suppress the table's answer.
    expect(DeclaredTypeFacts.isStruct(null, table, "CStruct")).toBe(true);
    expect(DeclaredTypeFacts.isStruct(null, table, "Unknown")).toBe(false);
  });

  it("distinguishes an empty field map from an absent one", () => {
    // The three copies asked `if (getStructFields(name))` -- a TRUTHINESS test
    // on a `Map`. `!== undefined` answers the same for both of these, so this
    // changes no behavior; it states the criterion as presence, which is what
    // the call sites meant, instead of leaning on `Map(0)` being truthy.
    // A zero-field struct is not reachable today anyway
    // (`SymbolTable.addStructField` always sets a field on creation).
    const empty = { getStructFields: (): unknown => new Map() };
    const absent = { getStructFields: (): unknown => undefined };

    expect(DeclaredTypeFacts.isStruct(sets(), empty, "Empty")).toBe(true);
    expect(DeclaredTypeFacts.isStruct(sets(), absent, "Gone")).toBe(false);
  });
});
