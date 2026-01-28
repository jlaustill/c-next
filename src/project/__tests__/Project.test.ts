import { describe, it, expect, vi, beforeEach } from "vitest";

const dummyFilePath = "./temp_dummy.cnx";
const dummySource = "u32 main() { return 0; }";

// Mock fs module - must be before any imports that use it
const readFileSyncMock = vi.fn((path: string) => {
  if (path === dummyFilePath) return dummySource;
  throw new Error(`Unexpected read path ${path}`);
});
const writeFileSyncMock = vi.fn();

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) =>
      readFileSyncMock(args[0] as string),
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) =>
      writeFileSyncMock(...args),
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
vi.mock("../../lib/InputExpansion", () => ({
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
});
