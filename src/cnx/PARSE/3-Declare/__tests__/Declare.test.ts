/** 1.3 `Declare`: each file 1.2 parsed, declared, its syntax carried on (#1991) */
import { describe, expect, it } from "vitest";

import Declare from "../Declare";
import Discover from "../../1-Discover/Discover";
import Parse from "../../2-Parse/Parse";
import testSourceGraph from "../../1-Discover/__testUtils__/testSourceGraph";
import EFileType from "../../1-Discover/types/EFileType";
import EHeaderLanguage from "../../1-Discover/types/EHeaderLanguage";
import type IHeaderSource from "../../1-Discover/types/IHeaderSource";
import type TCachedHeaderRead from "../../1-Discover/types/TCachedHeaderRead";

/** 1.2 then 1.3 over one C-Next file and `headers`, as 1.1 would settle them */
function declareWithHeaders(
  headers: ReadonlyArray<readonly [string, IHeaderSource]>,
  extra: {
    cachedHeaders?: ReadonlyMap<string, TCachedHeaderRead>;
    slices?: ReadonlyMap<string, IHeaderSource & { directive: null }>;
  } = {},
) {
  return Declare.sources(
    Parse.sources({
      ...testSourceGraph([Discover.inMemoryFile("u32 n <- 0;", "/p/a.cnx")]),
      headerFiles: headers.map(([path, source]) => ({
        path,
        type:
          source.language === EHeaderLanguage.Cpp
            ? EFileType.CppHeader
            : EFileType.CHeader,
        extension: path.slice(path.lastIndexOf(".")),
      })),
      headerSources: new Map(headers),
      cachedHeaders: extra.cachedHeaders ?? new Map(),
      recoveredDeclarations: extra.slices
        ? { slices: extra.slices, macroNames: new Set(["SYS_MACRO"]) }
        : null,
    }),
  );
}

describe("Declare.sources", () => {
  it("declares each parsed file and carries 1.2's syntax forward for 1.4 and 2.1", () => {
    const parsed = Parse.sources(
      testSourceGraph([Discover.inMemoryFile("u32 counter <- 0;", "/p/a.cnx")]),
    );
    const { sources } = parsed;
    const { declared, errors, discovery, targetCatalog } =
      Declare.sources(parsed);

    expect(errors).toEqual([]);
    expect(
      declared.map((d) => d.fileSymbols.symbols.map((s) => s.name)),
    ).toEqual([["counter"]]);
    expect(declared[0].syntax).toBe(sources[0].syntax);
    expect(declared[0].file).toBe(sources[0].file);
    expect(discovery).toBe(parsed.discovery);
    expect(targetCatalog).toBe(parsed.targetCatalog);
  });
});

describe("Declare.sources headers (#1991: 1.3 builds the run's table)", () => {
  const C = (text: string): IHeaderSource => ({
    text,
    language: EHeaderLanguage.C,
  });

  it("declares a C header with the C parser and records it for the cache", () => {
    const { symbolTable, headers } = declareWithHeaders([
      ["/p/a.h", C("int add(int a, int b);")],
    ]);

    expect(symbolTable.getCSymbolsByFile("/p/a.h").map((s) => s.name)).toEqual([
      "add",
    ]);
    expect(headers.processed).toBe(1);
    expect(headers.declared.map((h) => h.path)).toEqual(["/p/a.h"]);
    expect(headers.declared[0].record.symbols.map((s) => s.name)).toEqual([
      "add",
    ]);
  });

  it("declares a C++ header with the C++ parser", () => {
    const { symbolTable } = declareWithHeaders([
      [
        "/p/a.hpp",
        { text: "namespace hw { int read(); }", language: EHeaderLanguage.Cpp },
      ],
    ]);

    expect(symbolTable.getCppSymbolsByFile("/p/a.hpp").length).toBeGreaterThan(
      0,
    );
    expect(symbolTable.getCSymbolsByFile("/p/a.hpp")).toEqual([]);
  });

  it("declares nothing from an assembler header", () => {
    const { symbolTable } = declareWithHeaders([
      [
        "/p/a.S",
        { text: ".macro loop\n.endm", language: EHeaderLanguage.Assembler },
      ],
    ]);

    expect(symbolTable.getSymbolsByFile("/p/a.S")).toEqual([]);
  });

  it("restores a header 1.1 read from the cache instead of parsing it", () => {
    const first = declareWithHeaders([["/p/a.h", C("int add(int a, int b);")]]);
    const record = first.headers.declared[0].record;

    const { symbolTable, headers } = declareWithHeaders(
      [["/p/a.h", C("this text is not read")]],
      { cachedHeaders: new Map([["/p/a.h", { kind: "cached", record }]]) },
    );

    expect(symbolTable.getCSymbolsByFile("/p/a.h").map((s) => s.name)).toEqual([
      "add",
    ]);
    expect(headers.processed).toBe(1);
    expect(headers.declared).toEqual([]);
  });

  it("warns on a header whose cache read threw, and declares the rest (#1319)", () => {
    const { symbolTable, headers } = declareWithHeaders(
      [
        ["/p/bad.h", C("int bad(void);")],
        ["/p/b.h", C("int good(void);")],
      ],
      {
        cachedHeaders: new Map([
          ["/p/bad.h", { kind: "failed", error: new Error("unreadable") }],
        ]),
      },
    );

    expect(headers.warnings).toEqual([
      "Failed to process header /p/bad.h: Error: unreadable",
    ]);
    expect(headers.processed).toBe(1);
    expect(symbolTable.getCSymbolsByFile("/p/bad.h")).toEqual([]);
    expect(symbolTable.getCSymbolsByFile("/p/b.h").map((s) => s.name)).toEqual([
      "good",
    ]);
  });

  it("snapshots each record when its header is declared, not at the end", () => {
    const { headers } = declareWithHeaders([
      ["/p/a.h", C("typedef struct a_s a_t;")],
      ["/p/b.h", C("typedef struct b_s b_t;")],
    ]);

    const [a, b] = headers.declared.map((h) => h.record.structState);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("recovers #985's slices into the table and names their macros", () => {
    const { symbolTable } = declareWithHeaders([], {
      slices: new Map([
        ["/p/sys.h", { ...C("int sys_tick(void);"), directive: null }],
      ]),
    });

    expect(
      symbolTable.getCSymbolsByFile("/p/sys.h").map((s) => s.name),
    ).toContain("sys_tick");
    expect(symbolTable.hasExternalDeclaration("SYS_MACRO")).toBe(true);
  });
});
