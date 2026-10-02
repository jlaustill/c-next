import { beforeEach, describe, expect, it, vi } from "vitest";
import ConstantFold from "../../../utils/ConstantFold";
import parse from "../../3-Declare/cnext/__tests__/testHelpers";
import CNextResolver from "../../3-Declare/cnext/index";
import Program from "../Program";
import SymbolGuards from "../../../transpiler/types/symbols/SymbolGuards";
import type IVariableSymbol from "../../../transpiler/types/symbols/IVariableSymbol";
import type IStructSymbol from "../../../transpiler/types/symbols/IStructSymbol";
import type IFunctionSymbol from "../../../transpiler/types/symbols/IFunctionSymbol";
import SymbolRegistry from "../../3-Declare/SymbolRegistry";
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

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

describe("Program", () => {
  // CLAUDE.md, "Test isolation": CNextResolver writes to the SymbolRegistry.

  const declare = (code: string, sourceFile: string): IFileSymbols =>
    CNextResolver.resolve(parse(code), sourceFile, registry);

  const find = (symbols: ReadonlyArray<TSymbol>, name: string): TSymbol => {
    const found = symbols.find((symbol) => symbol.name === name);
    expect(found).toBeDefined();
    return found!;
  };

  /**
   * #1724: a program whose files include each other as `graph` says -- each
   * file to its DIRECT includes. A scope type is visible only through this
   * graph, so a test about one file reading another's must say that it
   * includes it, as the program it models would.
   */
  const including = (graph: Record<string, string[]>) => ({
    visibility: {
      cnextIncludesByFile: new Map(
        Object.entries(graph).map(([file, includes]) => [
          file,
          includes.map((path) => ({ path })),
        ]),
      ),
    },
  });

  // #1760 review: a file the program does not hold is a caller's bug. The
  // binding accessors used to fall back to "no locals" for one, which loses
  // every shadowing decision with no error, while lexicalFrameAt asserted.
  describe("a file the program does not hold", () => {
    const at = { line: 1, column: 0 };

    it("is an internal error for every lexical accessor", () => {
      const program = Program.build([declare("u32 x <- 1;", "a.cnx")]);
      expect(() => program.bindValue("nope.cnx", null, "x", at)).toThrow(
        "nope.cnx is a file of this program",
      );
      expect(() => program.lexicalDeclarationAt("nope.cnx", "x", at)).toThrow(
        "nope.cnx is a file of this program",
      );
      expect(() => program.lexicalFrameAt("nope.cnx", at)).toThrow(
        "nope.cnx is a file of this program",
      );
    });

    it("still answers for a file it holds", () => {
      const program = Program.build([declare("u32 x <- 1;", "a.cnx")]);
      expect(program.bindValue("a.cnx", null, "x", at)).toMatchObject({
        kind: "variable",
      });
      expect(program.lexicalDeclarationAt("a.cnx", "x", at)).toBeNull();
    });
  });

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

      Program.build([lib, use], including({ "use.cnx": ["lib.cnx"] }));

      const scope = registry.getScope("Chip");
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

      const program = Program.build(
        [lib, use],
        including({ "use.cnx": ["lib.cnx"] }),
      );

      const fromProgram = find(program.symbolsInFile("use.cnx"), "area");
      const fromRegistry = registry
        .getScope("Chip")!
        .functions.find((f) => f.name === "area");

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

      Program.build(
        [lib, a, b],
        including({ "a.cnx": ["lib.cnx"], "b.cnx": ["lib.cnx"] }),
      );

      const functions = registry.getScope("Chip")!.functions;
      for (const name of ["areaA", "areaB"]) {
        const fn = functions.find((f) => f.name === name);
        expect(fn, name).toBeDefined();
        expect(TypeResolver.getTypeName(fn!.parameters[0].type), name).toBe(
          "Chip__Point",
        );
      }
    });
  });

  describe("the scope types a file can see", () => {
    it("settles a bare name to a scope type an INCLUDED file declares", () => {
      // The whole point of the pass. `lib.cnx` declares `Lib.Point`; `use.cnx`
      // includes it, reopens the scope and names `Point` bare. Declare cannot
      // settle that -- it sees one file -- so it defers, and only 1.4, which
      // holds every file and the include graph, answers.
      const lib = declare(
        `scope Lib { public struct Point { u32 x; u32 y; } }`,
        "lib.cnx",
      );
      const use = declare(
        `scope Lib { public Point origin() { return this.stored; } }`,
        "use.cnx",
      );

      const program = Program.build(
        [lib, use],
        including({ "use.cnx": ["lib.cnx"] }),
      );

      expect(program.isScopeTypeVisibleFrom("use.cnx", "Lib__Point")).toBe(
        true,
      );

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

      expect(program.isScopeTypeVisibleFrom("use.cnx", "Lib__Point")).toBe(
        false,
      );

      const origin = find(program.symbolsInFile("use.cnx"), "origin");
      expect(SymbolGuards.isFunction(origin)).toBe(true);
      if (SymbolGuards.isFunction(origin)) {
        expect(TypeResolver.getTypeName(origin.returnType)).toBe("Point");
      }
    });

    it("does not settle a bare name to a scope type from a file it does not include (#1724)", () => {
      // The same two files as the positive case, both in the program, and the
      // ONLY difference is the missing include. `Lib.Point` exists in the run
      // but not where `use.cnx` can see it, so the bare `Point` binds the
      // global type -- a C typedef, in #1724 -- and not `Lib__Point`, which
      // `use.cnx`'s generated C has no declaration of.
      const lib = declare(
        `scope Lib { public struct Point { u32 x; u32 y; } }`,
        "lib.cnx",
      );
      const use = declare(
        `scope Lib { public Point origin() { return this.stored; } }`,
        "use.cnx",
      );

      const program = Program.build([lib, use]);

      expect(program.isScopeTypeVisibleFrom("use.cnx", "Lib__Point")).toBe(
        false,
      );
      expect(program.isScopeTypeVisibleFrom("lib.cnx", "Lib__Point")).toBe(
        true,
      );

      const origin = find(program.symbolsInFile("use.cnx"), "origin");
      expect(SymbolGuards.isFunction(origin)).toBe(true);
      if (SymbolGuards.isFunction(origin)) {
        expect(TypeResolver.getTypeName(origin.returnType)).toBe("Point");
      }
    });

    it("sees a scope type through the whole include closure, not only direct includes", () => {
      // `use.cnx` reaches `lib.cnx` through `mid.cnx`. A visibility that read
      // only a file's direct includes would pass both tests above and fail here.
      const lib = declare(
        `scope Lib { public struct Point { u32 x; u32 y; } }`,
        "lib.cnx",
      );
      const mid = declare(`u32 unrelated <- 1;`, "mid.cnx");
      const use = declare(
        `scope Lib { public Point origin() { return this.stored; } }`,
        "use.cnx",
      );

      const program = Program.build(
        [lib, mid, use],
        including({ "use.cnx": ["mid.cnx"], "mid.cnx": ["lib.cnx"] }),
      );

      expect(program.isScopeTypeVisibleFrom("use.cnx", "Lib__Point")).toBe(
        true,
      );
      const origin = find(program.symbolsInFile("use.cnx"), "origin");
      expect(SymbolGuards.isFunction(origin)).toBe(true);
      if (SymbolGuards.isFunction(origin)) {
        expect(TypeResolver.getTypeName(origin.returnType)).toBe("Lib__Point");
      }
    });
  });

  describe("constant values", () => {
    it("reads a const declared in another file", () => {
      // #1220: the case where a per-file answer was wrong. `SIZE` is declared
      // in one file and asked about from another.
      // #1760 second review: a file sees a const its include closure
      // declares, so the program states the include, as the one it models
      // would.
      const lib = declare(`const u32 SIZE <- 4;`, "lib.cnx");
      const use = declare(`u32 unrelated <- 1;`, "use.cnx");

      const program = Program.build(
        [lib, use],
        including({ "use.cnx": ["lib.cnx"] }),
      );

      expect(
        program.constantAt("use.cnx", "SIZE", { line: 1, column: 0 }),
      ).toEqual({ value: 4, typeName: "u32" });
    });

    // #1760 second review: the fold repeated rounds over every pending
    // const, O(n^2) in reverse dependency order. The guard counts attempts.
    it.each([
      [
        "dependency",
        (i: number, _n: number) => (i === 0 ? "1" : `C${i - 1} + 1`),
      ],
      [
        "reverse dependency",
        (i: number, n: number) => (i === n - 1 ? "1" : `C${i + 1} + 1`),
      ],
    ])(
      "folds a chain of consts in %s order with a linear number of attempts",
      (_order, initializer) => {
        const n = 200;
        const source = Array.from(
          { length: n },
          (_, i) => `const u32 C${i} <- ${initializer(i, n)};`,
        ).join("\n");
        const attempts = vi.spyOn(ConstantFold, "declared");
        try {
          const program = Program.build([declare(source, "lib.cnx")]);
          expect(
            program.constantAt("lib.cnx", "C0", { line: n + 1, column: 0 })
              ?.value,
          ).toBeGreaterThan(0);
          expect(attempts.mock.calls.length).toBeLessThanOrEqual(2 * n);
        } finally {
          attempts.mockRestore();
        }
      },
    );

    it("reads no const from a file it does not include (#1738)", () => {
      const lib = declare(`const u32 SIZE <- 4;`, "lib.cnx");
      const use = declare(`u32 unrelated <- 1;`, "use.cnx");

      const program = Program.build([lib, use]);

      expect(
        program.constantAt("use.cnx", "SIZE", { line: 1, column: 0 }),
      ).toBeNull();
    });

    it("keys a scope's const by its declaration, never by a bare name two scopes share (#1322, #1538)", () => {
      // `this.STEP` inside `Board` binds `Board__STEP`, and so does a bare
      // `STEP` written there. Two scopes declaring the same bare name must not
      // share one slot, and neither's bare name is a file-scope const.
      const lib = declare(
        `scope Board {\n    const u8 STEP <- 12;\n}\nscope Other {\n    const u8 STEP <- 3;\n}\nu32 after <- 1;`,
        "lib.cnx",
      );
      const program = Program.build([lib]);
      const valueOf = (cName: string) =>
        program.constantOf({
          kind: "variable",
          symbol: program.symbolByCName(cName) as IVariableSymbol,
        })?.value;

      expect(valueOf("Board__STEP")).toBe(12);
      expect(valueOf("Other__STEP")).toBe(3);
      expect(
        program.constantAt("lib.cnx", "STEP", { line: 2, column: 4 })?.value,
      ).toBe(12);
      expect(
        program.constantAt("lib.cnx", "STEP", { line: 5, column: 4 })?.value,
      ).toBe(3);
      expect(
        program.constantAt("lib.cnx", "STEP", { line: 7, column: 0 }),
      ).toBeNull();
    });

    it("is null for a non-const and for an unknown name", () => {
      const lib = declare(`u32 mutable <- 4;\nu32 after <- 1;`, "lib.cnx");
      const program = Program.build([lib]);
      const at = { line: 2, column: 0 };

      expect(program.constantAt("lib.cnx", "mutable", at)).toBeNull();
      expect(program.constantAt("lib.cnx", "nothingCalledThis", at)).toBeNull();
    });

    it("gives a name that binds to a parameter no value, whatever a const of that name holds (#1664 review)", () => {
      // The const views held folded consts only, so the parameter `N` was
      // absent and the file-scope `N` answered for it.
      const lib = declare(
        `const u32 N <- 10;\nvoid f(u32 N) {\n    u32 x <- N;\n}\nu32 after <- 1;`,
        "lib.cnx",
      );
      const program = Program.build([lib]);

      expect(
        program.constantAt("lib.cnx", "N", { line: 3, column: 13 }),
      ).toBeNull();
      // NEGATIVE CONTROL: outside `f`, `N` is the const
      expect(
        program.constantAt("lib.cnx", "N", { line: 5, column: 0 })?.value,
      ).toBe(10);
    });
  });

  describe("resolved array dimensions", () => {
    it("replaces a dimension naming a const declared in ANOTHER file", () => {
      // A dimension left as an identifier makes the generated type
      // variably-modified, which MISRA C:2012 Rule 18.8 forbids -- and the
      // const being in a different file is why 1.3 could not resolve it.
      const lib = declare(`const u32 SIZE <- 4;`, "lib.cnx");
      const use = declare(`u32[SIZE] buffer;`, "use.cnx");

      const program = Program.build(
        [lib, use],
        including({ "use.cnx": ["lib.cnx"] }),
      );

      const buffer = find(program.symbolsInFile("use.cnx"), "buffer");
      expect(SymbolGuards.isVariable(buffer)).toBe(true);
      if (SymbolGuards.isVariable(buffer)) {
        expect(buffer.arrayDimensions).toEqual([4]);
      }
    });

    it("leaves a dimension naming a const in a file it does not include (#1738)", () => {
      // #1760 second review: the run-wide lookup sized this 4, over whatever
      // the file itself could see -- a header macro, in #1738's case
      const lib = declare(`const u32 SIZE <- 4;`, "lib.cnx");
      const use = declare(`u32[SIZE] buffer;`, "use.cnx");

      const program = Program.build([lib, use]);

      const buffer = find(program.symbolsInFile("use.cnx"), "buffer");
      expect(SymbolGuards.isVariable(buffer)).toBe(true);
      if (SymbolGuards.isVariable(buffer)) {
        expect(buffer.arrayDimensions).toEqual(["SIZE"]);
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

    // #1664 box 7: 1.4 is the one place a const-named dimension folds, for
    // every kind of declaration, with the consts visible where it is written
    const dimensionsOf = (source: string, name: string) => {
      const symbol = find(
        Program.build([declare(source, "a.cnx")]).symbolsInFile("a.cnx"),
        name,
      );
      expect(SymbolGuards.isVariable(symbol)).toBe(true);
      return (symbol as IVariableSymbol).arrayDimensions;
    };

    it("folds a const derived from another const, in either order", () => {
      expect(
        dimensionsOf(`const u32 A <- 4;\nconst u32 B <- A;\nu8[B] g;`, "g"),
      ).toEqual([4]);
      expect(
        dimensionsOf(`u8[B] g;\nconst u32 B <- A;\nconst u32 A <- 4;`, "g"),
      ).toEqual([4]);
    });

    it("folds a scope member's dimension with its own scope's const (#1538)", () => {
      const twoScopes = (first: string, second: string) =>
        [first, second].join("\n");
      const small = "scope Small {\nconst u8 N <- 2;\npublic u8[N] t;\n}";
      const big = "scope Big {\nconst u8 N <- 10;\npublic u8[N] b;\n}";
      for (const source of [twoScopes(small, big), twoScopes(big, small)]) {
        expect(dimensionsOf(source, "t")).toEqual([2]);
        expect(dimensionsOf(source, "b")).toEqual([10]);
      }
    });

    it("lets a scope's own const shadow a file-scope one even when it does not fold (#1664 review)", () => {
      // `7 % 4` does not fold here, so the view of folded consts had no scope
      // `N` and gave the global's 1: `S__buf[1]` for a program whose `S.N`
      // is 3.
      expect(
        dimensionsOf(
          `const u32 N <- 1;\nscope S {\nconst u32 N <- 7 % 4;\npublic u8[N] buf;\n}`,
          "buf",
        ),
      ).toEqual(["N"]);
    });

    it("folds a scope const with its own scope's names, whichever is declared first (#1664 review)", () => {
      expect(
        dimensionsOf(
          `const u32 N <- 4;\nscope S {\nconst u32 M <- N;\nconst u32 N <- 10;\npublic u8[M] buf;\n}`,
          "buf",
        ),
      ).toEqual([10]);
    });

    it("does not fold a result an operand's type cannot hold (#1664 review)", () => {
      // ADR-044: `A - 3` on a u8 is 0 in C, and `E + E` is 255
      expect(
        dimensionsOf(`const u8 A <- 2;\nconst u8 B <- A - 3;\nu8[B] g;`, "g"),
      ).toEqual(["B"]);
      expect(
        dimensionsOf(`const u8 E <- 200;\nconst u8 F <- E + E;\nu8[F] g;`, "g"),
      ).toEqual(["F"]);
      // Literal operands have no type of their own, so the const's declared
      // type is the one that must hold the result: C stores 260 in a u8 as 4
      expect(dimensionsOf(`const u8 X <- 250 + 10;\nu8[X] g;`, "g")).toEqual([
        "X",
      ]);
      // NEGATIVE CONTROL: a result every operand's type holds
      expect(
        dimensionsOf(`const u8 A <- 2;\nconst u8 G <- A + 3;\nu8[G] g;`, "g"),
      ).toEqual([5]);
    });

    it("folds a struct field's dimension", () => {
      const program = Program.build([
        declare(`const u32 A <- 4;\nstruct P {\n  u8[A] data;\n}`, "a.cnx"),
      ]);
      const struct = find(program.symbolsInFile("a.cnx"), "P");
      expect(SymbolGuards.isStruct(struct)).toBe(true);
      expect((struct as IStructSymbol).fields.get("data")?.dimensions).toEqual([
        4,
      ]);
    });

    it("folds a parameter's dimension", () => {
      const program = Program.build([
        declare(`const u32 A <- 4;\nvoid f(u8[A] buf) {\n}`, "a.cnx"),
      ]);
      const fn = find(program.symbolsInFile("a.cnx"), "f");
      expect(SymbolGuards.isFunction(fn)).toBe(true);
      expect((fn as IFunctionSymbol).parameters[0].arrayDimensions).toEqual([
        4,
      ]);
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
      Program.build([], {
        headerStructFields: new Map(),
        foreign: {
          ...noForeign,
          c: kinds.map(([name, kind]) => cSymbol(name, kind)),
        },
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

    it("reports a scope's types by the C names a header names them with", () => {
      // A header's signature says `Lib__Point`. Recorded as bare `Point`, no
      // include was found to declare it, so the header forward-declared it
      // after including lib.h -- a typedef redefinition C99 forbids -- and a
      // scoped `Data` could answer for a C typedef `Data` in another header.
      const lib = declare(
        `scope Lib { public struct Point { u32 x; } public enum Data { ONE } }`,
        "lib.cnx",
      );
      const program = Program.build([lib]);

      expect([...program.typesDeclaredIn("lib.cnx")].sort()).toEqual([
        "Lib__Data",
        "Lib__Point",
      ]);
    });

    it("is empty for a file the program never saw", () => {
      expect(Program.build([]).typesDeclaredIn("absent.h").size).toBe(0);
    });
  });

  describe("an opaque parameter (#1722)", () => {
    // ADR-030: whether a parameter holds an opaque handle is decided ONCE, onto
    // the settled parameter. The `.c` signature, the `.c` call sites and the
    // `.h` prototype all read this stamp; none of them asks the type again, so
    // they cannot disagree about one parameter.
    const withFunction = (structTagsWithBodies: string[]) =>
      Program.build(
        [declare(`void use(Dev d, Dev[2] ds, Full f, u32 n) {\n}\n`, "a.cnx")],
        {
          headerStructFields: new Map(),
          foreign: {
            ...noForeign,
            opaqueTypedefs: new Set(["Dev", "Full"]),
            typedefToTag: new Map([
              ["Dev", "_Dev"],
              ["Full", "_Full"],
            ]),
            structTagsWithBodies: new Set(structTagsWithBodies),
          },
        },
      );

    const stampsOf = (program: ReturnType<typeof withFunction>) => {
      const use = program.symbolByCName("use");
      expect(use && SymbolGuards.isFunction(use)).toBe(true);
      return SymbolGuards.isFunction(use!)
        ? use.parameters.map((p) => [p.name, p.isOpaqueHandle === true])
        : [];
    };

    it("stamps a parameter of an opaque type, and an array of handles", () => {
      // `Full`'s tag receives a body, so it is complete and passes as any struct.
      expect(stampsOf(withFunction(["_Full"]))).toEqual([
        ["d", true],
        ["ds", true],
        ["f", false],
        ["n", false],
      ]);
    });

    it("control: a type whose tag received a body is not stamped", () => {
      expect(stampsOf(withFunction(["_Dev", "_Full"]))).toEqual([
        ["d", false],
        ["ds", false],
        ["f", false],
        ["n", false],
      ]);
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
      Program.build([], {
        headerStructFields: new Map(),
        foreign: {
          ...noForeign,
          opaqueTypedefs: new Set(opaqueTypedefs),
          typedefToTag: new Map(typedefToTag),
          structTagsWithBodies: new Set(structTagsWithBodies),
        },
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

  describe("resolveFunction (#1698)", () => {
    // Where a bare call's lookup starts is decided here, once: the typer and
    // the C name a call is emitted under pass the scope path they stand in,
    // and used to derive the start scope from it themselves.
    const program = (): ReturnType<typeof Program.build> =>
      Program.build(
        [
          declare(
            `u32 get() { return 1; }
u32 other() { return 2; }
scope Gauge {
  u8 get() { return 3; }
}`,
            "a.cnx",
          ),
        ],
        { registry },
      );

    it("finds a scope's own function before a global of the same name", () => {
      expect(program().resolveFunction("get", "Gauge")?.scopePath).toBe(
        "Gauge",
      );
    });

    it("walks out to the global scope from inside a scope", () => {
      expect(program().resolveFunction("other", "Gauge")?.name).toBe("other");
    });

    it("starts at the global scope at file scope and for an unknown path", () => {
      expect(program().resolveFunction("get", "")?.scopePath).toBe("");
      expect(program().resolveFunction("get", "NoSuchScope")?.scopePath).toBe(
        "",
      );
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
        "bindValue",
        "callGraph",
        "callbackCompatibleFunctions",
        "cnextAlternatives",
        "cnxIncludeRewrites",
        "codeGenSymbolsFor",
        "conflicts",
        "constantAt",
        "constantOf",
        "externalStructFields",
        "functionParamLists",
        "includeResolutions",
        "isOpaqueType",
        "isScopeTypeVisibleFrom",
        "knownEnums",
        "lexicalDeclarationAt",
        "lexicalFrameAt",
        "modifiedParameters",
        "opaqueTypes",
        "passByValueParams",
        "quotedIncludeDirectory",
        "resolveFunction",
        "scope",
        "scopePathOf",
        "sourceFiles",
        "symbolByCName",
        "symbolsInFile",
        "target",
        "typesDeclaredIn",
      ]);
    });
  });
});
