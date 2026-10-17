/** 2.1 `Analyze`: every file 1.4 carried on that produces output (#1991) */
import { describe, expect, it } from "vitest";

import Analyze from "../Analyze";
import Discover from "../../../PARSE/1-Discover/Discover";
import Parse from "../../../PARSE/2-Parse/Parse";
import noHeaderServices from "../../../PARSE/2-Parse/__testUtils__/noHeaderServices";
import Declare from "../../../PARSE/3-Declare/Declare";
import Resolve from "../../../PARSE/4-Resolve/Resolve";
import testSourceGraph from "../../../PARSE/1-Discover/__testUtils__/testSourceGraph";

// E0702: a function call in a condition, a 2.1 diagnostic
const CALL_IN_CONDITION = `
u8 limit() {
    return 3;
}

void main() {
    u8 i <- 0;
    if (i < limit()) {
        i <- 1;
    }
}
`;

async function resolved(parseOnly = true, app = "void main() { }") {
  // Parse-only by default: most cases are about what 2.1 hands on, not what
  // it finds
  const graph = testSourceGraph([
    Discover.inMemoryFile(app, "/p/app.cnx"),
    {
      ...Discover.inMemoryFile("u32 shared <- 0;", "/p/lib.cnx"),
      symbolOnly: true,
    },
  ]);
  return Resolve.program(
    Declare.sources(
      await Parse.sources(
        { ...graph, run: { ...graph.run, parseOnly } },
        noHeaderServices,
      ),
    ),
  );
}

function codesOf(
  input: Awaited<ReturnType<typeof resolved>>,
): (string | undefined)[] {
  return Analyze.run(input.program, input.sources, input.discovery)
    .diagnostics.forFile("/p/app.cnx")
    .map((e) => /E\d{4}/.exec(e.message)?.[0]);
}

describe("Analyze.run", () => {
  it("hands on the syntax of each file that produces output, and not of a symbol-only one", async () => {
    const input = await resolved();
    const { files, program, discovery } = Analyze.run(
      input.program,
      input.sources,
      input.discovery,
    );

    expect([...files.keys()]).toEqual(["/p/app.cnx"]);
    expect(files.get("/p/app.cnx")?.program).toBe(
      input.sources[0].syntax.program,
    );
    expect(program).toBe(input.program);
    expect(discovery).toBe(input.discovery);
  });

  it("finds a file's 2.1 diagnostic when the run is not parse-only", async () => {
    expect(codesOf(await resolved(false, CALL_IN_CONDITION))).toEqual([
      "E0702",
    ]);
  });

  it("analyzes nothing in a parse-only run", async () => {
    expect(codesOf(await resolved(true, CALL_IN_CONDITION))).toEqual([]);
  });
});
