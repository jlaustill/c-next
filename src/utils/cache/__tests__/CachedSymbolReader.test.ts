/**
 * Unit tests for CachedSymbolReader (issue #1225).
 *
 * The reader is the boundary between "JSON on disk" and "symbols the transpiler
 * trusts". Both halves of an entry must fail the same way — as a cache miss —
 * because the alternatives are the two defects this issue is about: aborting a
 * transpile, or restoring a silently empty fact.
 */
import { describe, it, expect } from "vitest";
import CachedSymbolReader from "../CachedSymbolReader";
import JsonCodec from "../JsonCodec";
import SymbolTable from "../../../transpiler/logic/symbols/SymbolTable";
import ESourceLanguage from "../../types/ESourceLanguage";
import TJsonValue from "../../types/TJsonValue";
import TestSourceSpan from "../../../transpiler/types/__testUtils__/testSourceSpan";

const C_FUNCTION = {
  name: "use_handle",
  kind: "function",
  type: "int",
  sourceFile: "/lib/handles.h",
  span: TestSourceSpan.at(22),
  sourceLanguage: ESourceLanguage.C,
  visibility: "public",
};

/** Struct state as the serializer really produces it. */
function realStructState(): TJsonValue {
  const table = new SymbolTable();
  table.markPointerTypedef("handle_t");
  table.markOpaqueType("widget_t");
  table.registerStructTagAlias("_widget", "widget_t");
  return JsonCodec.encode(table.serializeStructState());
}

describe("CachedSymbolReader", () => {
  describe("read (symbols)", () => {
    it("revives a C symbol", () => {
      const symbols = CachedSymbolReader.read([JsonCodec.encode(C_FUNCTION)]);

      expect(symbols).not.toBeNull();
      expect(symbols![0]).toMatchObject({
        name: "use_handle",
        kind: "function",
        span: TestSourceSpan.at(22),
      });
    });

    it("rejects the whole entry when one symbol is unrecognizable", () => {
      // Not "skip the bad one": a partially-understood entry is what a
      // half-written cache looks like, and reading it is how a warm build ends
      // up knowing less than a cold one.
      const encoded = [
        JsonCodec.encode(C_FUNCTION),
        JsonCodec.encode({ junk: 1 }),
      ];

      expect(CachedSymbolReader.read(encoded)).toBeNull();
    });

    it.each([
      [
        "a kind its language does not define",
        { ...C_FUNCTION, kind: "bitmap" },
      ],
      [
        "a C-Next symbol",
        { ...C_FUNCTION, sourceLanguage: ESourceLanguage.CNext },
      ],
      ["a missing sourceFile", { ...C_FUNCTION, sourceFile: undefined }],
      // #1318: `sourceLine` became a four-integer `span`, so one typeof check
      // became four. Each branch of `isSpan` gets its own row -- a single
      // "malformed span" case would pass with three of the four checks deleted.
      ["a missing span", { ...C_FUNCTION, span: undefined }],
      ["a non-object span", { ...C_FUNCTION, span: 22 }],
      ["a null span", { ...C_FUNCTION, span: null }],
      [
        "a span whose line is not a number",
        { ...C_FUNCTION, span: { ...C_FUNCTION.span, line: "22" } },
      ],
      [
        "a span whose column is not a number",
        { ...C_FUNCTION, span: { ...C_FUNCTION.span, column: "0" } },
      ],
      [
        "a span whose endLine is missing",
        { ...C_FUNCTION, span: { ...C_FUNCTION.span, endLine: undefined } },
      ],
      [
        "a span whose endColumn is missing",
        { ...C_FUNCTION, span: { ...C_FUNCTION.span, endColumn: undefined } },
      ],
      ["a missing visibility", { ...C_FUNCTION, visibility: undefined }],
      [
        "a visibility TVisibility does not define",
        { ...C_FUNCTION, visibility: "protected" },
      ],
      ["a non-object entry", "not a symbol"],
    ])("rejects %s", (_label, symbol) => {
      expect(CachedSymbolReader.read([JsonCodec.encode(symbol)])).toBeNull();
    });

    it("accepts an empty entry", () => {
      expect(CachedSymbolReader.read([])).toStrictEqual([]);
    });
  });

  describe("readStructState", () => {
    it("accepts state the serializer produced, preserving every fact", () => {
      const state = CachedSymbolReader.readStructState(realStructState());

      expect(state).not.toBeNull();
      const restored = new SymbolTable();
      restored.restoreStructState(state!);
      expect(restored.isPointerTypedef("handle_t")).toBe(true);
      expect(restored.isOpaqueType("widget_t")).toBe(true);
    });

    it("rejects a field of the wrong type instead of throwing (#1225 review)", () => {
      // `new Map(5)` throws "number 5 is not iterable", which would abort the
      // transpile rather than read as a miss.
      const corrupt = {
        ...(realStructState() as object),
        typedefStructTypes: 5,
      };

      expect(() =>
        CachedSymbolReader.readStructState(corrupt as TJsonValue),
      ).not.toThrow();
      expect(
        CachedSymbolReader.readStructState(corrupt as TJsonValue),
      ).toBeNull();
    });

    it("rejects state that is merely missing a key (#1225 review)", () => {
      // This is what every stored entry looks like the moment
      // IStructSymbolState gains a field. `new Set(undefined)` is an empty Set,
      // so without this check the warm build would silently not know the fact —
      // which is #1225 itself, arriving through the other half of the entry.
      const partial = { ...(realStructState() as Record<string, TJsonValue>) };
      delete partial.pointerTypedefs;

      expect(CachedSymbolReader.readStructState(partial)).toBeNull();
    });

    it.each([
      ["undefined", undefined],
      ["null", null],
      ["an array", []],
      ["a string", "opaqueTypes"],
      ["entries of the wrong shape", { opaqueTypes: [["a", "b", "c"]] }],
      ["entries that are not strings", { opaqueTypes: [1, 2] }],
    ])("rejects %s", (_label, value) => {
      expect(
        CachedSymbolReader.readStructState(value as TJsonValue | undefined),
      ).toBeNull();
    });

    it("validates against keys derived from the serializer, not a list", () => {
      // If this ever diverges, the reader is validating a shape the writer no
      // longer produces — the exact drift #1225 was.
      const produced = Object.keys(new SymbolTable().serializeStructState());

      expect(SymbolTable.structStateKeys()).toStrictEqual(produced);
    });
  });
});
