/**
 * Unit tests for Preprocessor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type IFileSystem from "../../../../../../cnx/types/IFileSystem";
import Installation from "../../../../../../cnx/PARSE/1-Discover/Installation";
import IToolchain from "../../../../../../cnx/PARSE/2-Parse/preprocessor/types/IToolchain";

// We need to define our mock functions before vi.mock calls
const mockExec = vi.fn();
const mockDetect = vi.fn().mockReturnValue(null);
const mockGetDefaultIncludePaths = vi.fn().mockReturnValue([]);

// #1991: execFile is called as (file, args, options, callback) with the
// callback's (error, stdout, stderr), and returns the child, whose stdin
// receives a string's content.
const mockStdin = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (
    file: string,
    args: string[],
    opts: unknown,
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    const result = mockExec(file, args, opts);
    Promise.resolve(result)
      .then((r: { stdout: string; stderr: string } | Error | undefined) => {
        if (r instanceof Error) cb(r, "", "");
        else cb(null, r?.stdout ?? "", r?.stderr ?? "");
      })
      .catch((e: Error) => cb(e, "", ""));
    return { stdin: { end: (content: string) => mockStdin(content) } };
  },
}));

// Mock ToolchainDetector
vi.mock(
  "../../../../../../cnx/PARSE/2-Parse/preprocessor/ToolchainDetector",
  () => ({
    default: {
      detect: () => mockDetect(),
      getDefaultIncludePaths: (t: IToolchain) => mockGetDefaultIncludePaths(t),
    },
  }),
);

// Import after mocks are set up
import Preprocessor from "../../../../../../cnx/PARSE/2-Parse/preprocessor/Preprocessor";
import NodeFileSystem from "../../../../../../cnx/PARSE/1-Discover/NodeFileSystem";
import MockFileSystem from "../../../../MockFileSystem";

/** #1713: what the host gives each run */
function settingsFor(fs: IFileSystem): {
  readonly headerFreeDirectory: string;
  readonly cache: null;
} {
  return {
    headerFreeDirectory: Installation.headerFreeDirectory(fs),
    cache: null,
  };
}

describe("Preprocessor", () => {
  const mockToolchain: IToolchain = {
    name: "gcc",
    cc: "/usr/bin/gcc",
    cxx: "/usr/bin/g++",
    cpp: "/usr/bin/gcc",
    version: "11.4.0",
    isCrossCompiler: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDetect.mockReturnValue(null);
    mockGetDefaultIncludePaths.mockReturnValue([]);
    mockExec.mockReturnValue({ stdout: "", stderr: "" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("uses provided toolchain", () => {
      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );

      expect(preprocessor.isAvailable()).toBe(true);
    });

    it("handles no available toolchain", () => {
      mockDetect.mockReturnValue(null);

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        null,
        settingsFor(NodeFileSystem.instance),
      );

      expect(preprocessor.isAvailable()).toBe(false);
    });
  });

  describe("isAvailable", () => {
    it("returns true when toolchain is set", () => {
      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      expect(preprocessor.isAvailable()).toBe(true);
    });

    it("returns false when no toolchain", () => {
      mockDetect.mockReturnValue(null);
      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        null,
        settingsFor(NodeFileSystem.instance),
      );
      expect(preprocessor.isAvailable()).toBe(false);
    });
  });

  describe("preprocess", () => {
    it("returns error when no toolchain available", async () => {
      mockDetect.mockReturnValue(null);
      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        null,
        settingsFor(NodeFileSystem.instance),
      );

      const result = await preprocessor.preprocess("/path/to/file.h");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No C/C++ toolchain available");
      expect(result.content).toBe("");
      expect(result.sourceMappings).toEqual([]);
      expect(result.originalFile).toBe("/path/to/file.h");
    });

    it("calls preprocessor with correct arguments", async () => {
      mockExec.mockReturnValue({
        stdout: "preprocessed content",
        stderr: "",
      });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      await preprocessor.preprocess("/path/to/file.h");

      expect(mockExec).toHaveBeenCalled();
      const file = mockExec.mock.calls[0][0];
      const args = mockExec.mock.calls[0][1];
      expect(file).toBe("/usr/bin/gcc");
      expect(args).toContain("-E");
      expect(args).toContain("/path/to/file.h");
      expect(args).toContain("-I/path/to");
    });

    it("includes custom include paths", async () => {
      mockExec.mockReturnValue({
        stdout: "content",
        stderr: "",
      });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      await preprocessor.preprocess("/path/to/file.h", {
        includePaths: ["/custom/include", "/another/path"],
      });

      const args = mockExec.mock.calls[0][1];
      expect(args).toContain("-I/custom/include");
      expect(args).toContain("-I/another/path");
    });

    it("includes defines", async () => {
      mockExec.mockReturnValue({
        stdout: "content",
        stderr: "",
      });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      await preprocessor.preprocess("/path/to/file.h", {
        defines: {
          DEBUG: true,
          VERSION: "1.0",
          DISABLED: false,
        },
      });

      const args = mockExec.mock.calls[0][1];
      expect(args).toContain("-DDEBUG");
      expect(args).toContain("-DVERSION=1.0");
      expect(args).not.toContain("-DDISABLED");
    });

    it("passes defines with shell metacharacters as a single argv element", async () => {
      mockExec.mockReturnValue({ stdout: "content", stderr: "" });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      // A board-name macro whose value contains spaces and parentheses — valid
      // for the compiler, but would break /bin/sh if the command were routed
      // through a shell (Issue: cnx preprocessor must invoke via argv).
      await preprocessor.preprocess("/path/to/file.h", {
        defines: {
          ARDUINO_BOARD: '"Espressif ESP32-S3 (8 MB QD, No PSRAM)"',
        },
      });

      const args = mockExec.mock.calls[0][1];
      expect(args).toContain(
        '-DARDUINO_BOARD="Espressif ESP32-S3 (8 MB QD, No PSRAM)"',
      );
    });

    it("returns success result with content", async () => {
      mockExec.mockReturnValue({
        stdout: "int x = 5;\n",
        stderr: "",
      });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      const result = await preprocessor.preprocess("/path/to/file.h");

      expect(result.success).toBe(true);
      expect(result.content).toBe("int x = 5;\n");
      expect(result.originalFile).toBe("/path/to/file.h");
      expect(result.toolchain).toBe("gcc");
    });

    it("parses line directives for source mappings", async () => {
      const preprocessedContent = `# 1 "test.h"
# 1 "<built-in>"
# 1 "<command-line>"
# 1 "test.h"
int x = 5;
# 10 "other.h"
int y = 10;
`;
      mockExec.mockReturnValue({
        stdout: preprocessedContent,
        stderr: "",
      });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      const result = await preprocessor.preprocess("/path/to/test.h");

      expect(result.success).toBe(true);
      expect(result.sourceMappings.length).toBeGreaterThan(0);

      // Find mapping for test.h
      const testMapping = result.sourceMappings.find(
        (m) => m.originalFile === "test.h" && m.originalLine === 1,
      );
      expect(testMapping).toBeDefined();
    });

    it("strips line directives when keepLineDirectives is false", async () => {
      const preprocessedContent = `# 1 "test.h"
int x = 5;
# 10 "other.h"
int y = 10;
`;
      mockExec.mockReturnValue({
        stdout: preprocessedContent,
        stderr: "",
      });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      const result = await preprocessor.preprocess("/path/to/test.h", {
        keepLineDirectives: false,
      });

      expect(result.content).not.toContain("# 1");
      expect(result.content).not.toContain("# 10");
      expect(result.content).toContain("int x = 5;");
      expect(result.content).toContain("int y = 10;");
      expect(result.sourceMappings).toEqual([]);
    });

    it("uses -P flag when keepLineDirectives is false", async () => {
      mockExec.mockReturnValue({
        stdout: "content",
        stderr: "",
      });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      await preprocessor.preprocess("/path/to/file.h", {
        keepLineDirectives: false,
      });

      const args = mockExec.mock.calls[0][1];
      expect(args).toContain("-P");
    });

    it("handles preprocessor errors", async () => {
      const error = new Error("compilation error");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).stderr = "file.h:5: error: unknown type";
      mockExec.mockReturnValue(Promise.reject(error));

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      const result = await preprocessor.preprocess("/path/to/file.h");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Preprocessor failed");
    });

    it("logs warnings to console but succeeds", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      mockExec.mockReturnValue({
        stdout: "int x = 5;\n",
        stderr: "warning: implicit declaration\n",
      });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      const result = await preprocessor.preprocess("/path/to/file.h");

      expect(result.success).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Preprocessor warnings"),
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("preprocessString", () => {
    // #1991: 1.1 creates no file. The string goes to cpp on standard input,
    // from a directory that holds no header: on stdin cpp searches its
    // working directory first for a quoted include (#1653).
    it("hands cpp the content on stdin, from a directory with no header", async () => {
      const fs = new MockFileSystem();
      const seen: { args: string[]; cwd: unknown }[] = [];
      mockExec.mockImplementation(
        (_file: string, args: string[], opts: { cwd?: string }) => {
          seen.push({ args, cwd: opts.cwd });
          return { stdout: "processed", stderr: "" };
        },
      );
      const preprocessor = new Preprocessor(fs, mockToolchain, settingsFor(fs));

      const result = await preprocessor.preprocessString(
        "#define FOO 1\nint x = FOO;",
        "test.h",
      );

      expect(seen).toHaveLength(1);
      expect(seen[0].args.slice(-3)).toEqual(["-x", "c-header", "-"]);
      expect(seen[0].cwd).toBe(Installation.headerFreeDirectory(fs));
      expect(mockStdin).toHaveBeenLastCalledWith("#define FOO 1\nint x = FOO;");
      expect(fs.getWriteLog()).toEqual([]);
      expect(fs.getMkdirLog()).toEqual([]);
      expect(result.success).toBe(true);
      expect(result.originalFile).toBe("test.h");
    });

    it("names a C++ header's language", async () => {
      const seen: string[][] = [];
      mockExec.mockImplementation((_file: string, args: string[]) => {
        seen.push(args);
        return { stdout: "", stderr: "" };
      });
      const preprocessor = new Preprocessor(
        new MockFileSystem(),
        mockToolchain,
        settingsFor(new MockFileSystem()),
      );

      await preprocessor.preprocessString("int x;", "cnx-include.hpp");

      expect(seen[0].slice(-3)).toEqual(["-x", "c++-header", "-"]);
    });

    it("fails a string whose extension names no language, without running cpp", async () => {
      const preprocessor = new Preprocessor(
        new MockFileSystem(),
        mockToolchain,
        settingsFor(new MockFileSystem()),
      );

      const result = await preprocessor.preprocessString("int x;", "test.txt");

      expect(result.success).toBe(false);
      expect(mockExec).not.toHaveBeenCalled();
    });
  });

  describe("line directive parsing", () => {
    it("parses standard # linenum format", async () => {
      const content = `# 1 "test.h"
int x;
# 5 "other.h"
int y;
`;
      mockExec.mockReturnValue({
        stdout: content,
        stderr: "",
      });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      const result = await preprocessor.preprocess("/test.h");

      expect(result.sourceMappings).toContainEqual({
        preprocessedLine: 2,
        originalFile: "test.h",
        originalLine: 1,
      });
    });

    it("parses #line linenum format", async () => {
      const content = `#line 10 "test.h"
int x;
`;
      mockExec.mockReturnValue({
        stdout: content,
        stderr: "",
      });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      const result = await preprocessor.preprocess("/test.h");

      expect(result.sourceMappings).toContainEqual({
        preprocessedLine: 2,
        originalFile: "test.h",
        originalLine: 10,
      });
    });

    it("handles flags after filename", async () => {
      const content = `# 1 "test.h" 1 2
int x;
`;
      mockExec.mockReturnValue({
        stdout: content,
        stderr: "",
      });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      const result = await preprocessor.preprocess("/test.h");

      expect(result.sourceMappings).toContainEqual({
        preprocessedLine: 2,
        originalFile: "test.h",
        originalLine: 1,
      });
    });

    it("tracks line numbers across multiple directives", async () => {
      const content = `# 1 "test.h"
line1
line2
# 10 "other.h"
line10
`;
      mockExec.mockReturnValue({
        stdout: content,
        stderr: "",
      });

      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
        settingsFor(NodeFileSystem.instance),
      );
      const result = await preprocessor.preprocess("/test.h");

      // Line numbers increment after each content line
      const line1Mapping = result.sourceMappings.find(
        (m) => m.preprocessedLine === 2,
      );
      const line2Mapping = result.sourceMappings.find(
        (m) => m.preprocessedLine === 3,
      );

      expect(line1Mapping?.originalLine).toBe(1);
      expect(line2Mapping?.originalLine).toBe(2);
    });
  });
});
