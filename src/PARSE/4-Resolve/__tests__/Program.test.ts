import { beforeEach, describe, expect, it } from "vitest";
import parse from "../../3-Declare/cnext/__tests__/testHelpers";
import CNextResolver from "../../3-Declare/cnext/index";
import Program from "../Program";
import SymbolGuards from "../../../transpiler/types/symbols/SymbolGuards";
import SymbolRegistry from "../../../transpiler/state/SymbolRegistry";
import TypeResolver from "../../../utils/TypeResolver";
import type IFileSymbols from "../../../transpiler/types/IFileSymbols";
import type TSymbol from "../../../transpiler/types/symbols/TSymbol";
import type TCSymbol from "../../../transpiler/types/symbols/c/TCSymbol";

/**
 * 1.4 Resolve's artifact, built from real Declare output rather than hand-made
 * symbols: the questions here are about what happens when files are COMBINED,
 * and a hand-written `IFileSymbols` would let the test agree with itself about
 * a shape Declare never emits.
 */
/** A program with no headers behind it, for tests that vary one field. */
const noForeign = {
  c: [],
  cpp: [],
  opaqueTypedefs: new Set<string>(),
  typedefToTag: new Map<string, string>(),
  structTagsWithBodies: new Set<string>(),
};

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

  describe("the copy a scope holds", () => {
    it("settles a scope member's parameter type, not just the file's own list", () => {
      // `IScopeSymbol.functions` is type-bearing, and it was excluded from the
      // settle on the stated grounds that "scope carries no TType". It does:
      // each entry is an `IFunctionSymbol` with a return type and parameter
      // types. 37 corpus fixtures carried an unsettled type here.
      const lib = declare(
        `scope Chip { public struct Point { u32 x; } }`,
        "lib.cnx",
      );
      const use = declare(
        `scope Chip { public u32 area(Point p) { return p.x; } }`,
        "use.cnx",
      );

      Program.build([lib, use]);

      const scope = SymbolRegistry.getScope("Chip");
      expect(scope).toBeDefined();
      const area = scope!.functions.find((f) => f.name === "area");
      expect(area).toBeDefined();
      expect(TypeResolver.getTypeName(area!.parameters[0].type)).toBe(
        "Chip__Point",
      );
    });

    it("is the SAME object the file's symbol list holds, not an equal copy", () => {
      // The property a corpus fixture cannot assert. Settling the registry's
      // copy separately would make both readers correct and still leave two
      // objects, so the next writer to either one reintroduces the divergence
      // silently. One original settles to one object.
      const lib = declare(
        `scope Chip { public struct Point { u32 x; } }`,
        "lib.cnx",
      );
      const use = declare(
        `scope Chip { public u32 area(Point p) { return p.x; } }`,
        "use.cnx",
      );

      const program = Program.build([lib, use]);

      const fromProgram = find(program.symbolsInFile("use.cnx"), "area");
      const fromRegistry = SymbolRegistry.getScope("Chip")!.functions.find(
        (f) => f.name === "area",
      );

      expect(fromRegistry).toBe(fromProgram);
    });

    it("leaves a sibling file's scope member for that file's own settle", () => {
      // A scope spanned across files (#1333) is ONE object holding every
      // contributing file's functions. Settling all of them while processing
      // the first would overwrite what the second file settles, so the settle
      // consults its memo of what THIS file declared. Both end up settled;
      // neither clobbers the other.
      const lib = declare(
        `scope Chip { public struct Point { u32 x; } }`,
        "lib.cnx",
      );
      const a = declare(
        `scope Chip { public u32 areaA(Point p) { return p.x; } }`,
        "a.cnx",
      );
      const b = declare(
        `scope Chip { public u32 areaB(Point p) { return p.x; } }`,
        "b.cnx",
      );

      Program.build([lib, a, b]);

      const functions = SymbolRegistry.getScope("Chip")!.functions;
      for (const name of ["areaA", "areaB"]) {
        const fn = functions.find((f) => f.name === name);
        expect(fn, name).toBeDefined();
        expect(TypeResolver.getTypeName(fn!.parameters[0].type), name).toBe(
          "Chip__Point",
        );
      }
    });
  });

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

    it("keys a scope's const by its C name as well as its bare name (#1322)", () => {
      // `this.STEP` inside `Board` asks for `Board__STEP`; the bare `STEP` is
      // what a dimension written as `STEP` inside the scope asks for. Two
      // scopes declaring the same bare name must not share one slot.
      const lib = declare(
        `scope Board {\n    const u8 STEP <- 12;\n}\nscope Other {\n    const u8 STEP <- 3;\n}`,
        "lib.cnx",
      );
      const program = Program.build([lib]);

      expect(program.constValue("Board__STEP")).toBe(12);
      expect(program.constValue("Other__STEP")).toBe(3);
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

  describe("typesDeclaredIn", () => {
    // #1511: which kinds form a type used to be filtered inside
    // ExternalTypeHeaderBuilder, over whole symbols it was handed. The rule
    // moved here with the fact, so it is asserted here -- a mock at the old
    // site would have re-applied the rule and passed whether or not production
    // agreed with it.
    const cSymbol = (name: string, kind: string): TCSymbol =>
      ({
        name,
        kind,
        sourceFile: "types.h",
        span: { line: 1, column: 0 },
        visibility: "public",
      }) as unknown as TCSymbol;

    const typesIn = (
      kinds: ReadonlyArray<[string, string]>,
    ): ReadonlySet<string> =>
      Program.build([], new Map(), {
        ...noForeign,
        c: kinds.map(([name, kind]) => cSymbol(name, kind)),
      }).typesDeclaredIn("types.h");

    it.each([["struct"], ["type"], ["enum"], ["class"]])(
      "counts a %s as a type the header declares",
      (kind) => {
        expect(typesIn([["Named", kind]]).has("Named")).toBe(true);
      },
    );

    it.each([["function"], ["variable"]])(
      "does not count a %s as a type",
      (kind) => {
        expect(typesIn([["named", kind]]).has("named")).toBe(false);
      },
    );

    it("is empty for a file that declares no types", () => {
      expect(typesIn([["doSomething", "function"]]).size).toBe(0);
    });

    it("reports the types a C-Next file declares under its own path", () => {
      const lib = declare(
        `struct Point { u32 x; } enum Color { RED }`,
        "lib.cnx",
      );
      const program = Program.build([lib]);

      expect([...program.typesDeclaredIn("lib.cnx")].sort()).toEqual([
        "Color",
        "Point",
      ]);
    });

    it("is empty for a file the program never saw", () => {
      expect(Program.build([]).typesDeclaredIn("absent.h").size).toBe(0);
    });
  });

  describe("isOpaqueType", () => {
    // #1511: resolved once when the artifact is built, from the RAW bookkeeping
    // the C collectors recorded. The rule itself is shared with SymbolTable via
    // OpaqueTypeResolution, so these assert the artifact applies it, not a
    // second copy of it.
    const withOpacity = (
      opaqueTypedefs: string[],
      typedefToTag: Array<[string, string]>,
      structTagsWithBodies: string[],
    ) =>
      Program.build([], new Map(), {
        ...noForeign,
        opaqueTypedefs: new Set(opaqueTypedefs),
        typedefToTag: new Map(typedefToTag),
        structTagsWithBodies: new Set(structTagsWithBodies),
      });

    it("is opaque when the tag never received a body", () => {
      const program = withOpacity(
        ["widget_t"],
        [["widget_t", "_widget_t"]],
        [],
      );
      expect(program.isOpaqueType("widget_t")).toBe(true);
    });

    it("is not opaque once a body arrives for its tag", () => {
      // The cross-file case: the forward declaration and the definition can come
      // from different headers, which is why this cannot be decided per file.
      const program = withOpacity(
        ["widget_t"],
        [["widget_t", "_widget_t"]],
        ["_widget_t"],
      );
      expect(program.isOpaqueType("widget_t")).toBe(false);
    });

    it("is not opaque for a typedef nothing declared opaque", () => {
      expect(withOpacity([], [], []).isOpaqueType("widget_t")).toBe(false);
    });

    it("treats an empty tag as no tag, so a body cannot cancel it", () => {
      // Negative control for the guard's shape: it is truthy, not an undefined
      // check, so "" never matches a tag that has a body.
      const program = withOpacity(["widget_t"], [["widget_t", ""]], [""]);
      expect(program.isOpaqueType("widget_t")).toBe(true);
    });

    it("reports every resolved opaque typedef", () => {
      const program = withOpacity(
        ["widget_t", "obj_t"],
        [
          ["widget_t", "_widget_t"],
          ["obj_t", "_obj_t"],
        ],
        ["_obj_t"],
      );
      expect([...program.opaqueTypes()]).toEqual(["widget_t"]);
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
        "conflicts",
        "constValue",
        "constValues",
        "constValuesIn",
        "externalStructFields",
        "isOpaqueType",
        "isScopeType",
        "knownEnums",
        "opaqueTypes",
        "sourceFiles",
        "symbolByCName",
        "symbolsInFile",
        "typesDeclaredIn",
      ]);
    });
  });
});
