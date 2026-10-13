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
import MockFileSystem from "../../../../../cli/__tests__/MockFileSystem";

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

/** A filesystem holding exactly these executables. */
function installed(...paths: string[]): MockFileSystem {
  const fs = new MockFileSystem();
  for (const path of paths) fs.addFile(path, "");
  return fs;
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

  describe("detect", () => {
    it("returns null when no toolchain is available", () => {
      const result = ToolchainDetector.detect(installed());
      expect(result).toBeNull();
    });

    it("detects ARM toolchain with highest priority", () => {
      whenRun(() => "arm-none-eabi-gcc (GNU Arm) 10.3.1\n");

      const result = ToolchainDetector.detect(
        installed(
          "/usr/bin/arm-none-eabi-gcc",
          "/usr/bin/arm-none-eabi-g++",
          "/usr/bin/clang",
          "/usr/bin/gcc",
        ),
      );

      expect(result).not.toBeNull();
      expect(result!.name).toBe("arm-none-eabi-gcc");
      expect(result!.cc).toBe("/usr/bin/arm-none-eabi-gcc");
      expect(result!.cxx).toBe("/usr/bin/arm-none-eabi-g++");
      expect(result!.isCrossCompiler).toBe(true);
      expect(result!.target).toBe("arm-none-eabi");
    });

    it("detects clang when ARM is not available", () => {
      whenRun(() => "clang version 14.0.0\n");

      const result = ToolchainDetector.detect(
        installed("/usr/bin/clang", "/usr/bin/clang++", "/usr/bin/gcc"),
      );

      expect(result).not.toBeNull();
      expect(result!.name).toBe("clang");
      expect(result!.cc).toBe("/usr/bin/clang");
      expect(result!.cxx).toBe("/usr/bin/clang++");
      expect(result!.isCrossCompiler).toBe(false);
    });

    it("detects gcc when ARM and clang are not available", () => {
      whenRun(() => "gcc (Ubuntu 11.4.0) 11.4.0\n");

      const result = ToolchainDetector.detect(
        installed("/usr/bin/gcc", "/usr/bin/g++"),
      );

      expect(result).not.toBeNull();
      expect(result!.name).toBe("gcc");
      expect(result!.cc).toBe("/usr/bin/gcc");
      expect(result!.cxx).toBe("/usr/bin/g++");
      expect(result!.isCrossCompiler).toBe(false);
    });

    it("uses cc for cxx when c++ compiler not found", () => {
      whenRun(() => "gcc 11.4.0\n");

      const result = ToolchainDetector.detect(installed("/usr/bin/gcc"));

      expect(result!.cxx).toBe("/usr/bin/gcc");
    });

    it("returns null when no PATH directory holds a compiler", () => {
      const result = ToolchainDetector.detect(installed("/opt/elsewhere/gcc"));
      expect(result).toBeNull();
    });
  });

  describe("PATH search", () => {
    it("takes the first PATH directory that holds the executable", () => {
      process.env.PATH = ["/opt/a", "/usr/bin"].join(delimiter);
      whenRun(() => "gcc 13\n");

      const result = ToolchainDetector.detect(
        installed("/opt/a/gcc", "/usr/bin/gcc"),
      );

      expect(result!.cc).toBe("/opt/a/gcc");
    });

    it("skips an empty PATH entry instead of searching the current directory", () => {
      process.env.PATH = ["", "/usr/bin"].join(delimiter);
      const fs = installed();
      const asked = vi.spyOn(fs, "isExecutable");

      ToolchainDetector.detect(fs);

      expect(asked).toHaveBeenCalled();
      for (const call of asked.mock.calls) {
        expect(call[0]).toMatch(/^\/usr\/bin\//);
      }
    });

    it("finds nothing when PATH is unset", () => {
      delete process.env.PATH;

      expect(ToolchainDetector.detect(installed("/usr/bin/gcc"))).toBeNull();
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

    it("returns empty array when no include section found", () => {
      vi.mocked(spawnSync).mockReturnValue({
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

      const result = ToolchainDetector.detect(installed("/usr/bin/gcc"));

      expect(result!.version).toBe("gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0");
    });

    it("handles missing version gracefully", () => {
      whenRun(() => {
        throw new Error("version failed");
      });

      const result = ToolchainDetector.detect(installed("/usr/bin/gcc"));

      expect(result!.version).toBeUndefined();
    });
  });
});
