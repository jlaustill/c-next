import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import ITranspilerConfig from "../types/ITranspilerConfig";

/**
 * #1452: 1.1 Discover's include facts must not outlive the run that found them.
 *
 * `TranspilerState.reset()` cleared eight maps, and `_initializeRun` called it.
 * Box 1 deleted `TranspilerState` and re-wrote that teardown as five inline
 * `.clear()` calls -- `discoveredCnxIncludeRewrites` and
 * `discoveredIncludeSearchPaths` were not among them, and nothing else clears
 * either, so both grow one entry per file ever discovered for the life of the
 * instance.
 *
 * That is the drift `_initializeRun`'s own comment cites three lines above the
 * gap, as the reason `SymbolTable.clear()` was deleted rather than extended:
 * *"`clear()` listed eleven of twelve indexes ... adding the twelfth line would
 * have fixed this instance and left the shape."* The shape recurred in the same
 * method that recorded it.
 *
 * ## Why this is asserted directly rather than through generated output
 *
 * `Transpiler` is not per-process -- `ServeCommand` holds one in a static field
 * and reuses it for every request -- so post-run residency is the cost, and it
 * is a different number from anything a fixture or a peak-RSS benchmark can
 * see. The same argument `RetainedParseCacheRelease.test.ts` makes for the parse
 * cache, and these two maps are the remaining fields with its shape.
 *
 * Attempting it through output instead is what showed the direct assertion is
 * the honest one: a stale rewrite is only consulted for a spelling that is in
 * the tree, and if the spelling is there, this run either resolves it or raises
 * E0506 -- so the retained entry is unreachable by construction today. The
 * property is that nothing is retained, not that something currently misreads
 * it, and `Program.build` is handed these maps by reference (not a copy), so
 * "unreachable today" is one call site away from not being true.
 */
describe("#1452: discovery's include facts are released at end of run", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnext-discovery-release-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * Which files the two maps currently answer for, without widening their
   * visibility for production.
   *
   * KEYS rather than sizes: a run records one entry per file it discovered, so
   * the size after run 2 is "run 2's files" plus whatever run 1 left, and only
   * the names say which. File names alone, because the temp directory differs
   * per test.
   */
  function discoveryFactFiles(transpiler: Transpiler): {
    rewrites: string[];
    searchPaths: string[];
  } {
    const fields = transpiler as unknown as {
      discoveredCnxIncludeRewrites: Map<string, unknown>;
      discoveredIncludeSearchPaths: Map<string, unknown>;
    };
    const fileNames = (map: Map<string, unknown>): string[] =>
      [...map.keys()].map((path) => path.split("/").pop() ?? path).sort();
    return {
      rewrites: fileNames(fields.discoveredCnxIncludeRewrites),
      searchPaths: fileNames(fields.discoveredIncludeSearchPaths),
    };
  }

  /** An entry that includes a sibling `.cnx`, so both maps get an entry. */
  function writeProject(): string {
    writeFileSync(
      join(tempDir, "lib.cnx"),
      `scope Lib {\n    public u32 double(u32 v) { return v * 2; }\n}\n`,
    );
    const entry = join(tempDir, "app.cnx");
    writeFileSync(
      entry,
      `#include "lib.cnx"\n\nu32 total <- 0;\n\nvoid main() {\n    total <- Lib.double(21);\n}\n`,
    );
    return entry;
  }

  function createTranspiler(input: string): Transpiler {
    const config: ITranspilerConfig = {
      input,
      includeDirs: [tempDir],
      outDir: tempDir,
      headerOutDir: tempDir,
    };
    return new Transpiler(config);
  }

  it("answers for exactly the files the current run discovered", async () => {
    // Run 1 over a two-file project, then run 2 over a DIFFERENT entry that
    // includes nothing. Run 2's own discovery reaches `solo.cnx` alone, so
    // `app.cnx` and `lib.cnx` appearing afterwards is run 1's, retained.
    const transpiler = createTranspiler(writeProject());

    const first = await transpiler.transpile({ kind: "files" });

    // NEGATIVE CONTROL for the assertion below. "Run 1's files are absent"
    // would also hold if discovery never recorded anything at all -- so prove
    // it DID. A program that resolves `lib.cnx` to a generated header is only
    // reachable through both maps being written.
    expect(first.success).toBe(true);
    expect(discoveryFactFiles(transpiler)).toEqual({
      rewrites: ["app.cnx", "lib.cnx"],
      searchPaths: ["app.cnx", "lib.cnx"],
    });

    const standalone = join(tempDir, "solo.cnx");
    writeFileSync(standalone, `u32 main() {\n    return 0;\n}\n`);

    // Same instance, new input: the ServeCommand shape is one transpiler
    // answering for whatever file the editor just saved.
    (transpiler as unknown as { config: ITranspilerConfig }).config.input =
      standalone;

    const second = await transpiler.transpile({ kind: "files" });
    expect(second.success).toBe(true);
    expect(discoveryFactFiles(transpiler)).toEqual({
      rewrites: ["solo.cnx"],
      searchPaths: ["solo.cnx"],
    });
  });

  it("records the same thing on a fresh instance, so the case above is about retention", async () => {
    const standalone = join(tempDir, "solo.cnx");
    writeFileSync(standalone, `u32 main() {\n    return 0;\n}\n`);

    const fresh = createTranspiler(standalone);
    expect((await fresh.transpile({ kind: "files" })).success).toBe(true);
    expect(discoveryFactFiles(fresh)).toEqual({
      rewrites: ["solo.cnx"],
      searchPaths: ["solo.cnx"],
    });
  });
});
