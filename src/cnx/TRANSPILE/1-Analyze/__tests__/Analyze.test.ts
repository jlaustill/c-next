/** 2.1 `Analyze`: every file 1.3 declared that produces output (#1991) */
import { describe, expect, it } from "vitest";

import Analyze from "../Analyze";
import Discover from "../../../PARSE/1-Discover/Discover";
import Parse from "../../../PARSE/2-Parse/Parse";
import Declare from "../../../PARSE/3-Declare/Declare";
import SymbolRegistry from "../../../PARSE/3-Declare/SymbolRegistry";

function declared() {
  const { sources } = Parse.sources([
    Discover.inMemoryFile("void main() { }", "/p/app.cnx"),
    {
      ...Discover.inMemoryFile("u32 shared <- 0;", "/p/lib.cnx"),
      symbolOnly: true,
    },
  ]);
  return Declare.sources(sources, new SymbolRegistry()).declared;
}

describe("Analyze.run", () => {
  it("hands on the syntax of each file that produces output, and not of a symbol-only one", () => {
    const entries = declared();
    const { files } = Analyze.run(entries, null);

    expect([...files.keys()]).toEqual(["/p/app.cnx"]);
    expect(files.get("/p/app.cnx")?.program).toBe(entries[0].syntax.program);
  });

  it("analyzes nothing when parse-only mode hands it no inputs", () => {
    const { diagnostics } = Analyze.run(declared(), null);

    expect(diagnostics.hasErrors()).toBe(false);
  });
});
