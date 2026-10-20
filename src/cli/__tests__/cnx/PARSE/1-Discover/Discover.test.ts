import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import Discover from "../../../../../cnx/PARSE/1-Discover/Discover";
import Preprocessor from "../../../../../cnx/PARSE/2-Parse/preprocessor/Preprocessor";
import RunAnchor from "../../../../../cnx/PARSE/1-Discover/RunAnchor";
import EFileType from "../../../../../cnx/PARSE/1-Discover/types/EFileType";
import MockFileSystem from "../../../MockFileSystem";
import ConfigFileNames from "../../../../../cnx/PARSE/1-Discover/ConfigFileNames";
import type ISourceGraph from "../../../../../cnx/PARSE/1-Discover/types/ISourceGraph";

/**
 * #1444 box 1: 1.1 Discover emits a `SourceGraph` carrying the file set, each
 * file's kind, the include edges, topological order and resolved absolute
 * paths, frozen at the end of 1.1.
 */
describe("Discover", () => {
  let fs: MockFileSystem;

  // #1844: a run with headers needs a preprocessor. This one hands back the
  // header as written, which is what a C compile meets in these headers.
  beforeEach(() => {
    vi.spyOn(Preprocessor.prototype, "isAvailable").mockReturnValue(true);
    vi.spyOn(Preprocessor.prototype, "preprocess").mockImplementation(
      async (file: string) => ({
        content: fs.readFile(file),
        sourceMappings: [],
        success: true,
        originalFile: file,
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const noIncludeDirs: string[] = [];
  const settings = {
    input: "/proj/src/app.cnx",
    includeDirs: noIncludeDirs,
    defines: { BOARD: "uno" },
    outDir: "",
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

  async function discover(files: MockFileSystem): Promise<{
    graph: ISourceGraph;
    warnings: string[];
  }> {
    fs = files;
    const warnings: string[] = [];
    const anchor = RunAnchor.at(settings.input, null, settings, fs);
    const { graph } = Discover.run(
      { kind: "files" },
      anchor,
      settings,
      fs,
      warnings,
    );
    return { graph, warnings };
  }

  // #1991: 1.1 reads the target catalog, so no later stage reads the disk for it
  it("carries the target catalog's text and path", async () => {
    const { graph } = await discover(project());

    expect(graph.targetCatalog.path).toMatch(/targets[\\/]targets\.cnx$/);
    expect(graph.targetCatalog.text).toBe(
      fs.readFile(graph.targetCatalog.path),
    );
    expect(graph.targetCatalog.text.length).toBeGreaterThan(0);
  });

  // #1991: 1.1 names every output path, so no later stage asks PathResolver
  it("names each file's output paths, below its input directory", async () => {
    fs = new MockFileSystem()
      .addFile("/proj/app.cnx", '#include "src/lib.cnx"\n\nvoid main() { }\n')
      .addFile("/proj/src/lib.cnx", "u32 twice(u32 v) { return v * 2; }\n");
    const tree = { ...settings, input: "/proj/app.cnx", outDir: "/out" };
    const anchor = RunAnchor.at(tree.input, null, tree, fs);
    const { graph } = Discover.run({ kind: "files" }, anchor, tree, fs, []);

    expect(graph.outputs.c.get("/proj/src/lib.cnx")).toEqual({
      selfInclude: "lib.h",
      source: "/out/src/lib.c",
      header: "/out/src/lib.h",
    });
  });

  // #2272/#1473: a quoted include is spelled from where each generated file is
  // written, so a nested file's output does not depend on its entry
  it("spells a nested file's sibling include relative to its own output", async () => {
    fs = new MockFileSystem()
      .addFile("/proj/app.cnx", '#include "lib/a.cnx"\n\nvoid main() { }\n')
      .addFile("/proj/lib/a.cnx", '#include "b.cnx"\n\nu8 A <- 1;\n')
      .addFile("/proj/lib/b.cnx", "u8 B <- 2;\n");
    const split = {
      ...settings,
      input: "/proj/app.cnx",
      outDir: "/out/src",
      headerOutDir: "/out/include",
    };
    const anchor = RunAnchor.at(split.input, null, split, fs);
    const { graph } = Discover.run({ kind: "files" }, anchor, split, fs, []);

    const nested = graph.includes.c.get("/proj/lib/a.cnx");
    expect(nested?.headerIncludeDirectives.get("/proj/lib/b.cnx")).toBe(
      '#include "b.h"',
    );
    expect(nested?.userIncludes).toEqual(['#include "b.h"']);
    expect(nested?.includeRewrites.get("b.cnx")).toBe("../../include/lib/b.h");
    expect(nested?.generatedHeaderDirectory).toBe("/out/include/lib");
    expect(graph.outputs.c.get("/proj/lib/a.cnx")?.selfInclude).toBe(
      "../../include/lib/a.h",
    );
    expect(graph.includes.c.get("/proj/app.cnx")?.includeRewrites).toEqual(
      new Map([["lib/a.cnx", "../include/lib/a.h"]]),
    );
  });

  it("orders the files so each follows the files it includes", async () => {
    const { graph } = await discover(project());

    expect(graph.cnextFiles.map((file) => file.path)).toEqual([
      "/proj/src/lib.cnx",
      "/proj/src/app.cnx",
    ]);
  });

  it("carries each file's kind, its edges and the text it was read from", async () => {
    const { graph } = await discover(project());
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

  it("records each file's include facts, in the order it visited them", async () => {
    const { graph } = await discover(project());

    // Visit order, not `cnextFiles`' dependency order (see `ISourceGraph`)
    expect([...graph.includes.c.keys()]).toEqual([
      "/proj/src/app.cnx",
      "/proj/src/lib.cnx",
    ]);
    const app = graph.includes.c.get("/proj/src/app.cnx");
    expect(app?.resolutions.get('#include "lib.cnx"')).toBe(
      "/proj/src/lib.cnx",
    );
    expect(app?.resolutions.get('#include "board.h"')).toBe(
      "/proj/src/board.h",
    );
    expect(app?.quotedIncludeDirectory).toBe("/proj/src");
    expect(app?.includeRewrites.get("lib.cnx")).toBe("lib.h");
  });

  it("carries the anchor's facts", async () => {
    const { graph } = await discover(project());

    expect(graph.anchor).toEqual({
      directory: "/proj/src",
      projectRoot: undefined,
      defines: { BOARD: "uno" },
      platformio: null,
      configuredCompiler: null,
    });
  });

  it("is frozen when discovery ends", async () => {
    const { graph } = await discover(project());

    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.cnextFiles)).toBe(true);
    expect(graph.cnextFiles.every((file) => Object.isFrozen(file))).toBe(true);
    expect(Object.isFrozen(graph.headerFiles)).toBe(true);
    expect(Object.isFrozen(graph.includeSearchPaths)).toBe(true);
    expect(
      [...graph.includes.c.values()].every((facts) => Object.isFrozen(facts)),
    ).toBe(true);
    expect(Object.isFrozen(graph.anchor)).toBe(true);
  });

  it("is frozen all the way down, not just the records (#1444 review)", async () => {
    const { graph } = await discover(project());
    const app = graph.cnextFiles.find(
      (file) => file.path === "/proj/src/app.cnx",
    );

    expect(Object.isFrozen(app?.discoveredFile)).toBe(true);
    expect(Object.isFrozen(app?.cnextIncludes)).toBe(true);
    expect(Object.isFrozen(app?.cnextIncludes[0])).toBe(true);
    expect(Object.isFrozen(graph.headerFiles[0])).toBe(true);
    // The `RunAnchor`'s own object, which the next run at this anchor reuses
    expect(Object.isFrozen(graph.anchor.defines)).toBe(true);
  });

  it("has no files when the entry is not C-Next", async () => {
    const fs = new MockFileSystem().addFile("/proj/src/readme.txt", "hello");
    const warnings: string[] = [];
    const notCNext = { ...settings, input: "/proj/src/readme.txt" };

    const { graph } = Discover.run(
      { kind: "files" },
      RunAnchor.at(notCNext.input, null, notCNext, fs),
      notCNext,
      fs,
      warnings,
    );

    expect(graph.cnextFiles).toEqual([]);
    expect(graph.includes.c.size).toBe(0);
  });

  // #2165: every project-root walk reports the old-name configs it passes
  describe("renamed config files", () => {
    /** E0918 for an old-name file with no new-name config beside it. */
    function renamedError(path: string, successor: string): unknown {
      return ConfigFileNames.errorFor({ path, successor, besideConfig: null });
    }

    function discoverErrors(
      files: MockFileSystem,
      run = settings,
    ): readonly unknown[] {
      fs = files;
      return Discover.run(
        { kind: "files" },
        RunAnchor.at(run.input, null, run, fs),
        run,
        fs,
        [],
      ).errors;
    }

    it("reports one that two directories' walks pass, once", () => {
      // /proj/src and /proj/src/sub are walked separately; both pass /proj
      const errors = discoverErrors(
        new MockFileSystem()
          .addFile(
            "/proj/src/app.cnx",
            '#include "sub/lib.cnx"\n\nvoid main() { }\n',
          )
          .addFile("/proj/src/sub/lib.cnx", "u32 one() { return 1; }\n")
          .addFile("/proj/cnext.config.json", "{}"),
      );

      expect(errors).toEqual([
        renamedError("/proj/cnext.config.json", "cnx.config.json"),
      ]);
    });

    it("reports one beside a file included from another tree", () => {
      const errors = discoverErrors(
        new MockFileSystem()
          .addFile("/proj/.git", "")
          .addFile(
            "/proj/src/app.cnx",
            "#include <util.cnx>\nvoid main() { }\n",
          )
          .addFile("/vendor/util/util.cnx", "u32 one() { return 1; }\n")
          .addFile("/vendor/util/.cnextrc", "{}")
          // Negative control: the same tree under a new name is silent
          .addFile("/proj/.cnxrc", "{}"),
        { ...settings, includeDirs: ["/vendor/util"] },
      );

      expect(errors).toEqual([renamedError("/vendor/util/.cnextrc", ".cnxrc")]);
    });

    it("never reports one above the root the walk stops at", () => {
      const errors = discoverErrors(
        project()
          .addFile("/proj/package.json", "{}")
          .addFile("/cnext.config.json", "{}"),
      );

      expect(errors).toEqual([]);
    });

    it("reports the anchor's own walk though no file of the run is walked", () => {
      const notCNext = { ...settings, input: "/proj/src/readme.txt" };

      const errors = discoverErrors(
        new MockFileSystem()
          .addFile("/proj/src/readme.txt", "hello")
          .addFile("/proj/src/.cnext.json", "{}"),
        notCNext,
      );

      expect(errors).toEqual([
        renamedError("/proj/src/.cnext.json", ".cnx.json"),
      ]);
    });

    // A source run is the editor's (serve mode): its text lives in memory,
    // and the run is anchored where it says the text sits (#1719)
    it("reports one the walk from a source run's text passes", () => {
      fs = new MockFileSystem()
        .addFile("/proj/.git", "")
        .addFile("/proj/src/lib.cnx", "u32 one() { return 1; }\n")
        .addFile("/proj/cnext.config.json", "{}");

      const { errors } = Discover.run(
        {
          kind: "source",
          source: '#include "lib.cnx"\n\nvoid main() { }\n',
          sourcePath: "/proj/src/app.cnx",
        },
        RunAnchor.at(settings.input, null, settings, fs),
        settings,
        fs,
        [],
      );

      expect(errors).toEqual([
        renamedError("/proj/cnext.config.json", "cnx.config.json"),
      ]);
    });

    it("stops reporting it once the file is renamed, at the same anchor", () => {
      fs = project().addFile("/proj/cnext.config.json", "{}");
      const anchor = RunAnchor.at(settings.input, null, settings, fs);
      const first = Discover.run({ kind: "files" }, anchor, settings, fs, []);
      fs.rename("/proj/cnext.config.json", "/proj/cnx.config.json");

      const second = Discover.run(
        { kind: "files" },
        first.anchor,
        settings,
        fs,
        [],
      );

      expect(first.errors).toHaveLength(1);
      expect(second.errors).toEqual([]);
      // #2221 review: the renamed file is a marker now, and the anchor's root
      // follows it, as discovery's own walk from the anchor does
      expect(first.anchor.projectRoot).toBeUndefined();
      expect(second.anchor.projectRoot).toBe("/proj");
    });

    it("keeps the anchor while its project root is unchanged", () => {
      fs = project().addFile("/proj/cnx.config.json", "{}");
      const anchor = RunAnchor.at(settings.input, null, settings, fs);
      const first = Discover.run({ kind: "files" }, anchor, settings, fs, []);

      const second = Discover.run(
        { kind: "files" },
        first.anchor,
        settings,
        fs,
        [],
      );

      expect(first.anchor.projectRoot).toBe("/proj");
      expect(second.anchor).toBe(first.anchor);
    });
  });
});
