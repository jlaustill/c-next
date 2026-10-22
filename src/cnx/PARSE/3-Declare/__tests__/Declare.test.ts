/** 1.3 `Declare`: each file 1.2 parsed, declared, its syntax carried on (#1991) */
import { describe, expect, it } from "vitest";

import Declare from "../Declare";
import Discover from "../../1-Discover/Discover";
import Parse from "../../2-Parse/Parse";
import HeaderParser from "../../2-Parse/HeaderParser";
import type TParsedHeaderEntry from "../../2-Parse/types/TParsedHeaderEntry";
import noHeaderServices from "../../2-Parse/__testUtils__/noHeaderServices";
import testSourceGraph from "../../1-Discover/__testUtils__/testSourceGraph";
import EFileType from "../../1-Discover/types/EFileType";
import EHeaderLanguage from "../../1-Discover/types/EHeaderLanguage";
import type IHeaderSource from "../../1-Discover/types/IHeaderSource";
import type TCachedHeaderRead from "../../2-Parse/types/TCachedHeaderRead";

/** 1.2 then 1.3 over one cnx file and `headers`, as 1.2 reads them */
async function declareWithHeaders(
  headers: ReadonlyArray<readonly [string, IHeaderSource]>,
  extra: {
    cachedHeaders?: ReadonlyMap<string, TCachedHeaderRead>;
    slices?: ReadonlyMap<string, IHeaderSource & { directive: null }>;
  } = {},
) {
  const parsed = await Parse.sources(
    testSourceGraph([Discover.inMemoryFile("u32 n <- 0;", "/p/a.cnx")]),
    noHeaderServices,
  );
  return Declare.sources({
    ...parsed,
    headers: headers.map(([path, source]): TParsedHeaderEntry => {
      const file = {
        path,
        type:
          source.language === EHeaderLanguage.Cpp
            ? EFileType.CppHeader
            : EFileType.CHeader,
      };
      const cached = extra.cachedHeaders?.get(path);
      if (cached !== undefined) return { file, ...cached };
      try {
        return {
          file,
          kind: "parsed",
          language: source.language,
          parsed: HeaderParser.parse(source),
        };
      } catch (error) {
        return { file, kind: "failed", error };
      }
    }),
    recovered: extra.slices
      ? {
          slices: [...extra.slices].map(([path, slice]) => ({
            path,
            parsed: HeaderParser.parse(slice),
            asC: HeaderParser.parseC(slice.text).syntax,
          })),
          macroNames: new Set(["SYS_MACRO"]),
        }
      : null,
  });
}

describe("Declare.sources", () => {
  it("declares each parsed file and carries 1.2's syntax forward for 1.4 and 2.1", async () => {
    const parsed = await Parse.sources(
      testSourceGraph([Discover.inMemoryFile("u32 counter <- 0;", "/p/a.cnx")]),
      noHeaderServices,
    );
    const { sources } = parsed;
    const { declared, errors, discovery, target } = Declare.sources(parsed);

    expect(errors).toEqual([]);
    expect(
      declared.map((d) => d.fileSymbols.symbols.map((s) => s.name)),
    ).toEqual([["counter"]]);
    expect(declared[0].syntax).toBe(sources[0].syntax);
    expect(declared[0].file).toBe(sources[0].file);
    expect(discovery).toBe(parsed.discovery);
    expect(target).toBe(parsed.target);
  });
});

describe("Declare.sources headers (#1991: 1.3 builds the run's table)", () => {
  const C = (text: string): IHeaderSource => ({
    text,
    language: EHeaderLanguage.C,
  });

  it("declares a C header with the C parser and records it for the cache", async () => {
    const { symbolTable, headers } = await declareWithHeaders([
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

  it("gives a typedef of a struct typedef that struct's tag, whichever header is declared first (#1755)", async () => {
    const { symbolTable } = await declareWithHeaders([
      [
        "/p/stdio.h",
        C(
          "typedef __FILE FILE;\ntypedef FILE *FILE_PTR;\ntypedef FILE FILES[2];",
        ),
      ],
      ["/p/sys.h", C("typedef struct __sFILE __FILE;\ntypedef FILE MYFILE;")],
    ]);

    expect(symbolTable.getStructTagForTypedef("FILE")).toBe("__sFILE");
    expect(symbolTable.getStructTagForTypedef("MYFILE")).toBe("__sFILE");
    expect(symbolTable.getStructTagForTypedef("FILE_PTR")).toBeUndefined();
    expect(symbolTable.getStructTagForTypedef("FILES")).toBeUndefined();
  });

  it("declares a C++ header with the C++ parser", async () => {
    const { symbolTable } = await declareWithHeaders([
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

  it("declares nothing from an assembler header", async () => {
    const { symbolTable } = await declareWithHeaders([
      [
        "/p/a.S",
        { text: ".macro loop\n.endm", language: EHeaderLanguage.Assembler },
      ],
    ]);

    expect(symbolTable.getSymbolsByFile("/p/a.S")).toEqual([]);
  });

  it("restores a header 1.1 read from the cache instead of parsing it", async () => {
    const first = await declareWithHeaders([
      ["/p/a.h", C("int add(int a, int b);")],
    ]);
    const record = first.headers.declared[0].record;

    const { symbolTable, headers } = await declareWithHeaders(
      [["/p/a.h", C("this text is not read")]],
      { cachedHeaders: new Map([["/p/a.h", { kind: "cached", record }]]) },
    );

    expect(symbolTable.getCSymbolsByFile("/p/a.h").map((s) => s.name)).toEqual([
      "add",
    ]);
    expect(headers.processed).toBe(1);
    expect(headers.declared).toEqual([]);
  });

  it("warns on a header whose cache read threw, and declares the rest (#1319)", async () => {
    const { symbolTable, headers } = await declareWithHeaders(
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

  it("snapshots each record when its header is declared, not at the end", async () => {
    const { headers } = await declareWithHeaders([
      ["/p/a.h", C("typedef struct a_s a_t;")],
      ["/p/b.h", C("typedef struct b_s b_t;")],
    ]);

    const [a, b] = headers.declared.map((h) => h.record.structState);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("recovers #985's slices into the table and names their macros", async () => {
    const { symbolTable } = await declareWithHeaders([], {
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
