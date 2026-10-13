/**
 * NodeFileSystem.isExecutable answers what `which` asks of a PATH candidate: a
 * file, with execute permission. ToolchainDetector searches PATH with it (#1827).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import NodeFileSystem from "../NodeFileSystem";

describe("NodeFileSystem.isExecutable", () => {
  let dir: string;
  const fs = NodeFileSystem.instance;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnx-exec-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("is true for a file with execute permission", () => {
    const path = join(dir, "tool");
    writeFileSync(path, "");
    chmodSync(path, 0o755);

    expect(fs.isExecutable(path)).toBe(true);
  });

  it.skipIf(process.platform === "win32")(
    "is false for a file without execute permission",
    () => {
      const path = join(dir, "tool");
      writeFileSync(path, "");
      chmodSync(path, 0o644);

      expect(fs.isExecutable(path)).toBe(false);
    },
  );

  it("is false for a directory, even a searchable one", () => {
    const path = join(dir, "sub");
    mkdirSync(path);

    expect(fs.isExecutable(path)).toBe(false);
  });

  it("is false for a path that does not exist", () => {
    expect(fs.isExecutable(join(dir, "missing"))).toBe(false);
  });
});
