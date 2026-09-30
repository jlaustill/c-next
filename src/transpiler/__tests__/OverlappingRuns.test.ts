import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import Preprocessor from "../logic/preprocessor/Preprocessor";
import NodeFileSystem from "../NodeFileSystem";

/**
 * Issue #1721: two runs on ONE instance, the second requested while the first
 * is parked on header preprocessing -- the shape `ServeCommand` produces, since
 * it holds one static `Transpiler` and does not wait for a request before
 * dispatching the next. The second run's `_initializeRun` cleared the discovery
 * maps the first run's `Program.build` had not read yet: on `main` the parked
 * run lost its `.cnx` include rewrite silently, and once `quotedIncludeDirectory`
 * asserted, it failed with an internal error.
 *
 * The preprocessor is held open by the test rather than timed, so the overlap
 * is certain instead of likely.
 */
describe("overlapping runs on one Transpiler (#1721)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnext-overlap-"));
    mkdirSync(join(tempDir, "src"));
    // `#if EXPR` is what sends a header to the preprocessor.
    writeFileSync(
      join(tempDir, "src", "board.h"),
      "#define ARDUINO 185\n#if ARDUINO >= 100\nvoid board_init(void);\n#endif\n",
    );
    writeFileSync(
      join(tempDir, "src", "colors.cnx"),
      "enum EColor { RED, GREEN }\n",
    );
    writeFileSync(
      join(tempDir, "src", "shapes.cnx"),
      "enum EShape { CIRCLE, SQUARE }\n",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  function first(board: boolean) {
    return {
      kind: "source" as const,
      source: `${board ? '#include "board.h"\n' : ""}#include "colors.cnx"\n\nvoid main() {\n    EColor c <- EColor.GREEN;\n${board ? "    board_init();\n" : ""}}\n`,
      sourcePath: join(tempDir, "src", "main.cnx"),
    };
  }

  const second = () => ({
    kind: "source" as const,
    source:
      '#include "shapes.cnx"\n\nvoid other() {\n    EShape s <- EShape.SQUARE;\n}\n',
    sourcePath: join(tempDir, "src", "other.cnx"),
  });

  /** Each input's result on a fresh instance: the answer overlap must not change. */
  async function alone(input: ReturnType<typeof second>) {
    return new Transpiler(
      {
        target: "host",
        input: "",
        noCache: true,
      },
      NodeFileSystem.instance,
    ).transpile(input);
  }

  /** Holds every header preprocess until `release()` is called. */
  function holdPreprocessor(): () => void {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    vi.spyOn(Preprocessor.prototype, "isAvailable").mockReturnValue(true);
    vi.spyOn(Preprocessor.prototype, "preprocess").mockImplementation(
      async (file: string) => {
        await held;
        return {
          content: readFileSync(file, "utf-8"),
          sourceMappings: [],
          success: true,
          originalFile: file,
        };
      },
    );
    return release;
  }

  async function overlapped(board: boolean) {
    const release = holdPreprocessor();
    const transpiler = new Transpiler(
      {
        target: "host",
        input: "",
        noCache: true,
      },
      NodeFileSystem.instance,
    );
    const firstRun = transpiler.transpile(first(board));
    // Let the first run reach the held preprocessor.
    await new Promise((resolve) => setImmediate(resolve));
    const secondRun = transpiler.transpile(second());
    await new Promise((resolve) => setImmediate(resolve));
    release();
    return Promise.all([firstRun, secondRun]);
  }

  it("gives each run the result it gets alone", async () => {
    const [firstResult, secondResult] = await overlapped(true);
    const firstAlone = await alone(first(true));
    const secondAlone = await alone(second());

    expect(firstResult.errors).toEqual([]);
    expect(firstResult.files[0]?.code).toBe(firstAlone.files[0]?.code);
    expect(secondResult.errors).toEqual([]);
    expect(secondResult.files[0]?.code).toBe(secondAlone.files[0]?.code);
  });

  it("keeps the parked run's .cnx include rewrite (the lost-rewrite shape)", async () => {
    // What went wrong on `main` without an error: the second run's
    // `_initializeRun` cleared the include rewrites the parked run's render
    // still had to read, so its `#include` fell back to the author's spelling.
    // That is only VISIBLE when the rewrite differs from that spelling -- a
    // header output root does it: the author writes "../lib/colors.cnx", and
    // the header lands at include/lib/colors.h, so the rewrite says
    // "lib/colors.h". `workingDir` is what `ServeCommand` passed on `main`; this
    // branch reads the text's own directory and ignores it, so the same test
    // runs on both.
    writeFileSync(join(tempDir, "cnext.config.json"), "{}\n");
    mkdirSync(join(tempDir, "lib"));
    writeFileSync(
      join(tempDir, "lib", "colors.cnx"),
      "enum EColor { RED, GREEN }\n",
    );
    const sourcePath = join(tempDir, "src", "main.cnx");
    const parked = {
      kind: "source" as const,
      source:
        '#include "board.h"\n#include "../lib/colors.cnx"\n\nvoid main() {\n    EColor c <- EColor.GREEN;\n    board_init();\n}\n',
      sourcePath,
      workingDir: dirname(sourcePath),
    };
    const config = {
      input: "",
      noCache: true,
      target: "host",
      headerOutDir: join(tempDir, "include"),
    };
    const firstAlone = await new Transpiler(
      config,
      NodeFileSystem.instance,
    ).transpile(parked);
    // The self-check: the rewrite is observable here, so losing it shows.
    expect(firstAlone.errors).toEqual([]);
    expect(firstAlone.files[0]?.code).not.toContain(
      '#include "../lib/colors.h"',
    );

    const release = holdPreprocessor();
    const transpiler = new Transpiler(config, NodeFileSystem.instance);
    const firstRun = transpiler.transpile(parked);
    await new Promise((resolve) => setImmediate(resolve));
    const secondRun = transpiler.transpile(second());
    await new Promise((resolve) => setImmediate(resolve));
    release();
    const [firstResult] = await Promise.all([firstRun, secondRun]);

    expect(firstResult.errors).toEqual([]);
    expect(firstResult.files[0]?.code).toBe(firstAlone.files[0]?.code);
  });

  it("control: the same runs one after the other on one instance", async () => {
    const transpiler = new Transpiler(
      {
        target: "host",
        input: "",
        noCache: true,
      },
      NodeFileSystem.instance,
    );
    const firstResult = await transpiler.transpile(first(true));
    const secondResult = await transpiler.transpile(second());

    expect(firstResult.files[0]?.code).toBe(
      (await alone(first(true))).files[0]?.code,
    );
    expect(secondResult.files[0]?.code).toBe(
      (await alone(second())).files[0]?.code,
    );
  });

  it("control: an overlap with nothing to preprocess, so no await to park on", async () => {
    const [firstResult, secondResult] = await overlapped(false);

    expect(Preprocessor.prototype.preprocess).not.toHaveBeenCalled();
    expect(firstResult.errors).toEqual([]);
    expect(firstResult.files[0]?.code).toBe(
      (await alone(first(false))).files[0]?.code,
    );
    expect(secondResult.files[0]?.code).toBe(
      (await alone(second())).files[0]?.code,
    );
  });
});
