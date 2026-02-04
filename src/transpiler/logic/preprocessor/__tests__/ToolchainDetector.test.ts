/**
 * Unit tests for ToolchainDetector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ToolchainDetector from "../ToolchainDetector";

// Mock child_process
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Mock fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

describe("ToolchainDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detect", () => {
    it("returns null when no toolchain is available", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("not found");
      });

      const result = ToolchainDetector.detect();
      expect(result).toBeNull();
    });

    it("detects ARM toolchain with highest priority", () => {
      vi.mocked(execSync).mockImplementation((cmd: string) => {
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

      const result = ToolchainDetector.detect();

      expect(result).not.toBeNull();
      expect(result!.name).toBe("arm-none-eabi-gcc");
      expect(result!.cc).toBe("/usr/bin/arm-none-eabi-gcc");
      expect(result!.cxx).toBe("/usr/bin/arm-none-eabi-g++");
      expect(result!.isCrossCompiler).toBe(true);
      expect(result!.target).toBe("arm-none-eabi");
    });

    it("detects clang when ARM is not available", () => {
      vi.mocked(execSync).mockImplementation((cmd: string) => {
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

      const result = ToolchainDetector.detect();

      expect(result).not.toBeNull();
      expect(result!.name).toBe("clang");
      expect(result!.cc).toBe("/usr/bin/clang");
      expect(result!.cxx).toBe("/usr/bin/clang++");
      expect(result!.isCrossCompiler).toBe(false);
    });

    it("detects gcc when ARM and clang are not available", () => {
      vi.mocked(execSync).mockImplementation((cmd: string) => {
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

      const result = ToolchainDetector.detect();

      expect(result).not.toBeNull();
      expect(result!.name).toBe("gcc");
      expect(result!.cc).toBe("/usr/bin/gcc");
      expect(result!.cxx).toBe("/usr/bin/g++");
      expect(result!.isCrossCompiler).toBe(false);
    });

    it("uses cc for cxx when c++ compiler not found", () => {
      vi.mocked(execSync).mockImplementation((cmd: string) => {
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

      const result = ToolchainDetector.detect();

      expect(result!.cxx).toBe("/usr/bin/gcc");
    });

    it("returns null when executable path does not exist", () => {
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === "which gcc") {
          return "/usr/bin/gcc";
        }
        throw new Error("not found");
      });
      vi.mocked(existsSync).mockReturnValue(false);

      const result = ToolchainDetector.detect();
      expect(result).toBeNull();
    });
  });

  describe("detectAll", () => {
    it("returns empty array when no toolchains available", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("not found");
      });

      const result = ToolchainDetector.detectAll();
      expect(result).toEqual([]);
    });

    it("returns all available toolchains", () => {
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === "which arm-none-eabi-gcc") {
          return "/usr/bin/arm-none-eabi-gcc";
        }
        if (cmd === "which arm-none-eabi-g++") {
          return "/usr/bin/arm-none-eabi-g++";
        }
        if (cmd === "which clang") {
          return "/usr/bin/clang";
        }
        if (cmd === "which clang++") {
          return "/usr/bin/clang++";
        }
        if (cmd === "which gcc") {
          return "/usr/bin/gcc";
        }
        if (cmd === "which g++") {
          return "/usr/bin/g++";
        }
        if (cmd.includes("--version")) {
          return "version 1.0\n";
        }
        throw new Error("not found");
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = ToolchainDetector.detectAll();

      expect(result).toHaveLength(3);
      expect(result.map((t) => t.name)).toEqual([
        "arm-none-eabi-gcc",
        "clang",
        "gcc",
      ]);
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
      vi.mocked(execSync).mockReturnValue(compilerOutput);

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

    it("returns empty array when command fails", () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("command failed");
      });

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
      vi.mocked(execSync).mockReturnValue("Some other output\n");

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

  describe("getPlatformIOIncludePaths", () => {
    it("returns empty array when platformio.ini does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const paths = ToolchainDetector.getPlatformIOIncludePaths("/project");
      expect(paths).toEqual([]);
    });

    it("parses include paths from PlatformIO config", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue(
        JSON.stringify({
          env_esp32: {
            build_flags: ["-DDEBUG", "-I/path/to/include", "-I/another/path"],
          },
        }),
      );

      const paths = ToolchainDetector.getPlatformIOIncludePaths("/project");

      expect(paths).toEqual(["/path/to/include", "/another/path"]);
    });

    it("returns empty array when pio command fails", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("pio not found");
      });

      const paths = ToolchainDetector.getPlatformIOIncludePaths("/project");
      expect(paths).toEqual([]);
    });

    it("handles multiple environments", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue(
        JSON.stringify({
          env_esp32: {
            build_flags: ["-I/esp32/include"],
          },
          env_stm32: {
            build_flags: ["-I/stm32/include"],
          },
        }),
      );

      const paths = ToolchainDetector.getPlatformIOIncludePaths("/project");

      expect(paths).toContain("/esp32/include");
      expect(paths).toContain("/stm32/include");
    });

    it("handles environment without build_flags", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue(
        JSON.stringify({
          env_esp32: {
            platform: "espressif32",
          },
        }),
      );

      const paths = ToolchainDetector.getPlatformIOIncludePaths("/project");
      expect(paths).toEqual([]);
    });
  });

  describe("version extraction", () => {
    it("extracts version from first line of output", () => {
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === "which gcc") {
          return "/usr/bin/gcc";
        }
        if (cmd.includes("--version")) {
          return "gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0\nCopyright (C) 2021\nMore lines...\n";
        }
        throw new Error("not found");
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = ToolchainDetector.detect();

      expect(result!.version).toBe("gcc (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0");
    });

    it("handles missing version gracefully", () => {
      vi.mocked(execSync).mockImplementation((cmd: string) => {
        if (cmd === "which gcc") {
          return "/usr/bin/gcc";
        }
        if (cmd.includes("--version")) {
          throw new Error("version failed");
        }
        throw new Error("not found");
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = ToolchainDetector.detect();

      expect(result!.version).toBeUndefined();
    });
  });
});
