import { beforeEach, describe, expect, it } from "vitest";
import parse from "../cnext/__tests__/testHelpers";
import CNextResolver from "../cnext/index";
import Program from "../Program";
import SymbolGuards from "../../../types/symbols/SymbolGuards";
import SymbolRegistry from "../../../state/SymbolRegistry";
import TypeResolver from "../../../../utils/TypeResolver";
import type IFileSymbols from "../../../types/IFileSymbols";
import type TSymbol from "../../../types/symbols/TSymbol";

/**
 * 1.4 Resolve's artifact, built from real Declare output rather than hand-made
 * symbols: the questions here are about what happens when files are COMBINED,
 * and a hand-written `IFileSymbols` would let the test agree with itself about
 * a shape Declare never emits.
 */
describe("Program", () => {
  // CLAUDE.md, "Test isolation": CNextResolver writes to the SymbolRegistry.
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  const declare = (code: string, sourceFile: string): IFileSymbols =>
    CNextResolver.resolve(parse(code), sourceFile);

  const find = (symbols: ReadonlyArray<TSymbol>, name: string): TSymbol => {
    const found = symbols.find((symbol) => symbol.name === name);
    expect(found).toBeDefined();
    return found!;
  };

  describe("the scope-type index", () => {
    it("combines what every file declares, so one file settles another's bare name", () => {
      // The whole point of the pass. `lib.cnx` declares `Lib.Point`; `use.cnx`
      // reopens the scope and names `Point` bare. Declare cannot settle that --
      // it sees one file -- so it defers, and only the combined index answers.
      const lib = declare(
        `scope Lib { public struct Point { u32 x; u32 y; } }`,
        "lib.cnx",
      );
      const use = declare(
        `scope Lib { public Point origin() { return this.stored; } }`,
        "use.cnx",
      );

      const program = Program.build([lib, use]);

      expect(program.isScopeType("Lib__Point")).toBe(true);

      const origin = find(program.symbolsInFile("use.cnx"), "origin");
      expect(SymbolGuards.isFunction(origin)).toBe(true);
      if (SymbolGuards.isFunction(origin)) {
        expect(TypeResolver.getTypeName(origin.returnType)).toBe("Lib__Point");
      }
    });

    it("leaves a bare name alone when no file declares that scope type", () => {
      // The negative control for the test above. Same file, same bare `Point`,
      // and the ONLY difference is that nothing declares `Lib.Point` -- so it
      // must stay `Point` and bind the global type. Without this, a settlement
      // that qualified unconditionally would pass the positive case.
      const use = declare(
        `scope Lib { public Point origin() { return this.stored; } }`,
        "use.cnx",
      );

      const program = Program.build([use]);

      expect(program.isScopeType("Lib__Point")).toBe(false);

      const origin = find(program.symbolsInFile("use.cnx"), "origin");
      if (SymbolGuards.isFunction(origin)) {
        expect(TypeResolver.getTypeName(origin.returnType)).toBe("Point");
      }
    });
  });

  describe("external const values", () => {
    it("reads a const declared in another file", () => {
      // #1220: the case where a per-file answer was wrong. `SIZE` is declared
      // in one file and asked about from the program.
      const lib = declare(`const u32 SIZE <- 4;`, "lib.cnx");
      const use = declare(`u32 unrelated <- 1;`, "use.cnx");

      const program = Program.build([lib, use]);

      expect(program.constValue("SIZE")).toBe(4);
      expect(program.constValues().get("SIZE")).toBe(4);
    });

    it("is undefined for a non-const and for an unknown name", () => {
      const lib = declare(`u32 mutable <- 4;`, "lib.cnx");
      const program = Program.build([lib]);

      expect(program.constValue("mutable")).toBeUndefined();
      expect(program.constValue("nothingCalledThis")).toBeUndefined();
    });
  });

  describe("resolved array dimensions", () => {
    it("replaces a dimension naming a const declared in ANOTHER file", () => {
      // A dimension left as an identifier makes the generated type
      // variably-modified, which MISRA C:2012 Rule 18.8 forbids -- and the
      // const being in a different file is why 1.3 could not resolve it.
      const lib = declare(`const u32 SIZE <- 4;`, "lib.cnx");
      const use = declare(`u32[SIZE] buffer;`, "use.cnx");

      const program = Program.build([lib, use]);

      const buffer = find(program.symbolsInFile("use.cnx"), "buffer");
      if (SymbolGuards.isVariable(buffer)) {
        expect(buffer.arrayDimensions).toEqual([4]);
      }
    });

    it("leaves a dimension whose name is not a const, and keeps the symbol identity", () => {
      // The negative control, and the identity check that pins the "allocates
      // nothing when nothing moved" claim -- a rebuild that always copied would
      // pass the assertion above and fail this one.
      const use = declare(`u32[SOME_MACRO] buffer;`, "use.cnx");
      const program = Program.build([use]);

      const rebuilt = find(program.symbolsInFile("use.cnx"), "buffer");
      const declared = find(use.symbols, "buffer");
      if (SymbolGuards.isVariable(rebuilt)) {
        expect(rebuilt.arrayDimensions).toEqual(["SOME_MACRO"]);
      }
      expect(rebuilt).toBe(declared);
    });
  });

  describe("the query surface", () => {
    it("answers by canonical C name, by file, and lists its files", () => {
      const lib = declare(
        `scope Lib { public enum Mode { off, on } }`,
        "lib.cnx",
      );
      const use = declare(`u32 counter <- 0;`, "use.cnx");

      const program = Program.build([lib, use]);

      expect(program.symbolByCName("Lib__Mode")?.name).toBe("Mode");
      expect(program.symbolByCName("NoSuchThing")).toBeUndefined();
      expect(program.symbolsInFile("no-such-file.cnx")).toEqual([]);
      expect(program.sourceFiles()).toEqual(["lib.cnx", "use.cnx"]);
    });

    it("knows every enum the program declares, wherever it was declared", () => {
      // #478: header generation asks this so it does not forward-declare an
      // enum an include already defines. Aggregating it as files accumulated
      // made the answer depend on topological order; asking the artifact cannot.
      const lib = declare(`enum Palette { red, green }`, "lib.cnx");
      const use = declare(
        `scope Ui { public enum Mode { off, on } }`,
        "use.cnx",
      );

      const program = Program.build([lib, use]);

      expect(program.knownEnums().has("Palette")).toBe(true);
      expect(program.knownEnums().has("Ui__Mode")).toBe(true);
      expect(program.knownEnums().has("NotAnEnum")).toBe(false);
    });

    it("does not expose its raw tables", () => {
      // The store's own guard. `IProgram` declares functions only, so a caller
      // cannot reach the maps behind them -- which is the whole reason the
      // prior art chose "hide the collections" over gating them afterwards.
      const program = Program.build([declare(`u32 x <- 1;`, "a.cnx")]);
      const keys = Object.keys(program).sort();

      expect(keys).toEqual([
        "constValue",
        "constValues",
        "externalStructFields",
        "isScopeType",
        "knownEnums",
        "sourceFiles",
        "symbolByCName",
        "symbolsInFile",
      ]);
    });
  });
});
