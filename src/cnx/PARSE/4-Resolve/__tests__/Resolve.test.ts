/** 1.4 `Resolve`: the program, with 1.3's files carried on to 2.1 (#1991) */
import { describe, expect, it } from "vitest";

import Resolve from "../Resolve";
import Discover from "../../1-Discover/Discover";
import Parse from "../../2-Parse/Parse";
import Declare from "../../3-Declare/Declare";
import SymbolRegistry from "../../3-Declare/SymbolRegistry";
import testSourceGraph from "../../1-Discover/__testUtils__/testSourceGraph";

const NO_HEADERS = {
  c: [],
  cpp: [],
  opaqueTypedefs: new Set<string>(),
  typedefToTag: new Map<string, string>(),
  structTagsWithBodies: new Set<string>(),
};

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
    const resolved = Resolve.program(declared, {
      target: {},
      foreign: NO_HEADERS,
    });

    expect(resolved.sources).toBe(declared.declared);
    expect(resolved.discovery).toBe(declared.discovery);
    expect(resolved.program.symbolTable().getSymbol("counter")?.name).toBe(
      "counter",
    );
  });

  it("types each file's header macros from 1.1's dump (#1688)", () => {
    const graph = {
      ...testSourceGraph([Discover.inMemoryFile("u32 a <- 0;", "/p/a.cnx")]),
      headerMacroDumps: new Map([
        ["/p/a.cnx", { dump: "#define SCALE_F 2.5f", complete: false }],
      ]),
    };
    const resolved = Resolve.program(
      Declare.sources(Parse.sources(graph), new SymbolRegistry()),
      { target: {}, foreign: NO_HEADERS },
    );

    expect(resolved.program.headerMacro("/p/a.cnx", "SCALE_F")).not.toBeNull();
    expect(resolved.program.headerMacrosUnread("/p/a.cnx")).toBe(true);
    expect(resolved.program.headerMacrosUnread("/p/b.cnx")).toBe(false);
  });
});
