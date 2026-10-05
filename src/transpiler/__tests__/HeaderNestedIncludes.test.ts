/**
 * Issue #1723: a C header's own `#include`s are searched along the same path
 * as the `.cnx` file that reached the header.
 *
 * Discovery resolves a `.cnx` file's includes along its directory, the project
 * tiers, PlatformIO libdeps and Arduino libraries (#1435). A header those
 * reach was then walked with `[dirname(header), ...--include dirs]` alone, so a
 * libdeps header including a SIBLING library's header lost that header's
 * declarations -- a false E0422 where a compiler, with PlatformIO's -I path,
 * finds it. The preprocessor was handed the same weaker list.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import Preprocessor from "../../PARSE/1-Discover/preprocessor/Preprocessor";
import NodeFileSystem from "../../PARSE/1-Discover/NodeFileSystem";

const MAIN = `#include <A.h>

void setup() {
    a_init();
    b_init();
}
`;

describe("a C header's own includes (#1723)", () => {
  let project: string;
  let libA: string;
  let libB: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "cnext-1723-"));
    writeFileSync(
      join(project, "platformio.ini"),
      "[env:uno]\nplatform = atmelavr\nboard = uno\n",
    );
    libA = join(project, ".pio", "libdeps", "uno", "LibA", "src");
    libB = join(project, ".pio", "libdeps", "uno", "LibB", "src");
    mkdirSync(libA, { recursive: true });
    mkdirSync(libB, { recursive: true });
    mkdirSync(join(project, "src"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(project, { recursive: true, force: true });
  });

  /** The same program in both modes, so neither path keeps its own list. */
  async function bothModes() {
    const main = join(project, "src", "main.cnx");
    writeFileSync(main, MAIN);
    const files = await new Transpiler(
      {
        input: main,
        outDir: join(project, "build"),
        noCache: true,
      },
      NodeFileSystem.instance,
    ).transpile({ kind: "files" });
    const source = await new Transpiler(
      {
        input: "",
        noCache: true,
      },
      NodeFileSystem.instance,
    ).transpile({ kind: "source", source: MAIN, sourcePath: main });
    return [files, source];
  }

  it("resolves a libdeps header's include of a sibling library's header", async () => {
    writeFileSync(join(libA, "A.h"), '#include "B.h"\nvoid a_init(void);\n');
    writeFileSync(join(libB, "B.h"), "void b_init(void);\n");

    for (const result of await bothModes()) {
      expect(result.errors).toEqual([]);
      expect(result.warnings.filter((w) => w.includes("B.h"))).toEqual([]);
    }
  });

  it("control: the sibling header beside the header that includes it", async () => {
    writeFileSync(join(libA, "A.h"), '#include "B.h"\nvoid a_init(void);\n');
    writeFileSync(join(libA, "B.h"), "void b_init(void);\n");

    for (const result of await bothModes()) {
      expect(result.errors).toEqual([]);
      expect(result.warnings.filter((w) => w.includes("B.h"))).toEqual([]);
    }
  });

  it("hands the preprocessor the same search path", async () => {
    // `#if EXPR` is what sends a header to the preprocessor. Recording the
    // include path it is handed pins the list without needing a compiler.
    writeFileSync(
      join(libA, "A.h"),
      '#define LIB_A 1\n#if LIB_A >= 1\n#include "B.h"\nvoid a_init(void);\n#endif\n',
    );
    writeFileSync(join(libB, "B.h"), "void b_init(void);\n");
    const handed: string[][] = [];
    vi.spyOn(Preprocessor.prototype, "isAvailable").mockReturnValue(true);
    vi.spyOn(Preprocessor.prototype, "preprocess").mockImplementation(
      async (
        file: string,
        options?: { includePaths?: string[]; dumpMacros?: boolean },
      ) => {
        // #1688's macro dump of the file's includes is not a header's run
        if (!options?.dumpMacros) {
          handed.push([...(options?.includePaths ?? [])]);
        }
        return {
          content: readFileSync(file, "utf-8"),
          sourceMappings: [],
          success: true,
          originalFile: file,
        };
      },
    );

    for (const result of await bothModes()) {
      expect(result.errors).toEqual([]);
    }
    expect(handed).toHaveLength(2);
    for (const includePaths of handed) {
      expect(includePaths).toContain(libB);
    }
  });
});
