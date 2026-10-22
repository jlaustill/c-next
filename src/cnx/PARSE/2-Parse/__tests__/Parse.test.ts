/** 1.2 `Parse`: the run's cnx files from 1.1, as plain syntax (#1991) */
import { describe, expect, it } from "vitest";

import Parse from "../Parse";
import noHeaderServices from "../__testUtils__/noHeaderServices";
import Discover from "../../1-Discover/Discover";
import testSourceGraph from "../../1-Discover/__testUtils__/testSourceGraph";

describe("Parse.sources", () => {
  it("returns each file that parsed, with 1.1's file carried forward", async () => {
    const app = Discover.inMemoryFile(
      "u32 twice(u32 v) { return v * 2; }",
      "/p/app.cnx",
    );
    const graph = testSourceGraph([app]);
    const { sources, errors, discovery } = await Parse.sources(
      graph,
      noHeaderServices,
    );

    expect(errors).toEqual([]);
    expect(discovery.includes).toBe(graph.includes.c);
    expect(discovery.outputs).toBe(graph.outputs.c);
    expect(discovery.anchor).toBe(graph.anchor);
    expect(sources).toHaveLength(1);
    expect(sources[0].file).toBe(app);
    expect(sources[0].syntax.program.declarations).toHaveLength(1);
  });

  it("keeps a file that failed to parse out, and stamps its errors with its path", async () => {
    const bad = Discover.inMemoryFile("u32 f( {", "/p/bad.cnx");
    const { sources, errors } = await Parse.sources(
      testSourceGraph([
        bad,
        Discover.inMemoryFile("void g() { }", "/p/ok.cnx"),
      ]),
      noHeaderServices,
    );

    expect(sources.map((s) => s.file.path)).toEqual(["/p/ok.cnx"]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((e) => e.sourcePath === bad.path)).toBe(true);
  });
});
