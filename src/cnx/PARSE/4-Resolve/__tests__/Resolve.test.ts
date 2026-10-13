/** 1.4 `Resolve`: the program, with 1.3's files carried on to 2.1 (#1991) */
import { describe, expect, it } from "vitest";

import Resolve from "../Resolve";
import Discover from "../../1-Discover/Discover";
import Parse from "../../2-Parse/Parse";
import Declare from "../../3-Declare/Declare";
import SymbolRegistry from "../../3-Declare/SymbolRegistry";
import testSourceGraph from "../../1-Discover/__testUtils__/testSourceGraph";

describe("Resolve.program", () => {
  it("resolves the declared files and carries them on", () => {
    const declared = Declare.sources(
      Parse.sources(
        testSourceGraph([
          Discover.inMemoryFile("u32 counter <- 0;", "/p/a.cnx"),
        ]),
      ),
      new SymbolRegistry(),
    );
    const resolved = Resolve.program(declared, { target: {} });

    expect(resolved.sources).toBe(declared.declared);
    expect(resolved.discovery).toBe(declared.discovery);
    expect(resolved.program.symbolTable().getSymbol("counter")?.name).toBe(
      "counter",
    );
  });
});
