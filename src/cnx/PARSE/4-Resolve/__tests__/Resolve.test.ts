/** 1.4 `Resolve`: the program, with 1.3's files carried on to 2.1 (#1991) */
import { describe, expect, it } from "vitest";

import Resolve from "../Resolve";
import Discover from "../../1-Discover/Discover";
import Parse from "../../2-Parse/Parse";
import Declare from "../../3-Declare/Declare";
import SymbolRegistry from "../../3-Declare/SymbolRegistry";

describe("Resolve.program", () => {
  it("resolves the declared files and carries them on", () => {
    const { sources } = Parse.sources([
      Discover.inMemoryFile("u32 counter <- 0;", "/p/a.cnx"),
    ]);
    const { declared } = Declare.sources(sources, new SymbolRegistry());
    const resolved = Resolve.program(declared, {
      cppMode: false,
      target: { catalog: new Map() },
    });

    expect(resolved.sources).toBe(declared);
    expect(resolved.program.symbolTable().getSymbol("counter")?.name).toBe(
      "counter",
    );
  });
});
