/**
 * Unit tests for Preprocessor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import IToolchain from "../types/IToolchain";
import ISourceMapping from "../types/ISourceMapping";

// We need to define our mock functions before vi.mock calls
const mockExec = vi.fn();
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockMkdtemp = vi.fn().mockResolvedValue("/tmp/cnext-abc123");
const mockRm = vi.fn().mockResolvedValue(undefined);
const mockDetect = vi.fn().mockReturnValue(null);
const mockGetDefaultIncludePaths = vi.fn().mockReturnValue([]);

// Type for exec callback
type ExecCallback = (
  err: Error | null,
  result: { stdout: string; stderr: string },
) => void;

// Mock child_process - exec is promisified, so we mock it to work with promisify
vi.mock("node:child_process", () => ({
  exec: (cmd: string, opts: unknown, cb?: ExecCallback) => {
    // promisify converts callback-based to promise-based
    // We handle both forms (2-arg and 3-arg)
    let callback: ExecCallback | undefined = cb;
    if (typeof opts === "function") {
      callback = opts as ExecCallback;
    }
    const result = mockExec(cmd, opts);
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

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdtemp: (...args: unknown[]) => mockMkdtemp(...args),
  rm: (...args: unknown[]) => mockRm(...args),
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
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdtemp.mockResolvedValue("/tmp/cnext-abc123");
    mockRm.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("uses provided toolchain", () => {
      const preprocessor = new Preprocessor(mockToolchain);

      expect(preprocessor.isAvailable()).toBe(true);
      expect(preprocessor.getToolchain()).toEqual(mockToolchain);
    });

    it("uses ToolchainDetector when no toolchain provided", () => {
      mockDetect.mockReturnValue(mockToolchain);
      mockGetDefaultIncludePaths.mockReturnValue(["/usr/include"]);

      const preprocessor = new Preprocessor();

      expect(mockDetect).toHaveBeenCalled();
      expect(mockGetDefaultIncludePaths).toHaveBeenCalledWith(mockToolchain);
      expect(preprocessor.isAvailable()).toBe(true);
    });

    it("handles no available toolchain", () => {
      mockDetect.mockReturnValue(null);

      const preprocessor = new Preprocessor();

      expect(preprocessor.isAvailable()).toBe(false);
      expect(preprocessor.getToolchain()).toBeNull();
    });
  });

  describe("isAvailable", () => {
    it("returns true when toolchain is set", () => {
      const preprocessor = new Preprocessor(mockToolchain);
      expect(preprocessor.isAvailable()).toBe(true);
    });

    it("returns false when no toolchain", () => {
      mockDetect.mockReturnValue(null);
      const preprocessor = new Preprocessor();
      expect(preprocessor.isAvailable()).toBe(false);
    });
  });

  describe("getToolchain", () => {
    it("returns the toolchain", () => {
      const preprocessor = new Preprocessor(mockToolchain);
      expect(preprocessor.getToolchain()).toEqual(mockToolchain);
    });

    it("returns null when no toolchain", () => {
      mockDetect.mockReturnValue(null);
      const preprocessor = new Preprocessor();
      expect(preprocessor.getToolchain()).toBeNull();
    });
  });

  describe("preprocess", () => {
    it("returns error when no toolchain available", async () => {
      mockDetect.mockReturnValue(null);
      const preprocessor = new Preprocessor();

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

      const preprocessor = new Preprocessor(mockToolchain);
      await preprocessor.preprocess("/path/to/file.h");

      expect(mockExec).toHaveBeenCalled();
      const command = mockExec.mock.calls[0][0];
      expect(command).toContain("/usr/bin/gcc");
      expect(command).toContain("-E");
      expect(command).toContain("/path/to/file.h");
      expect(command).toContain("-I/path/to");
    });

    it("includes custom include paths", async () => {
      mockExec.mockReturnValue({
        stdout: "content",
        stderr: "",
      });

      const preprocessor = new Preprocessor(mockToolchain);
      await preprocessor.preprocess("/path/to/file.h", {
        includePaths: ["/custom/include", "/another/path"],
      });

      const command = mockExec.mock.calls[0][0];
      expect(command).toContain("-I/custom/include");
      expect(command).toContain("-I/another/path");
    });

    it("includes defines", async () => {
      mockExec.mockReturnValue({
        stdout: "content",
        stderr: "",
      });

      const preprocessor = new Preprocessor(mockToolchain);
      await preprocessor.preprocess("/path/to/file.h", {
        defines: {
          DEBUG: true,
          VERSION: "1.0",
          DISABLED: false,
        },
      });

      const command = mockExec.mock.calls[0][0];
      expect(command).toContain("-DDEBUG");
      expect(command).toContain("-DVERSION=1.0");
      expect(command).not.toContain("-DDISABLED");
    });

    it("returns success result with content", async () => {
      mockExec.mockReturnValue({
        stdout: "int x = 5;\n",
        stderr: "",
      });

      const preprocessor = new Preprocessor(mockToolchain);
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

      const preprocessor = new Preprocessor(mockToolchain);
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

      const preprocessor = new Preprocessor(mockToolchain);
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

      const preprocessor = new Preprocessor(mockToolchain);
      await preprocessor.preprocess("/path/to/file.h", {
        keepLineDirectives: false,
      });

      const command = mockExec.mock.calls[0][0];
      expect(command).toContain("-P");
    });

    it("handles preprocessor errors", async () => {
      const error = new Error("compilation error");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).stderr = "file.h:5: error: unknown type";
      mockExec.mockReturnValue(Promise.reject(error));

      const preprocessor = new Preprocessor(mockToolchain);
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

      const preprocessor = new Preprocessor(mockToolchain);
      const result = await preprocessor.preprocess("/path/to/file.h");

      expect(result.success).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Preprocessor warnings"),
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("preprocessString", () => {
    it("creates temp file and preprocesses", async () => {
      mockExec.mockReturnValue({
        stdout: "processed",
        stderr: "",
      });

      const preprocessor = new Preprocessor(mockToolchain);
      const result = await preprocessor.preprocessString(
        "#define FOO 1\nint x = FOO;",
        "test.h",
      );

      expect(mockMkdtemp).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalledWith(
        "/tmp/cnext-abc123/test.h",
        "#define FOO 1\nint x = FOO;",
        "utf-8",
      );
      expect(result.originalFile).toBe("test.h");
    });

    it("cleans up temp directory after success", async () => {
      mockExec.mockReturnValue({
        stdout: "processed",
        stderr: "",
      });

      const preprocessor = new Preprocessor(mockToolchain);
      await preprocessor.preprocessString("content", "test.h");

      expect(mockRm).toHaveBeenCalledWith("/tmp/cnext-abc123", {
        recursive: true,
      });
    });

    it("cleans up temp directory after failure", async () => {
      mockExec.mockReturnValue(Promise.reject(new Error("failed")));

      const preprocessor = new Preprocessor(mockToolchain);
      await preprocessor.preprocessString("content", "test.h");

      expect(mockRm).toHaveBeenCalledWith("/tmp/cnext-abc123", {
        recursive: true,
      });
    });

    it("ignores cleanup errors", async () => {
      mockExec.mockReturnValue({
        stdout: "processed",
        stderr: "",
      });
      mockRm.mockRejectedValue(new Error("cleanup failed"));

      const preprocessor = new Preprocessor(mockToolchain);

      // Should not throw
      const result = await preprocessor.preprocessString("content", "test.h");
      expect(result.success).toBe(true);
    });
  });

  describe("mapToOriginal (static)", () => {
    it("returns null for empty mappings", () => {
      const result = Preprocessor.mapToOriginal([], 5);
      expect(result).toBeNull();
    });

    it("returns null when no mapping before target line", () => {
      const mappings: ISourceMapping[] = [
        { preprocessedLine: 10, originalFile: "test.h", originalLine: 1 },
      ];

      const result = Preprocessor.mapToOriginal(mappings, 5);
      expect(result).toBeNull();
    });

    it("maps exact line match", () => {
      const mappings: ISourceMapping[] = [
        { preprocessedLine: 5, originalFile: "test.h", originalLine: 10 },
      ];

      const result = Preprocessor.mapToOriginal(mappings, 5);

      expect(result).toEqual({ file: "test.h", line: 10 });
    });

    it("calculates offset from nearest mapping", () => {
      const mappings: ISourceMapping[] = [
        { preprocessedLine: 5, originalFile: "test.h", originalLine: 10 },
      ];

      const result = Preprocessor.mapToOriginal(mappings, 8);

      expect(result).toEqual({ file: "test.h", line: 13 });
    });

    it("finds closest previous mapping", () => {
      const mappings: ISourceMapping[] = [
        { preprocessedLine: 1, originalFile: "a.h", originalLine: 1 },
        { preprocessedLine: 10, originalFile: "b.h", originalLine: 50 },
        { preprocessedLine: 20, originalFile: "c.h", originalLine: 100 },
      ];

      const result = Preprocessor.mapToOriginal(mappings, 15);

      expect(result).toEqual({ file: "b.h", line: 55 });
    });

    it("handles unsorted mappings", () => {
      const mappings: ISourceMapping[] = [
        { preprocessedLine: 20, originalFile: "c.h", originalLine: 100 },
        { preprocessedLine: 1, originalFile: "a.h", originalLine: 1 },
        { preprocessedLine: 10, originalFile: "b.h", originalLine: 50 },
      ];

      const result = Preprocessor.mapToOriginal(mappings, 15);

      expect(result).toEqual({ file: "b.h", line: 55 });
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

      const preprocessor = new Preprocessor(mockToolchain);
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

      const preprocessor = new Preprocessor(mockToolchain);
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

      const preprocessor = new Preprocessor(mockToolchain);
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

      const preprocessor = new Preprocessor(mockToolchain);
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
