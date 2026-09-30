import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { describe, expect, it } from "vitest";

import NodeFileSystem from "../NodeFileSystem";

const fs = NodeFileSystem.instance;

describe("NodeFileSystem.withTempFile (#1653)", () => {
  it("hands `use` a file holding the content, alone in a fresh directory", async () => {
    const seen = await fs.withTempFile(
      "tu.c",
      "#include <x.h>\n",
      async (path) => ({
        name: basename(path),
        content: readFileSync(path, "utf-8"),
        neighbors: readdirSync(dirname(path)),
      }),
    );
    expect(seen).toEqual({
      name: "tu.c",
      content: "#include <x.h>\n",
      neighbors: ["tu.c"],
    });
  });

  it("removes the directory once `use` resolves", async () => {
    const dir = await fs.withTempFile("a.c", "", async (path) => dirname(path));
    expect(existsSync(dir)).toBe(false);
  });

  it("removes the directory and rethrows when `use` throws", async () => {
    let dir = "";
    await expect(
      fs.withTempFile("a.c", "", async (path) => {
        dir = dirname(path);
        throw new Error("cpp failed");
      }),
    ).rejects.toThrow("cpp failed");
    expect(dir).not.toBe("");
    expect(existsSync(dir)).toBe(false);
  });
});
