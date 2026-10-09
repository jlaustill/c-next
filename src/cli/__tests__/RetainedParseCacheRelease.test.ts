import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import ITranspilerConfig from "../../types/ITranspilerConfig";
import NodeFileSystem from "../../PARSE/1-Discover/NodeFileSystem";

/**
 * #1301 review: the run's per-file artifacts must be released when a run ENDS, not
 * merely when the next one starts.
 *
 * `Transpiler` is not always per-process. `ServeCommand` holds one instance in a
 * static field and reuses it for every request, so a cache cleared only on entry
 * leaves the language server holding the last request's files for as long as the
 * editor sits idle. Since #1932 what it holds is plain data: every parse tree is a
 * local of `TreePasses.run` and never reaches `Transpiler`, which
 * `scripts/__tests__/artifact-lifetime.test.ts` asserts of every field and value.
 *
 * Peak-RSS benchmarking cannot see this -- it measures the in-run high water mark,
 * and post-run residency is a different number -- so the property is asserted
 * directly instead.
 */
describe("#1301: the per-file cache is released at end of run", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnext-cache-release-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  /** Reads the private cache without widening its visibility for production. */
  function cacheSize(transpiler: Transpiler): number {
    // #1932: the cache holds 2.1's plain-data `IAnalyzedFile`, not 1.2's
    // `IParsedFile`. The property under test is unchanged -- what is retained
    // must not outlive the run.
    return (transpiler as unknown as { analyzedFiles: Map<string, unknown> })
      .analyzedFiles.size;
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
      target: "host",
    };
    return new Transpiler(config, NodeFileSystem.instance);
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
    // A failing run must not strand the cache either -- the `finally` covers the
    // error path, which a clear at the end of the happy path would miss.
    //
    // The failure has to occur AFTER stage 3 has populated the cache, or the test
    // cannot fail: a parse error stops `TreePasses` before it returns any file, so
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
  it("Stage 5 reads every file's plain data (#1932)", async () => {
    const transpiler = createTranspiler(writeProject());
    const internals = transpiler as unknown as {
      analyzedFiles: Map<string, unknown>;
      _transpileFile: (...args: unknown[]) => unknown;
    };
    const seen: number[] = [];
    const original = internals._transpileFile.bind(transpiler);
    internals._transpileFile = (...args: unknown[]) => {
      seen.push(internals.analyzedFiles.size);
      return original(...args);
    };

    const result = await transpiler.transpile({ kind: "files" });

    // NEGATIVE CONTROL: Stage 5 ran, once per file, and had the plain data.
    expect(result.success).toBe(true);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen).toEqual(seen.map(() => 2));
    expect(internals.analyzedFiles.size).toBe(0);
  });
});
