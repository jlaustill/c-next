import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NodeFileSystem from "../../../1-Discover/NodeFileSystem";
import PreprocessCache from "../PreprocessCache";
import testPreprocessor from "./testPreprocessor";

const available = testPreprocessor().isAvailable();

/** #1991 review: the files a cached run read are recorded as cpp listed them */
describe.skipIf(!available)("Preprocessor records what a run read", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnx-preprocess-deps-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it("records a header with a # in its name, which cpp lists as \\#", async () => {
    const header = join(dir, "h#x.h");
    writeFileSync(header, "int x;\n");
    const cache = new PreprocessCache(dir, NodeFileSystem.instance);
    const record = vi.spyOn(cache, "record");
    const result = await testPreprocessor(
      NodeFileSystem.instance,
      undefined,
      cache,
    ).preprocessString('#include "h#x.h"\n', "cnx-include.h", {
      includePaths: [dir],
    });
    expect(result.success).toBe(true);
    expect(record).toHaveBeenCalledTimes(1);
    const deps = record.mock.calls[0][1].deps.map((dep) => dep[0]);
    expect(deps).toContain(header);
  });
});
