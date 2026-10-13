/** 1.2 `Parse`: the run's C-Next files from 1.1, as plain syntax (#1991) */
import { describe, expect, it } from "vitest";

import Parse from "../Parse";
import Discover from "../../1-Discover/Discover";

describe("Parse.sources", () => {
  it("returns each file that parsed, with 1.1's file carried forward", () => {
    const app = Discover.inMemoryFile(
      "u32 twice(u32 v) { return v * 2; }",
      "/p/app.cnx",
    );
    const { sources, errors } = Parse.sources([app]);

    expect(errors).toEqual([]);
    expect(sources).toHaveLength(1);
    expect(sources[0].file).toBe(app);
    expect(sources[0].syntax.program.declarations).toHaveLength(1);
  });

  it("keeps a file that failed to parse out, and stamps its errors with its path", () => {
    const bad = Discover.inMemoryFile("u32 f( {", "/p/bad.cnx");
    const { sources, errors } = Parse.sources([
      bad,
      Discover.inMemoryFile("void g() { }", "/p/ok.cnx"),
    ]);

    expect(sources.map((s) => s.file.path)).toEqual(["/p/ok.cnx"]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((e) => e.sourcePath === bad.path)).toBe(true);
  });
});
