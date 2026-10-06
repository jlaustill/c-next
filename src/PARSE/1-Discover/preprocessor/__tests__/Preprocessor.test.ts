/**
 * Unit tests for Preprocessor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import IToolchain from "../types/IToolchain";

// We need to define our mock functions before vi.mock calls
const mockExec = vi.fn();
const mockDetect = vi.fn().mockReturnValue(null);
const mockGetDefaultIncludePaths = vi.fn().mockReturnValue([]);

// Type for exec callback
type ExecCallback = (
  err: Error | null,
  result: { stdout: string; stderr: string },
) => void;

// Mock child_process - execFile is promisified, so we mock it to work with
// promisify. execFile is called as (file, args, options, callback).
vi.mock("node:child_process", () => ({
  execFile: (
    file: string,
    args: string[],
    opts: unknown,
    cb?: ExecCallback,
  ) => {
    // promisify converts callback-based to promise-based
    let callback: ExecCallback | undefined = cb;
    if (typeof opts === "function") {
      callback = opts as ExecCallback;
    }
    const result = mockExec(file, args, opts);
    if (result instanceof Promise) {
      result
        .then((r: { stdout: string; stderr: string }) => callback?.(null, r))
        .catch((e: Error) => callback?.(e, { stdout: "", stderr: "" }));
    } else if (result && typeof result.then === "function") {
      result
        .then((r: { stdout: string; stderr: string }) => callback?.(null, r))
        .catch((e: Error) => callback?.(e, { stdout: "", stderr: "" }));
    } else {
      // Immediate value
      if (result instanceof Error) {
        callback?.(result, { stdout: "", stderr: "" });
      } else {
        callback?.(null, result || { stdout: "", stderr: "" });
      }
    }
  },
}));

// Mock ToolchainDetector
vi.mock("../ToolchainDetector", () => ({
  default: {
    detect: () => mockDetect(),
    getDefaultIncludePaths: (t: IToolchain) => mockGetDefaultIncludePaths(t),
  },
}));

// Import after mocks are set up
import Preprocessor from "../Preprocessor";
import NodeFileSystem from "../../NodeFileSystem";
import MockFileSystem from "../../../../transpiler/__tests__/MockFileSystem";
import { basename, dirname } from "node:path";

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
      );

      expect(preprocessor.isAvailable()).toBe(true);
    });

    it("uses ToolchainDetector when no toolchain provided", () => {
      mockDetect.mockReturnValue(mockToolchain);
      mockGetDefaultIncludePaths.mockReturnValue(["/usr/include"]);

      const preprocessor = new Preprocessor(NodeFileSystem.instance);

      expect(mockDetect).toHaveBeenCalled();
      expect(mockGetDefaultIncludePaths).toHaveBeenCalledWith(mockToolchain);
      expect(preprocessor.isAvailable()).toBe(true);
    });

    it("handles no available toolchain", () => {
      mockDetect.mockReturnValue(null);

      const preprocessor = new Preprocessor(NodeFileSystem.instance);

      expect(preprocessor.isAvailable()).toBe(false);
    });
  });

  describe("isAvailable", () => {
    it("returns true when toolchain is set", () => {
      const preprocessor = new Preprocessor(
        NodeFileSystem.instance,
        mockToolchain,
      );
      expect(preprocessor.isAvailable()).toBe(true);
    });

    it("returns false when no toolchain", () => {
      mockDetect.mockReturnValue(null);
      const preprocessor = new Preprocessor(NodeFileSystem.instance);
      expect(preprocessor.isAvailable()).toBe(false);
    });
  });

  describe("preprocess", () => {
    it("returns error when no toolchain available", async () => {
      mockDetect.mockReturnValue(null);
      const preprocessor = new Preprocessor(NodeFileSystem.instance);

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
      );
      // A board-name macro whose value contains spaces and parentheses — valid
      // for the compiler, but would break /bin/sh if the command were routed
      // through a shell (Issue: cnext preprocessor must invoke via argv).
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
    // #1653: the temporary file is the port's, so these use a MockFileSystem
    // and look at what cpp is handed rather than at node:fs calls.
    function handedToCpp(fs: MockFileSystem) {
      const seen: { input: string; content: string; neighbors: string[] }[] =
        [];
      mockExec.mockImplementation((_file: string, args: string[]) => {
        const input = args.at(-1) ?? "";
        seen.push({
          input,
          content: fs.readFile(input),
          neighbors: fs.readdir(dirname(input)),
        });
        return { stdout: "processed", stderr: "" };
      });
      return seen;
    }

    it("hands cpp a file holding the content, alone in its directory", async () => {
      const fs = new MockFileSystem();
      const seen = handedToCpp(fs);
      const preprocessor = new Preprocessor(fs, mockToolchain);

      const result = await preprocessor.preprocessString(
        "#define FOO 1\nint x = FOO;",
        "test.h",
      );

      expect(seen).toHaveLength(1);
      expect(basename(seen[0].input)).toBe("test.h");
      expect(seen[0].content).toBe("#define FOO 1\nint x = FOO;");
      // Nothing else in the directory: cpp searches it first for a quoted
      // include, and on stdin it would search the working directory instead.
      expect(seen[0].neighbors).toEqual(["test.h"]);
      expect(result.originalFile).toBe("test.h");
    });

    it("removes the temporary directory after success", async () => {
      const fs = new MockFileSystem();
      const seen = handedToCpp(fs);
      const preprocessor = new Preprocessor(fs, mockToolchain);

      await preprocessor.preprocessString("content", "test.h");

      expect(fs.exists(dirname(seen[0].input))).toBe(false);
    });

    it("removes the temporary directory after failure", async () => {
      const fs = new MockFileSystem();
      let input = "";
      mockExec.mockImplementation((_file: string, args: string[]) => {
        input = args.at(-1) ?? "";
        return Promise.reject(new Error("failed"));
      });
      const preprocessor = new Preprocessor(fs, mockToolchain);

      const result = await preprocessor.preprocessString("content", "test.h");

      expect(result.success).toBe(false);
      expect(input).not.toBe("");
      expect(fs.exists(dirname(input))).toBe(false);
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
