import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NodeFileSystem from "../../NodeFileSystem";
import PreprocessCache from "../PreprocessCache";
import Preprocessor from "../Preprocessor";

const available = new Preprocessor(NodeFileSystem.instance).isAvailable();

/** #1991 review: the files a cached run read are recorded as cpp listed them */
describe.skipIf(!available)("Preprocessor records what a run read", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-preprocess-deps-"));
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
    const result = await new Preprocessor(
      NodeFileSystem.instance,
    ).preprocessString('#include "h#x.h"\n', "cnext-include.h", {
      includePaths: [dir],
      cache,
    });
    expect(result.success).toBe(true);
    expect(record).toHaveBeenCalledTimes(1);
    const deps = record.mock.calls[0][1].deps.map((dep) => dep[0]);
    expect(deps).toContain(header);
  });
});
