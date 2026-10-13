/** 2.1 `Analyze`: every file 1.4 carried on that produces output (#1991) */
import { describe, expect, it } from "vitest";

import Analyze from "../Analyze";
import Discover from "../../../PARSE/1-Discover/Discover";
import Parse from "../../../PARSE/2-Parse/Parse";
import Declare from "../../../PARSE/3-Declare/Declare";
import SymbolRegistry from "../../../PARSE/3-Declare/SymbolRegistry";
import Resolve from "../../../PARSE/4-Resolve/Resolve";
import testSourceGraph from "../../../PARSE/1-Discover/__testUtils__/testSourceGraph";

function resolved() {
  const parsed = Parse.sources(
    testSourceGraph([
      Discover.inMemoryFile("void main() { }", "/p/app.cnx"),
      {
        ...Discover.inMemoryFile("u32 shared <- 0;", "/p/lib.cnx"),
        symbolOnly: true,
      },
    ]),
  );
  return Resolve.program(Declare.sources(parsed, new SymbolRegistry()), {
    target: {},
  });
}

describe("Analyze.run", () => {
  it("hands on the syntax of each file that produces output, and not of a symbol-only one", () => {
    const input = resolved();
    const { files, program, discovery } = Analyze.run(
      input.program,
      input.sources,
      input.discovery,
      null,
    );

    expect([...files.keys()]).toEqual(["/p/app.cnx"]);
    expect(files.get("/p/app.cnx")?.program).toBe(
      input.sources[0].syntax.program,
    );
    expect(program).toBe(input.program);
    expect(discovery).toBe(input.discovery);
  });

  it("analyzes nothing when parse-only mode hands it no inputs", () => {
    const input = resolved();
    const { diagnostics } = Analyze.run(
      input.program,
      input.sources,
      input.discovery,
      null,
    );

    expect(diagnostics.hasErrors()).toBe(false);
  });
});
