/**
 * #1827: a compiler name or path reaches ToolchainDetector from the project
 * being compiled (`compile_commands.json`'s `argv[0]`, or CNX_CROSS_COMPILER).
 * No shell may parse it. These tests use the real `node:child_process`, so a
 * shell that runs the payload creates the marker file.
 *
 * One control per site: each `describe` reaches exactly one place that starts
 * a process, and reverting that place to a shell command line reddens it.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ToolchainDetector from "../ToolchainDetector";
import NodeFileSystem from "../../../1-Discover/NodeFileSystem";

const MARKER_VAR = "CNX_SHELL_MARKER";

/** Each payload runs `touch` on the marker only if a shell parses it. */
const PAYLOADS = [
  `gcc;touch "$${MARKER_VAR}";`,
  `gcc$(touch "$${MARKER_VAR}")`,
];

describe("ToolchainDetector starts no shell (#1827)", () => {
  let dir: string;
  let marker: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnx-1827-"));
    marker = join(dir, "PWNED");
    process.env[MARKER_VAR] = marker;
  });

  afterEach(() => {
    delete process.env[MARKER_VAR];
    rmSync(dir, { recursive: true, force: true });
  });

  describe("a compiler name, resolved on PATH", () => {
    it.each(PAYLOADS)("%s runs nothing and yields no toolchain", (name) => {
      const toolchain = ToolchainDetector.fromPath(
        name,
        NodeFileSystem.instance,
      );

      expect(existsSync(marker)).toBe(false);
      expect(toolchain).toBeNull();
    });
  });

  describe("a compiler path that exists, asked for its version", () => {
    it.each(PAYLOADS)("bin/%s runs nothing", (fileName) => {
      mkdirSync(join(dir, "bin"));
      const path = join(dir, "bin", fileName);
      writeFileSync(path, "");
      chmodSync(path, 0o755);

      const toolchain = ToolchainDetector.fromPath(
        path,
        NodeFileSystem.instance,
      );

      expect(existsSync(marker)).toBe(false);
      expect(toolchain?.cc).toBe(path);
    });
  });

  describe("a toolchain asked for its default include paths", () => {
    it.each(PAYLOADS)("cc %s runs nothing", (cc) => {
      const paths = ToolchainDetector.getDefaultIncludePaths({
        name: "gcc",
        cc,
        cxx: cc,
        cpp: cc,
        isCrossCompiler: false,
      });

      expect(existsSync(marker)).toBe(false);
      expect(paths).toEqual([]);
    });
  });

  // Controls: the real compiler still resolves and still reports. Without
  // these, a detector that runs nothing at all would pass every test above.
  describe("the host gcc", () => {
    it("resolves by name and reports a version", () => {
      const toolchain = ToolchainDetector.fromPath(
        "gcc",
        NodeFileSystem.instance,
      );

      expect(toolchain?.cc).toMatch(/\/gcc$/);
      expect(toolchain?.version).toMatch(/gcc/i);
    });

    it("lists the same include paths the shell command line did", () => {
      const reference = execSync("echo | gcc -E -Wp,-v - 2>&1", {
        encoding: "utf-8",
        env: { ...process.env, LC_ALL: "C" },
      });
      const start = reference.indexOf("#include <...> search starts here:");
      const end = reference.indexOf("End of search list.");
      const expected = reference
        .slice(reference.indexOf("\n", start) + 1, end)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const paths = ToolchainDetector.getDefaultIncludePaths(
        ToolchainDetector.fromPath("gcc", NodeFileSystem.instance)!,
      );

      expect(expected.length).toBeGreaterThan(0);
      expect(paths).toEqual(expected);
    });
  });
});
