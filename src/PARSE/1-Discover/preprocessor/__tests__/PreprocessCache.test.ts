import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import NodeFileSystem from "../../NodeFileSystem";
import PreprocessCache from "../PreprocessCache";

describe("PreprocessCache keeps only recent configurations (#1844)", () => {
  let root: string;
  let read: string;
  const fs = NodeFileSystem.instance;
  const entry = () => ({
    stdout: "int x;",
    stderr: "",
    error: null,
    deps: [[read, fs.stat(read).mtimeMs] as const],
    absent: [],
  });
  /** One run: what it looks up, then what it records */
  const run = (lookups: string[], records: string[]): (string | null)[] => {
    const cache = new PreprocessCache(root, fs);
    const found = lookups.map((key) => (cache.lookup(key) ? key : null));
    for (const key of records) cache.record(key, entry());
    cache.flush();
    return found;
  };
  const stored = (): string[] =>
    Object.keys(
      JSON.parse(
        readFileSync(join(root, ".cnx/cache/preprocess.json"), "utf-8"),
      ).entries,
    );

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "cnext-preprocess-cache-"));
    read = join(root, "a.h");
    writeFileSync(read, "int x;\n");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("drops an entry no run used in the last 4 that wrote the cache", () => {
    for (let level = 1; level <= 6; level++) run([], [`LEVEL=${level}`]);

    expect(stored()).toEqual(["LEVEL=3", "LEVEL=4", "LEVEL=5", "LEVEL=6"]);
  });

  it("keeps an entry a run between them read", () => {
    run([], ["A"]);
    for (let level = 1; level <= 6; level++) {
      run([], [`LEVEL=${level}`]);
      expect(run(["A"], [])).toEqual(["A"]);
    }

    expect(stored()).toContain("A");
  });

  it("control: a run that only reads fresh entries writes nothing", () => {
    run([], ["A"]);
    const before = readFileSync(
      join(root, ".cnx/cache/preprocess.json"),
      "utf-8",
    );

    expect(run(["A"], [])).toEqual(["A"]);
    expect(
      readFileSync(join(root, ".cnx/cache/preprocess.json"), "utf-8"),
    ).toBe(before);
  });
});
