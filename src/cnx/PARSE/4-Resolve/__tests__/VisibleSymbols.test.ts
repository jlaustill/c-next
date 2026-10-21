/**
 * Unit tests for VisibleSymbols.
 *
 * Moved from `TSymbolInfoAdapter.test.ts` with #1511, following the composition
 * they exercise. `convert()` stayed in 1.3 Declare because "what does this file
 * declare?" is per-file; these cover "what may this file SEE?", which is not.
 */
import ProgramLowering from "../../2-Parse/ProgramLowering";
import { describe, expect, it } from "vitest";
import VisibleSymbols from "../VisibleSymbols";
import type IBitmapFieldLayout from "../../../types/IBitmapFieldLayout";
import TSymbolInfoAdapter from "../../3-Declare/cnx/adapters/TSymbolInfoAdapter";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import IBitmapSymbol from "../../../types/symbols/IBitmapSymbol";
import TestSymbolUtils from "../../3-Declare/cnx/__tests__/testSymbolUtils";
import TestSourceSpan from "../../../types/__testUtils__/testSourceSpan";
import TestMembers from "../../../types/__testUtils__/testMembers";
import CnxSourceParser from "../../2-Parse/CnxSourceParser";
import CnxResolver from "../../3-Declare/cnx/index";
import SymbolRegistry from "../../3-Declare/SymbolRegistry";

/** What a file declares, as 1.3 converts it */
const declared = (source: string, path: string) =>
  TSymbolInfoAdapter.convert(
    CnxResolver.resolve(
      ProgramLowering.program(CnxSourceParser.parse(source).tree, null),
      path,
      new SymbolRegistry(),
    ).symbols,
  );

describe("VisibleSymbols", () => {
  // #1760 second review: only a struct's NAME crossed, so a field of an
  // included struct had no type and no position could type its initializer
  describe("mergeExternalSymbols — struct fields", () => {
    const lib = declared(
      "struct Batch {\n    u32[2] items;\n    u8 n;\n}\n",
      "lib.cnx",
    );

    it("carries a struct's fields, array fields and dimensions across", () => {
      const merged = VisibleSymbols.mergeExternalSymbols(
        declared("u32 x <- 1;\n", "main.cnx"),
        [lib],
      );

      expect(merged.structFields.get("Batch")?.get("n")).toBe("u8");
      expect(merged.structFieldArrays.get("Batch")?.has("items")).toBe(true);
      expect(merged.structFieldDimensions.get("Batch")?.get("items")).toEqual([
        2,
      ]);
    });

    it("keeps the local struct when both files declare one", () => {
      const merged = VisibleSymbols.mergeExternalSymbols(
        declared("struct Batch {\n    u16 only;\n}\n", "main.cnx"),
        [lib],
      );

      expect(merged.structFields.get("Batch")?.has("only")).toBe(true);
      expect(merged.structFields.get("Batch")?.has("n")).toBe(false);
    });

    it("does not alias the included file's field sets", () => {
      const merged = VisibleSymbols.mergeExternalSymbols(
        declared("u32 x <- 1;\n", "main.cnx"),
        [lib],
      );

      expect(merged.structFieldArrays.get("Batch")).not.toBe(
        lib.structFieldArrays.get("Batch"),
      );
    });
  });

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
});
