/**
 * Unit tests for ToolchainDetector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ToolchainDetector from "../ToolchainDetector";

// Mock child_process
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  spawnSync: vi.fn(),
}));

// Mock fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import NodeFileSystem from "../../NodeFileSystem";

/**
 * Answer the mocked `execFileSync` by the command it would run, written as one
 * string (`which gcc`, `/usr/bin/gcc --version`) so a case reads as the
 * invocation it stubs.
 */
function whenRun(answer: (command: string) => string): void {
  vi.mocked(execFileSync).mockImplementation(((
    file: string,
    args?: readonly string[],
  ) => answer([file, ...(args ?? [])].join(" "))) as typeof execFileSync);
}

describe("ToolchainDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detect", () => {
    it("returns null when no toolchain is available", () => {
      whenRun(() => {
        throw new Error("not found");
      });

      const result = ToolchainDetector.detect(NodeFileSystem.instance);
      expect(result).toBeNull();
    });

    it("detects ARM toolchain with highest priority", () => {
      whenRun((cmd) => {
        if (cmd === "which arm-none-eabi-gcc") {
          return "/usr/bin/arm-none-eabi-gcc";
        }
        if (cmd === "which arm-none-eabi-g++") {
          return "/usr/bin/arm-none-eabi-g++";
        }
        if (cmd.includes("--version")) {
          return "arm-none-eabi-gcc (GNU Arm) 10.3.1\n";
        }
        throw new Error("not found");
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = ToolchainDetector.detect(NodeFileSystem.instance);

      expect(result).not.toBeNull();
      expect(result!.name).toBe("arm-none-eabi-gcc");
      expect(result!.cc).toBe("/usr/bin/arm-none-eabi-gcc");
      expect(result!.cxx).toBe("/usr/bin/arm-none-eabi-g++");
      expect(result!.isCrossCompiler).toBe(true);
      expect(result!.target).toBe("arm-none-eabi");
    });

    it("detects clang when ARM is not available", () => {
      whenRun((cmd) => {
        if (cmd.includes("arm-none-eabi")) {
          throw new Error("not found");
        }
        if (cmd === "which clang") {
          return "/usr/bin/clang";
        }
        if (cmd === "which clang++") {
          return "/usr/bin/clang++";
        }
        if (cmd.includes("--version")) {
          return "clang version 14.0.0\n";
        }
        throw new Error("not found");
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = ToolchainDetector.detect(NodeFileSystem.instance);

      expect(result).not.toBeNull();
      expect(result!.name).toBe("clang");
      expect(result!.cc).toBe("/usr/bin/clang");
      expect(result!.cxx).toBe("/usr/bin/clang++");
      expect(result!.isCrossCompiler).toBe(false);
    });

    it("detects gcc when ARM and clang are not available", () => {
      whenRun((cmd) => {
        if (cmd.includes("arm-none-eabi") || cmd.includes("clang")) {
          throw new Error("not found");
        }
        if (cmd === "which gcc") {
          return "/usr/bin/gcc";
        }
        if (cmd === "which g++") {
          return "/usr/bin/g++";
        }
        if (cmd.includes("--version")) {
          return "gcc (Ubuntu 11.4.0) 11.4.0\n";
        }
        throw new Error("not found");
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = ToolchainDetector.detect(NodeFileSystem.instance);

      expect(result).not.toBeNull();
      expect(result!.name).toBe("gcc");
      expect(result!.cc).toBe("/usr/bin/gcc");
      expect(result!.cxx).toBe("/usr/bin/g++");
      expect(result!.isCrossCompiler).toBe(false);
    });

    it("uses cc for cxx when c++ compiler not found", () => {
      whenRun((cmd) => {
        if (cmd.includes("arm-none-eabi") || cmd.includes("clang")) {
          throw new Error("not found");
        }
        if (cmd === "which gcc") {
          return "/usr/bin/gcc";
        }
        if (cmd === "which g++") {
          throw new Error("not found");
        }
        if (cmd.includes("--version")) {
          return "gcc 11.4.0\n";
        }
        throw new Error("not found");
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = ToolchainDetector.detect(NodeFileSystem.instance);

      expect(result!.cxx).toBe("/usr/bin/gcc");
    });

    it("returns null when executable path does not exist", () => {
      whenRun((cmd) => {
        if (cmd === "which gcc") {
          return "/usr/bin/gcc";
        }
        throw new Error("not found");
      });
      vi.mocked(existsSync).mockReturnValue(false);

      const result = ToolchainDetector.detect(NodeFileSystem.instance);
      expect(result).toBeNull();
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
        if (cmd === "which gcc") {
          return "/usr/bin/gcc";
        }
        if (cmd.includes("--version")) {
          return "gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0\nCopyright (C) 2021\nMore lines...\n";
        }
        throw new Error("not found");
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = ToolchainDetector.detect(NodeFileSystem.instance);

      expect(result!.version).toBe("gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0");
    });

    it("handles missing version gracefully", () => {
      whenRun((cmd) => {
        if (cmd === "which gcc") {
          return "/usr/bin/gcc";
        }
        if (cmd.includes("--version")) {
          throw new Error("version failed");
        }
        throw new Error("not found");
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = ToolchainDetector.detect(NodeFileSystem.instance);

      expect(result!.version).toBeUndefined();
    });
  });
});
