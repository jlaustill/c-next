/**
 * `NodeFileSystem.withTempFile` ignores a failure to remove its directory
 * (#1826 review).
 *
 * The removal has to fail for real, or the `catch` is never reached:
 * `rmSync(…, { force: true })` already swallows a missing directory, so a test
 * that deletes the directory itself proves nothing. Here `rmSync` throws EBUSY.
 *
 * This file performs no recursive delete. It removes what it made with
 * `unlinkSync` and `rmdirSync`, which fail harmlessly rather than emptying
 * whatever directory a mutation might hand them.
 */
import { dirname } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (importActual) => {
  const actual = await importActual<typeof import("node:fs")>();
  return {
    ...actual,
    rmSync: vi.fn(() => {
      throw Object.assign(new Error("EBUSY: resource busy"), { code: "EBUSY" });
    }),
  };
});

import { rmSync, rmdirSync, unlinkSync } from "node:fs";
import NodeFileSystem from "../NodeFileSystem";

describe("NodeFileSystem.withTempFile when removal fails", () => {
  it("still returns what `use` returned", async () => {
    let path = "";
    const result = await NodeFileSystem.instance.withTempFile(
      "tu.c",
      "int x;\n",
      async (p) => {
        path = p;
        return "done";
      },
    );

    expect(result).toBe("done");
    expect(rmSync).toHaveBeenCalledWith(dirname(path), {
      recursive: true,
      force: true,
    });

    // The mocked removal left them behind; take them away without recursion.
    unlinkSync(path);
    rmdirSync(dirname(path));
  });
});
