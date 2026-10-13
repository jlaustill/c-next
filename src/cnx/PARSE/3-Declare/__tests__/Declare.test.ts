/** 1.3 `Declare`: each file 1.2 parsed, declared, its syntax carried on (#1991) */
import { describe, expect, it } from "vitest";

import Declare from "../Declare";
import SymbolRegistry from "../SymbolRegistry";
import Discover from "../../1-Discover/Discover";
import Parse from "../../2-Parse/Parse";
import testSourceGraph from "../../1-Discover/__testUtils__/testSourceGraph";

describe("Declare.sources", () => {
  it("declares each parsed file and carries 1.2's syntax forward for 1.4 and 2.1", () => {
    const parsed = Parse.sources(
      testSourceGraph([Discover.inMemoryFile("u32 counter <- 0;", "/p/a.cnx")]),
    );
    const { sources } = parsed;
    const { declared, errors, discovery, targetCatalog } = Declare.sources(
      parsed,
      new SymbolRegistry(),
    );

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
