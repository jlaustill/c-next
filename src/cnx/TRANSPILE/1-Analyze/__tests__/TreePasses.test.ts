/**
 * `TreePasses`' single-file entries: text from 1.1, parsed by 1.2, declared by
 * 1.3, with the tree a local of the call (#1932).
 */
import { describe, expect, it } from "vitest";

import TreePasses from "../TreePasses";
import Discover from "../../../PARSE/1-Discover/Discover";
import EHeaderLanguage from "../../../PARSE/1-Discover/types/EHeaderLanguage";
import SymbolRegistry from "../../../PARSE/3-Declare/SymbolRegistry";
import SymbolTable from "../../../PARSE/3-Declare/SymbolTable";

describe("TreePasses.declareFile", () => {
  it("declares a file's symbols", () => {
    const result = TreePasses.declareFile(
      Discover.inMemoryFile("u32 counter <- 0;", "a.cnx"),
      new SymbolRegistry(),
    );

    expect(result.parseErrors).toEqual([]);
    expect(result.symbols.symbols.map((s) => s.name)).toEqual(["counter"]);
  });

  it("still declares from a file with a parse error, and reports the error", () => {
    const result = TreePasses.declareFile(
      Discover.inMemoryFile(
        "u32 counter <- 0;\nvoid f() { u32 x <- ; }",
        "a.cnx",
      ),
      new SymbolRegistry(),
    );

    expect(result.parseErrors.length).toBeGreaterThan(0);
    expect(result.symbols.symbols.some((s) => s.name === "counter")).toBe(true);
  });
});

describe("TreePasses.declareHeader", () => {
  it("declares a C header with the C parser", () => {
    const table = new SymbolTable();
    TreePasses.declareHeader(
      "a.h",
      { text: "int add(int a, int b);", language: EHeaderLanguage.C },
      table,
    );

    expect(table.getCSymbolsByFile("a.h").map((s) => s.name)).toContain("add");
    expect(table.getCppSymbolsByFile("a.h")).toEqual([]);
  });

  it("declares a C++ header with the C++ parser", () => {
    const table = new SymbolTable();
    TreePasses.declareHeader(
      "a.hpp",
      { text: "namespace hw { int read(); }", language: EHeaderLanguage.Cpp },
      table,
    );

    expect(table.getCppSymbolsByFile("a.hpp").length).toBeGreaterThan(0);
    expect(table.getCSymbolsByFile("a.hpp")).toEqual([]);
  });

  it("declares nothing from an assembler header", () => {
    const table = new SymbolTable();
    TreePasses.declareHeader(
      "a.S",
      { text: ".macro loop\n.endm", language: EHeaderLanguage.Assembler },
      table,
    );

    expect(table.getAllSymbols()).toEqual([]);
  });
});

describe("TreePasses.recoverDeclarations", () => {
  it("declares each slice into the run's table and its clean C parse into the returned one", () => {
    const table = new SymbolTable();
    const clean = TreePasses.recoverDeclarations(
      new Map([
        [
          "sys.h",
          {
            text: "int sys_tick(void);",
            language: EHeaderLanguage.C,
            directive: null,
          },
        ],
      ]),
      table,
    );

    expect(table.getCSymbolsByFile("sys.h").map((s) => s.name)).toContain(
      "sys_tick",
    );
    expect(clean).not.toBe(table);
    expect(clean.getCSymbolsByFile("sys.h")).toEqual([]);
  });
});

describe("TreePasses.resolveCHeader", () => {
  it("resolves a C header from 1.1's in-memory entry", () => {
    const result = TreePasses.resolveCHeader(
      Discover.inMemoryCHeader("int add(int a, int b);"),
      "a.h",
    );

    expect(result?.symbols.map((s) => s.name)).toContain("add");
  });

  it("refuses a header 1.1 did not judge C", () => {
    expect(() =>
      TreePasses.resolveCHeader(
        { text: "int f();", language: EHeaderLanguage.Cpp },
        "a.hpp",
      ),
    ).toThrow("resolveCHeader reads a C header, not cpp");
  });
});
