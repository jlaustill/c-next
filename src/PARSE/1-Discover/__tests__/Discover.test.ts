import { describe, it, expect } from "vitest";

import Discover from "../Discover";
import RunAnchor from "../RunAnchor";
import EFileType from "../types/EFileType";
import MockFileSystem from "../../../transpiler/__tests__/MockFileSystem";
import type ISourceGraph from "../types/ISourceGraph";

/**
 * #1444 box 1: 1.1 Discover emits a `SourceGraph` carrying the file set, each
 * file's kind, the include edges, topological order and resolved absolute
 * paths, frozen at the end of 1.1.
 */
describe("Discover", () => {
  const settings = {
    input: "/proj/src/app.cnx",
    includeDirs: [],
    defines: { BOARD: "uno" },
    outDir: "",
    headerOutDir: "",
    debugMode: false,
  };

  /** `app.cnx` includes `lib.cnx` and a C header; the header includes nothing. */
  function project(): MockFileSystem {
    return new MockFileSystem()
      .addFile(
        "/proj/src/app.cnx",
        '#include "lib.cnx"\n#include "board.h"\n\nvoid main() { }\n',
      )
      .addFile("/proj/src/lib.cnx", "u32 twice(u32 v) { return v * 2; }\n")
      .addFile("/proj/src/board.h", "#define LED 13\n");
  }

  function discover(fs: MockFileSystem): {
    graph: ISourceGraph;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const anchor = RunAnchor.at(settings.input, null, settings, fs);
    const graph = Discover.run(
      { kind: "files" },
      anchor,
      settings,
      ".h",
      fs,
      warnings,
    ).graph;
    return { graph, warnings };
  }

  it("orders the files so each follows the files it includes", () => {
    const { graph } = discover(project());

    expect(graph.cnextFiles.map((file) => file.path)).toEqual([
      "/proj/src/lib.cnx",
      "/proj/src/app.cnx",
    ]);
  });

  it("carries each file's kind, its edges and the text it was read from", () => {
    const { graph } = discover(project());
    const byPath = new Map(graph.cnextFiles.map((file) => [file.path, file]));
    const app = byPath.get("/proj/src/app.cnx");
    const lib = byPath.get("/proj/src/lib.cnx");
    if (app === undefined || lib === undefined) {
      throw new Error("both files are discovered");
    }

    expect(app.discoveredFile.type).toBe(EFileType.CNext);
    expect(app.cnextIncludes.map((include) => include.path)).toEqual([
      "/proj/src/lib.cnx",
    ]);
    expect(lib.cnextIncludes).toEqual([]);
    expect(app.source).toContain('#include "lib.cnx"');
    // The header is the file's edge to C, which is what E0426/E0427 decline on
    expect(app.reachesForeignHeader).toBe(true);
    expect(lib.reachesForeignHeader).toBe(false);
    expect(graph.headerFiles.map((header) => header.path)).toEqual([
      "/proj/src/board.h",
    ]);
  });

  it("records each file's include facts, in the order it visited them", () => {
    const { graph } = discover(project());

    // Visit order, not `cnextFiles`' dependency order (see `ISourceGraph`)
    expect([...graph.includes.keys()]).toEqual([
      "/proj/src/app.cnx",
      "/proj/src/lib.cnx",
    ]);
    const app = graph.includes.get("/proj/src/app.cnx");
    expect(app?.resolutions.get('#include "lib.cnx"')).toBe(
      "/proj/src/lib.cnx",
    );
    expect(app?.resolutions.get('#include "board.h"')).toBe(
      "/proj/src/board.h",
    );
    expect(app?.quotedIncludeDirectory).toBe("/proj/src");
    expect(app?.cnxIncludeRewrites.get("lib.cnx")).toBe("lib.h");
  });

  it("carries the anchor's facts", () => {
    const { graph } = discover(project());

    expect(graph.anchor).toEqual({
      directory: "/proj/src",
      projectRoot: undefined,
      defines: { BOARD: "uno" },
      platformio: null,
    });
  });

  it("is frozen when discovery ends", () => {
    const { graph } = discover(project());

    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.cnextFiles)).toBe(true);
    expect(graph.cnextFiles.every((file) => Object.isFrozen(file))).toBe(true);
    expect(Object.isFrozen(graph.headerFiles)).toBe(true);
    expect(Object.isFrozen(graph.includeSearchPaths)).toBe(true);
    expect(
      [...graph.includes.values()].every((facts) => Object.isFrozen(facts)),
    ).toBe(true);
    expect(Object.isFrozen(graph.anchor)).toBe(true);
  });

  it("has no files when the entry is not C-Next", () => {
    const fs = new MockFileSystem().addFile("/proj/src/readme.txt", "hello");
    const warnings: string[] = [];
    const notCNext = { ...settings, input: "/proj/src/readme.txt" };

    const graph = Discover.run(
      { kind: "files" },
      RunAnchor.at(notCNext.input, null, notCNext, fs),
      notCNext,
      ".h",
      fs,
      warnings,
    ).graph;

    expect(graph.cnextFiles).toEqual([]);
    expect(graph.includes.size).toBe(0);
  });
});
