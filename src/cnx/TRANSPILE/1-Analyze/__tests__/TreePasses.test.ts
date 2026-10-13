/**
 * `TreePasses`' single-file entries: text from 1.1, parsed by 1.2, declared by
 * 1.3, with the tree a local of the call (#1932).
 */
import { describe, expect, it } from "vitest";

import TreePasses from "../TreePasses";
import Discover from "../../../PARSE/1-Discover/Discover";
import EHeaderLanguage from "../../../PARSE/1-Discover/types/EHeaderLanguage";
import SymbolRegistry from "../../../PARSE/3-Declare/SymbolRegistry";

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
