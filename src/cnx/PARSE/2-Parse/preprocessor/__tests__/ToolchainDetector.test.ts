/**
 * Unit tests for ToolchainDetector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { delimiter } from "node:path";
import ToolchainDetector from "../ToolchainDetector";

// Mock child_process
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  spawnSync: vi.fn(),
}));

import { execFileSync, spawnSync } from "node:child_process";
import TestFileSystem from "../../../../types/__testUtils__/TestFileSystem";

const installed = TestFileSystem.installedExecutables;

/**
 * Answer the mocked `execFileSync` by the command it would run, written as one
 * string (`/usr/bin/gcc --version`) so a case reads as the invocation it stubs.
 */
function whenRun(answer: (command: string) => string): void {
  vi.mocked(execFileSync).mockImplementation(((
    file: string,
    args?: readonly string[],
  ) => answer([file, ...(args ?? [])].join(" "))) as typeof execFileSync);
}

describe("ToolchainDetector", () => {
  const originalPath = process.env.PATH;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PATH = "/usr/bin";
    whenRun(() => {
      throw new Error("not run");
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.PATH = originalPath;
  });

  describe("PATH search", () => {
    it("takes the first PATH directory that holds the executable", () => {
      process.env.PATH = ["/opt/a", "/usr/bin"].join(delimiter);
      whenRun(() => "gcc 13\n");

      const result = ToolchainDetector.fromPath(
        "gcc",
        installed("/opt/a/gcc", "/usr/bin/gcc"),
      );

      expect(result!.cc).toBe("/opt/a/gcc");
    });

    it("skips an empty PATH entry instead of searching the current directory", () => {
      process.env.PATH = ["", "/usr/bin"].join(delimiter);
      const fs = installed();
      const asked = vi.spyOn(fs, "isExecutable");

      ToolchainDetector.fromPath("gcc", fs);

      expect(asked).toHaveBeenCalled();
      for (const call of asked.mock.calls) {
        expect(call[0]).toMatch(/^\/usr\/bin\//);
      }
    });

    it("finds nothing when PATH is unset", () => {
      delete process.env.PATH;

      expect(
        ToolchainDetector.fromPath("gcc", installed("/usr/bin/gcc")),
      ).toBeNull();
    });
  });

  describe("getDefaultIncludePaths", () => {
    it("parses include paths from compiler output", () => {
      const compilerOutput = `Using built-in specs.
#include "..." search starts here:
#include <...> search starts here:
 /usr/lib/gcc/x86_64-linux-gnu/11/include
 /usr/local/include
 /usr/include/x86_64-linux-gnu
 /usr/include
End of search list.
`;
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stderr: compilerOutput,
      } as ReturnType<typeof spawnSync>);

      const toolchain = {
        name: "gcc",
        cc: "/usr/bin/gcc",
        cxx: "/usr/bin/g++",
        cpp: "/usr/bin/gcc",
        isCrossCompiler: false,
      };

      const paths = ToolchainDetector.getDefaultIncludePaths(toolchain);

      expect(paths).toEqual([
        "/usr/lib/gcc/x86_64-linux-gnu/11/include",
        "/usr/local/include",
        "/usr/include/x86_64-linux-gnu",
        "/usr/include",
      ]);
    });

    it("returns empty array when the compiler cannot be started", () => {
      vi.mocked(spawnSync).mockReturnValue({
        error: new Error("spawn /usr/bin/gcc ENOENT"),
      } as ReturnType<typeof spawnSync>);

      const toolchain = {
        name: "gcc",
        cc: "/usr/bin/gcc",
        cxx: "/usr/bin/g++",
        cpp: "/usr/bin/gcc",
        isCrossCompiler: false,
      };

      const paths = ToolchainDetector.getDefaultIncludePaths(toolchain);
      expect(paths).toEqual([]);
    });

    it("returns empty array when the compiler exits non-zero", () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 1,
        stderr:
          "#include <...> search starts here:\n /partial/include\nEnd of search list.\n",
      } as ReturnType<typeof spawnSync>);

      const toolchain = {
        name: "gcc",
        cc: "/usr/bin/gcc",
        cxx: "/usr/bin/g++",
        cpp: "/usr/bin/gcc",
        isCrossCompiler: false,
      };

      expect(ToolchainDetector.getDefaultIncludePaths(toolchain)).toEqual([]);
    });

    it("returns empty array when no include section found", () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stderr: "Some other output\n",
      } as ReturnType<typeof spawnSync>);

      const toolchain = {
        name: "gcc",
        cc: "/usr/bin/gcc",
        cxx: "/usr/bin/g++",
        cpp: "/usr/bin/gcc",
        isCrossCompiler: false,
      };

      const paths = ToolchainDetector.getDefaultIncludePaths(toolchain);
      expect(paths).toEqual([]);
    });
  });

  describe("version extraction", () => {
    it("extracts version from first line of output", () => {
      whenRun((cmd) => {
        if (cmd === "/usr/bin/gcc --version") {
          return "gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0\nCopyright (C) 2021\nMore lines...\n";
        }
        throw new Error("not found");
      });

      const result = ToolchainDetector.fromPath(
        "gcc",
        installed("/usr/bin/gcc"),
      );

      expect(result!.version).toBe("gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0");
    });

    it("handles missing version gracefully", () => {
      whenRun(() => {
        throw new Error("version failed");
      });

      const result = ToolchainDetector.fromPath(
        "gcc",
        installed("/usr/bin/gcc"),
      );

      expect(result!.version).toBeUndefined();
    });
  });
});
