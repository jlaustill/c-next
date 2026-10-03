import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import ITranspilerConfig from "../../types/ITranspilerConfig";
import NodeFileSystem from "../../PARSE/1-Discover/NodeFileSystem";
import Discover from "../../PARSE/1-Discover/Discover";
import type ISourceGraph from "../../PARSE/1-Discover/types/ISourceGraph";

/**
 * #1452: 1.1 Discover's include facts must not outlive the run that found them.
 *
 * `TranspilerState.reset()` cleared eight maps, and `_initializeRun` called it.
 * Box 1 deleted `TranspilerState` and re-wrote that teardown as five inline
 * `.clear()` calls, and two of discovery's maps were not among them, so both
 * grew one entry per file ever discovered for the life of the instance.
 *
 * #1444: the maps are gone. Each run's discovery is its own `Discover`, and
 * its facts are the run's `SourceGraph`, so there is no teardown to forget.
 * What `Transpiler` still holds is the graph itself, for the length of the
 * run. These assert both halves: the graph a run reads answers for that run's
 * files alone, and the instance lets go of it when the run ends.
 *
 * ## Why this is asserted directly rather than through generated output
 *
 * `Transpiler` is not per-process -- `ServeCommand` holds one in a static field
 * and reuses it for every request -- so post-run residency is the cost, and it
 * is a different number from anything a fixture or a peak-RSS benchmark can
 * see. The same argument `RetainedParseCacheRelease.test.ts` makes for the parse
 * cache. The graph holds every source text of the run.
 */
describe("#1452: discovery's include facts are released at end of run", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnext-discovery-release-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  /** The graphs `Discover` emitted, in run order. */
  function recordGraphs(): ISourceGraph[] {
    const graphs: ISourceGraph[] = [];
    const run = Discover.run.bind(Discover);
    vi.spyOn(Discover, "run").mockImplementation((...args) => {
      const discovered = run(...args);
      graphs.push(discovered.graph);
      return discovered;
    });
    return graphs;
  }

  /**
   * File names alone, because the temp directory differs per test. KEYS
   * rather than sizes: only the names say whose files they are.
   */
  function filesWithIncludeFacts(graph: ISourceGraph): string[] {
    return [...graph.includes.keys()]
      .map((path) => path.split("/").pop() ?? path)
      .sort();
  }

  /** The graph the instance holds, read without widening its visibility. */
  function heldGraph(transpiler: Transpiler): ISourceGraph | null {
    return (transpiler as unknown as { sourceGraph: ISourceGraph | null })
      .sourceGraph;
  }

  /** An entry that includes a sibling `.cnx`, so both files get facts. */
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
      target: "host",
    };
    return new Transpiler(config, NodeFileSystem.instance);
  }

  it("answers for exactly the files the current run discovered", async () => {
    // Run 1 over a two-file project, then run 2 over a DIFFERENT entry that
    // includes nothing. Run 2's own discovery reaches `solo.cnx` alone, so
    // `app.cnx` or `lib.cnx` appearing in its graph would be run 1's, retained.
    const graphs = recordGraphs();
    const transpiler = createTranspiler(writeProject());

    const first = await transpiler.transpile({ kind: "files" });

    // NEGATIVE CONTROL for the assertion below. "Run 1's files are absent"
    // would also hold if discovery never recorded anything at all -- so prove
    // it DID. A program that resolves `lib.cnx` to a generated header is only
    // reachable through these facts.
    expect(first.success).toBe(true);
    expect(graphs).toHaveLength(1);
    expect(filesWithIncludeFacts(graphs[0])).toEqual(["app.cnx", "lib.cnx"]);

    const standalone = join(tempDir, "solo.cnx");
    writeFileSync(standalone, `u32 main() {\n    return 0;\n}\n`);

    // Same instance, new input: the ServeCommand shape is one transpiler
    // answering for whatever file the editor just saved.
    (transpiler as unknown as { config: ITranspilerConfig }).config.input =
      standalone;

    const second = await transpiler.transpile({ kind: "files" });
    expect(second.success).toBe(true);
    expect(graphs).toHaveLength(2);
    expect(filesWithIncludeFacts(graphs[1])).toEqual(["solo.cnx"]);
  });

  it("lets go of the run's graph when the run ends", async () => {
    const graphs = recordGraphs();
    const transpiler = createTranspiler(writeProject());

    expect((await transpiler.transpile({ kind: "files" })).success).toBe(true);

    // The run did hold a graph, so its absence below is a release, not a
    // graph that was never there.
    expect(graphs).toHaveLength(1);
    expect(heldGraph(transpiler)).toBeNull();
  });

  it("lets go of it when the run fails, too", async () => {
    const graphs = recordGraphs();
    const entry = join(tempDir, "broken.cnx");
    writeFileSync(entry, `void main() {\n    u32 x <- ;\n}\n`);
    const transpiler = createTranspiler(entry);

    expect((await transpiler.transpile({ kind: "files" })).success).toBe(false);

    expect(graphs).toHaveLength(1);
    expect(heldGraph(transpiler)).toBeNull();
  });
});
