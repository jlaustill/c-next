import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import NodeFileSystem from "../NodeFileSystem";
import type IFileSystem from "../types/IFileSystem";

/**
 * #1444, owner ruling 3: one run reads `platformio.ini` once.
 *
 * 1.1 Discover read it once per directory that resolved includes, for
 * `lib_extra_dirs`, and Stage 3 read it again for ADR-049's target. A save
 * between those reads gave the run's libraries one version of the file and its
 * target another. Measured at `b07128739`: 2 reads with every `.cnx` file in
 * one directory, so the project below spreads them over two to show both
 * halves.
 */
describe("#1444: one run reads platformio.ini once", () => {
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "cnext-one-pio-read-"));
    mkdirSync(join(project, "src"));
    mkdirSync(join(project, "lib", "util"), { recursive: true });
    writeFileSync(
      join(project, "platformio.ini"),
      "[env:uno]\nplatform = atmelavr\nboard = uno\nlib_extra_dirs = lib\n",
    );
    writeFileSync(
      join(project, "src", "main.cnx"),
      '#include "../lib/util/util.cnx"\n\nvoid main() {\n    u32 x <- Util.twice(2);\n}\n',
    );
    writeFileSync(
      join(project, "lib", "util", "util.cnx"),
      "scope Util {\n    public u32 twice(u32 v) { return v * 2; }\n}\n",
    );
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  /** The host port, counting the reads that reach it, by file name. */
  function countingPort(): { fs: IFileSystem; reads: Map<string, number> } {
    const reads = new Map<string, number>();
    const host = NodeFileSystem.instance;
    const fs = new Proxy(host, {
      get(target, key, receiver) {
        if (key === "readFile") {
          return (path: string): string => {
            const name = path.split("/").pop() ?? path;
            reads.set(name, (reads.get(name) ?? 0) + 1);
            return target.readFile(path);
          };
        }
        const value = Reflect.get(target, key, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    return { fs, reads };
  }

  it("reads it once, and takes the target from it", async () => {
    const { fs, reads } = countingPort();
    const transpiler = new Transpiler(
      {
        input: join(project, "src", "main.cnx"),
        outDir: join(project, "out"),
        noCache: true,
      },
      fs,
    );

    const result = await transpiler.transpile({ kind: "files" });

    // The target came from the file: the run names none of its own
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
    expect(reads.get("platformio.ini")).toBe(1);
    // CONTROL: the count is real -- each source is read, and read once
    expect(reads.get("main.cnx")).toBe(1);
    expect(reads.get("util.cnx")).toBe(1);
  });
});
