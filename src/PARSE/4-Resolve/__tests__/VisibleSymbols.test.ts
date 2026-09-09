/**
 * Unit tests for VisibleSymbols.
 *
 * Moved from `TSymbolInfoAdapter.test.ts` with #1511, following the composition
 * they exercise. `convert()` stayed in 1.3 Declare because "what does this file
 * declare?" is per-file; these cover "what may this file SEE?", which is not.
 */
import { describe, expect, it } from "vitest";
import VisibleSymbols from "../VisibleSymbols";
import type IBitmapFieldLayout from "../../../transpiler/types/IBitmapFieldLayout";
import TSymbolInfoAdapter from "../../3-Declare/cnext/adapters/TSymbolInfoAdapter";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import IBitmapSymbol from "../../../transpiler/types/symbols/IBitmapSymbol";
import IVariableSymbol from "../../../transpiler/types/symbols/IVariableSymbol";
import TypeResolver from "../../../utils/TypeResolver";
import TestSymbolUtils from "../../3-Declare/cnext/__tests__/testSymbolUtils";
import TestSourceSpan from "../../../transpiler/types/__testUtils__/testSourceSpan";
import TestMembers from "../../../transpiler/types/__testUtils__/testMembers";

describe("VisibleSymbols", () => {
  describe("mergeExternalSymbols — bitmap detail maps", () => {
    const makeBitmap = (
      name: string,
      fields: Map<string, IBitmapFieldLayout> = new Map([
        ["Ready", { offset: 0, width: 1 }],
        ["Mode", { offset: 1, width: 3 }],
      ]),
    ): IBitmapSymbol => ({
      ...TestSymbolUtils.base({
        kind: "bitmap",
        name,
        scopePath: "",
        sourceFile: "lib.cnx",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.CNext,
        visibility: "public",
      }),
      backingType: "uint8_t",
      bitWidth: 8,
      // #1318: lift at the USE site -- the factory's parameter stays the plain
      // offset/width record its callers pass, so only this line knows fields
      // are symbols now.
      fields: TestMembers.asBitmapFields(name, fields),
    });

    it("carries a bitmap's fields, backing type and bit width across the boundary", () => {
      const base = TSymbolInfoAdapter.convert([]);
      const external = TSymbolInfoAdapter.convert([makeBitmap("Flags")]);

      const merged = VisibleSymbols.mergeExternalSymbols(base, [external]);

      expect(merged.knownBitmaps.has("Flags")).toBe(true);
      // The name alone is what used to cross; these three are the fix.
      expect(merged.bitmapFields.get("Flags")?.get("Mode")).toEqual({
        offset: 1,
        width: 3,
      });
      expect(merged.bitmapBackingType.get("Flags")).toBe("uint8_t");
      expect(merged.bitmapBitWidth.get("Flags")).toBe(8);
    });

    it("keeps the local definition when both files declare the same bitmap", () => {
      const local = makeBitmap(
        "Flags",
        new Map([["Ready", { offset: 7, width: 1 }]]),
      );

      const base = TSymbolInfoAdapter.convert([local]);
      const external = TSymbolInfoAdapter.convert([makeBitmap("Flags")]);

      const merged = VisibleSymbols.mergeExternalSymbols(base, [external]);

      // Local takes precedence, matching how enumMembers already merges.
      expect(merged.bitmapFields.get("Flags")?.get("Ready")).toEqual({
        offset: 7,
        width: 1,
      });
      expect(merged.bitmapFields.get("Flags")?.has("Mode")).toBe(false);
    });

    it("returns the base unchanged when there are no external sources", () => {
      const base = TSymbolInfoAdapter.convert([makeBitmap("Flags")]);

      expect(VisibleSymbols.mergeExternalSymbols(base, [])).toBe(base);
    });
  });
  describe("mergeExternalSymbols — file-scope value names (#1398)", () => {
    const makeFileScopeConst = (name: string): IVariableSymbol => ({
      ...TestSymbolUtils.base({
        kind: "variable",
        name,
        scopePath: "",
        sourceFile: "lib.cnx",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.CNext,
        visibility: "public",
      }),
      type: TypeResolver.resolve("u32"),
      isConst: true,
      isAtomic: false,
      isVolatile: false,
      overflowBehavior: "clamp",
      isArray: false,
      initialValue: "42",
    });

    /**
     * The value-axis twin of the bitmap test above. #1333 fixed this same
     * asymmetry between two kinds of TYPE in this same function; #1398 is the
     * kind of asymmetry one axis over -- a type declared in an included file
     * crossed and a const beside it did not, so E0426 fired across a file
     * boundary and E0427 could not.
     *
     * Asserted here rather than only through `declared-value-resolves` because
     * the integration control reaches this line by traversal: deleting the
     * `_mergeNames` call reddens a `.cnx` fixture three layers away, and per
     * CLAUDE.md's "presence is not proof", an assertion beside the line is the
     * one that cannot be satisfied by accident.
     */
    it("carries a file-scope value name across the boundary", () => {
      const base = TSymbolInfoAdapter.convert([]);
      const external = TSymbolInfoAdapter.convert([
        makeFileScopeConst("SHARED_LIMIT"),
      ]);

      const merged = VisibleSymbols.mergeExternalSymbols(base, [external]);

      expect(merged.knownVariables.has("SHARED_LIMIT")).toBe(true);
    });

    it("keeps the local file's own value names when merging", () => {
      const base = TSymbolInfoAdapter.convert([
        makeFileScopeConst("OWN_LIMIT"),
      ]);
      const external = TSymbolInfoAdapter.convert([
        makeFileScopeConst("SHARED_LIMIT"),
      ]);

      const merged = VisibleSymbols.mergeExternalSymbols(base, [external]);

      expect(merged.knownVariables.has("OWN_LIMIT")).toBe(true);
      expect(merged.knownVariables.has("SHARED_LIMIT")).toBe(true);
    });
  });
});
