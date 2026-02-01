import { describe, it, expect, vi, beforeEach } from "vitest";

const dummyFilePath = "./temp_dummy.cnx";
const dummySource = "u32 main() { return 0; }";
const nestedFilePath = "src/subdir/nested.cnx";
const nestedSource = "void helper() { u32 x <- 42; }";
const rootFilePath = "src/root.cnx";
const rootSource = "u32 main() { return 0; }";
const deepNestedFilePath = "src/a/b/c/deep.cnx";
const deepNestedSource = "void deep() {}";

// Mock fs module - must be before any imports that use it
const readFileSyncMock = vi.fn((path: string) => {
  if (path === dummyFilePath) return dummySource;
  if (path === nestedFilePath) return nestedSource;
  if (path === rootFilePath) return rootSource;
  if (path === deepNestedFilePath) return deepNestedSource;
  throw new Error(`Unexpected read path ${path}`);
});
const writeFileSyncMock = vi.fn();
const mkdirSyncMock = vi.fn();
const existsSyncMock = vi.fn().mockReturnValue(false);

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) =>
      readFileSyncMock(args[0] as string),
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) =>
      writeFileSyncMock(...args),
    mkdirSync: (...args: Parameters<typeof actual.mkdirSync>) =>
      mkdirSyncMock(...args),
    existsSync: (...args: Parameters<typeof actual.existsSync>) =>
      existsSyncMock(args[0] as string),
  };
});

// Mock Pipeline class - transpileMock must be defined before vi.mock
const transpileMock = vi.fn();
vi.mock("../../pipeline/Pipeline", () => ({
  default: vi.fn().mockImplementation((config) => ({
    config,
    transpileSource: transpileMock,
    getSymbolTable: vi.fn().mockReturnValue({}),
  })),
}));

// Mock InputExpansion to bypass filesystem scanning
vi.mock("../../data/InputExpansion", () => ({
  default: {
    expandInputs: vi.fn().mockImplementation((inputs: string[]) => inputs),
  },
}));

import Project from "../Project";

describe("Project.compile", () => {
  beforeEach(() => {
    transpileMock.mockReset();
    writeFileSyncMock.mockReset();
  });

  it("writes output file when transpilation succeeds with code", async () => {
    const project = new Project({
      srcDirs: [],
      includeDirs: [],
      outDir: "./out",
      files: [dummyFilePath],
    });
    // Set up transpile mock for the Pipeline instance used in compile
    transpileMock.mockResolvedValue({
      success: true,
      code: "int main() {}",
    });
    const result = await (project as any).compile();

    expect(result.success).toBe(true);
    expect(result.filesProcessed).toBe(1);
    expect(result.outputFiles.length).toBe(1);
    const writtenPath = result.outputFiles[0];
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      writtenPath,
      "int main() {}",
      "utf-8",
    );
  });

  it("does not write output when transpilation fails", async () => {
    const project = new Project({
      srcDirs: [],
      includeDirs: [],
      outDir: "./out",
      files: [dummyFilePath],
    });
    // Set up transpile mock for the Pipeline instance used in compile
    transpileMock.mockResolvedValue({
      success: false,
      errors: ["error"],
    });
    const result = await (project as any).compile();

    expect(result.success).toBe(false);
    expect(result.filesProcessed).toBe(1);
    expect(result.outputFiles.length).toBe(0);
    expect(writeFileSyncMock).not.toHaveBeenCalled();
    expect(result.errors).toContain("error");
  });

  it("writes header file when headerCode is present", async () => {
    const project = new Project({
      srcDirs: [],
      includeDirs: [],
      outDir: "./out",
      files: [dummyFilePath],
    });
    transpileMock.mockResolvedValue({
      success: true,
      code: "int main() {}",
      headerCode: "#ifndef TEMP_DUMMY_H\n#define TEMP_DUMMY_H\n#endif",
    });
    await (project as any).compile();

    // Should write both .c and .h files
    expect(writeFileSyncMock).toHaveBeenCalledTimes(2);
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "out/temp_dummy.c",
      "int main() {}",
      "utf-8",
    );
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "out/temp_dummy.h",
      "#ifndef TEMP_DUMMY_H\n#define TEMP_DUMMY_H\n#endif",
      "utf-8",
    );
  });

  it("writes header to headerOutDir when specified", async () => {
    const project = new Project({
      srcDirs: [],
      includeDirs: [],
      outDir: "./out",
      headerOutDir: "./include",
      files: [dummyFilePath],
    });
    transpileMock.mockResolvedValue({
      success: true,
      code: "int main() {}",
      headerCode: "#ifndef TEMP_DUMMY_H\n#define TEMP_DUMMY_H\n#endif",
    });
    await (project as any).compile();

    // .c goes to outDir, .h goes to headerOutDir
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "out/temp_dummy.c",
      "int main() {}",
      "utf-8",
    );
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "include/temp_dummy.h",
      "#ifndef TEMP_DUMMY_H\n#define TEMP_DUMMY_H\n#endif",
      "utf-8",
    );
  });

  it("preserves subdirectory structure when compiling from srcDirs", async () => {
    // Mock InputExpansion to return nested file path
    const InputExpansion = await import("../../data/InputExpansion");
    vi.mocked(InputExpansion.default.expandInputs).mockReturnValueOnce([
      nestedFilePath,
    ]);

    const project = new Project({
      srcDirs: ["src"],
      includeDirs: [],
      outDir: "build",
      files: [],
    });

    transpileMock.mockResolvedValue({
      success: true,
      code: "void helper() { uint32_t x = 42; }",
    });

    const result = await (project as any).compile();

    expect(result.success).toBe(true);
    // Output should preserve subdirectory: build/subdir/nested.c, NOT build/nested.c
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "build/subdir/nested.c",
      "void helper() { uint32_t x = 42; }",
      "utf-8",
    );
    expect(result.outputFiles[0]).toBe("build/subdir/nested.c");
  });

  it("preserves subdirectory structure for headers with headerOutDir", async () => {
    // Mock InputExpansion to return nested file path
    const InputExpansion = await import("../../data/InputExpansion");
    vi.mocked(InputExpansion.default.expandInputs).mockReturnValueOnce([
      nestedFilePath,
    ]);

    const project = new Project({
      srcDirs: ["src"],
      includeDirs: [],
      outDir: "build",
      headerOutDir: "include",
      files: [],
    });

    transpileMock.mockResolvedValue({
      success: true,
      code: "void helper() { uint32_t x = 42; }",
      headerCode: "#ifndef NESTED_H\n#define NESTED_H\nvoid helper();\n#endif",
    });

    await (project as any).compile();

    // .c preserves subdir in outDir
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "build/subdir/nested.c",
      "void helper() { uint32_t x = 42; }",
      "utf-8",
    );
    // .h preserves subdir in headerOutDir
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "include/subdir/nested.h",
      "#ifndef NESTED_H\n#define NESTED_H\nvoid helper();\n#endif",
      "utf-8",
    );
  });

  it("outputs file directly in srcDir to outDir root (no extra subdirectory)", async () => {
    // Edge case: file directly in srcDir should NOT create empty subpath
    const InputExpansion = await import("../../data/InputExpansion");
    vi.mocked(InputExpansion.default.expandInputs).mockReturnValueOnce([
      rootFilePath,
    ]);

    const project = new Project({
      srcDirs: ["src"],
      includeDirs: [],
      outDir: "build",
      files: [],
    });

    transpileMock.mockResolvedValue({
      success: true,
      code: "int main() { return 0; }",
    });

    const result = await (project as any).compile();

    expect(result.success).toBe(true);
    // File directly in srcDir should output to build/root.c, NOT build//root.c
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "build/root.c",
      "int main() { return 0; }",
      "utf-8",
    );
    expect(result.outputFiles[0]).toBe("build/root.c");
  });

  it("handles deeply nested subdirectories", async () => {
    // Edge case: multiple levels of nesting (src/a/b/c/deep.cnx)
    const InputExpansion = await import("../../data/InputExpansion");
    vi.mocked(InputExpansion.default.expandInputs).mockReturnValueOnce([
      deepNestedFilePath,
    ]);

    const project = new Project({
      srcDirs: ["src"],
      includeDirs: [],
      outDir: "build",
      files: [],
    });

    transpileMock.mockResolvedValue({
      success: true,
      code: "void deep() {}",
    });

    const result = await (project as any).compile();

    expect(result.success).toBe(true);
    // Deep nesting should be preserved: build/a/b/c/deep.c
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "build/a/b/c/deep.c",
      "void deep() {}",
      "utf-8",
    );
    expect(result.outputFiles[0]).toBe("build/a/b/c/deep.c");
  });

  it("uses dirname when file is not in any srcDir (files-only mode)", async () => {
    // Edge case: no srcDirs, using files array - should use dirname(file) as base
    const InputExpansion = await import("../../data/InputExpansion");
    vi.mocked(InputExpansion.default.expandInputs).mockReturnValueOnce([
      dummyFilePath,
    ]);

    const project = new Project({
      srcDirs: [],
      includeDirs: [],
      outDir: "build",
      files: [dummyFilePath],
    });

    transpileMock.mockResolvedValue({
      success: true,
      code: "int main() {}",
    });

    const result = await (project as any).compile();

    expect(result.success).toBe(true);
    // File not in any srcDir should output to outDir directly
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "build/temp_dummy.c",
      "int main() {}",
      "utf-8",
    );
  });

  it("handles mixed srcDirs and nested files", async () => {
    // Edge case: both root-level and nested files in same compile
    const InputExpansion = await import("../../data/InputExpansion");
    vi.mocked(InputExpansion.default.expandInputs).mockReturnValueOnce([
      rootFilePath,
      nestedFilePath,
    ]);

    const project = new Project({
      srcDirs: ["src"],
      includeDirs: [],
      outDir: "build",
      files: [],
    });

    transpileMock
      .mockResolvedValueOnce({
        success: true,
        code: "int main() { return 0; }",
      })
      .mockResolvedValueOnce({
        success: true,
        code: "void helper() { uint32_t x = 42; }",
      });

    const result = await (project as any).compile();

    expect(result.success).toBe(true);
    expect(result.filesProcessed).toBe(2);
    // Root file goes to build/root.c
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "build/root.c",
      "int main() { return 0; }",
      "utf-8",
    );
    // Nested file goes to build/subdir/nested.c
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      "build/subdir/nested.c",
      "void helper() { uint32_t x = 42; }",
      "utf-8",
    );
  });
});
