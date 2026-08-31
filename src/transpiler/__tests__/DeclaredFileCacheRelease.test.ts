import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import ITranspilerConfig from "../types/ITranspilerConfig";

/**
 * #1301 review: the parse cache must be released when a run ENDS, not merely when
 * the next one starts.
 *
 * `Transpiler` is not always per-process. `ServeCommand` holds one instance in a
 * static field and reuses it for every request, so a cache cleared only on entry
 * leaves the language server holding every `ProgramContext` and `CommonTokenStream`
 * from the last request for as long as the editor sits idle. Before #1301 both were
 * locals that died with `_transpileFile`.
 *
 * Peak-RSS benchmarking cannot see this -- it measures the in-run high water mark,
 * and post-run residency is a different number -- so the property is asserted
 * directly instead.
 */
describe("#1301: declared-file cache is released at end of run", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnext-cache-release-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  /** Reads the private cache without widening its visibility for production. */
  function cacheSize(transpiler: Transpiler): number {
    return (transpiler as unknown as { declaredFiles: Map<string, unknown> })
      .declaredFiles.size;
  }

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

  it("holds nothing after a successful run", async () => {
    const transpiler = createTranspiler(writeProject());

    const result = await transpiler.transpile({ kind: "files" });

    // NEGATIVE CONTROL for the assertion below. "Cache is empty afterwards" would
    // also hold if the cache were never populated at all -- so prove it WAS. Stage
    // 5 throws when the cache misses, and its output is what `files` carries, so a
    // successful multi-file run is only reachable through a populated cache.
    expect(result.success).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);

    expect(cacheSize(transpiler)).toBe(0);
  });

  it("holds nothing after a run that fails in stage 5", async () => {
    // A failing run must not strand the trees either -- the `finally` covers the
    // error path, which a clear at the end of the happy path would miss.
    //
    // The failure has to occur AFTER stage 3 has populated the cache, or the test
    // cannot fail: a parse error returns before `_declareFile` is ever reached, so
    // the cache is empty regardless of the fix. E0800 is an analyzer diagnostic
    // raised in stage 5, by which point every file is cached. Mutation-checked --
    // removing the `finally` reddens this.
    const entry = join(tempDir, "division-by-zero.cnx");
    writeFileSync(
      entry,
      `u32 total <- 0;\n\nvoid main() {\n    total <- 10 / 0;\n}\n`,
    );
    const transpiler = createTranspiler(entry);

    const result = await transpiler.transpile({ kind: "files" });

    expect(result.success).toBe(false);
    expect(cacheSize(transpiler)).toBe(0);
  });

  it("holds nothing between runs on a reused instance (the ServeCommand shape)", async () => {
    const entry = writeProject();
    const transpiler = createTranspiler(entry);

    const first = await transpiler.transpile({ kind: "files" });
    expect(first.success).toBe(true);
    expect(cacheSize(transpiler)).toBe(0);

    const second = await transpiler.transpile({ kind: "files" });
    expect(second.success).toBe(true);
    expect(cacheSize(transpiler)).toBe(0);
  });
});
