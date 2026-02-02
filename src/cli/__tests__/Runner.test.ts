/**
 * Unit tests for Runner
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Runner from "../Runner";
import InputExpansion from "../../transpiler/data/InputExpansion";
import Transpiler from "../../transpiler/Transpiler";
import ResultPrinter from "../ResultPrinter";
import ICliConfig from "../types/ICliConfig";
import * as fs from "node:fs";

// Mock dependencies
vi.mock("../../transpiler/data/InputExpansion");
vi.mock("../../transpiler/Transpiler");
vi.mock("../ResultPrinter");
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    statSync: vi.fn(),
    renameSync: vi.fn(),
  };
});

describe("Runner", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;
  let mockConfig: ICliConfig;
  let mockTranspilerInstance: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    // Default config
    mockConfig = {
      inputs: ["src/main.cnx"],
      outputPath: "",
      includeDirs: [],
      defines: {},
      preprocess: true,
      verbose: false,
      cppRequired: false,
      noCache: false,
      parseOnly: false,
    };

    // Mock fs
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => false,
    } as fs.Stats);

    // Mock InputExpansion
    vi.mocked(InputExpansion.expandInputs).mockReturnValue([
      "/project/src/main.cnx",
    ]);

    // Mock Transpiler
    mockTranspilerInstance = {
      run: vi.fn().mockResolvedValue({
        success: true,
        outputFiles: ["/project/src/main.c"],
        errors: [],
      }),
    };
    // vitest v4 requires function keyword for constructor mocks (not arrow functions)
    vi.mocked(Transpiler).mockImplementation(function () {
      return mockTranspilerInstance as unknown as Transpiler;
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("execute", () => {
    it("expands inputs and runs transpiler", async () => {
      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );

      expect(InputExpansion.expandInputs).toHaveBeenCalledWith([
        "src/main.cnx",
      ]);
      expect(Transpiler).toHaveBeenCalled();
      expect(mockTranspilerInstance.run).toHaveBeenCalled();
      expect(ResultPrinter.print).toHaveBeenCalled();
    });

    it("exits with error when InputExpansion throws", async () => {
      vi.mocked(InputExpansion.expandInputs).mockImplementation(() => {
        throw new Error("Path not found");
      });

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(1)",
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: Error: Path not found",
      );
    });

    it("exits with error when no .cnx files found", async () => {
      vi.mocked(InputExpansion.expandInputs).mockReturnValue([]);

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(1)",
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: No .cnx files found",
      );
    });

    it("passes include paths to Transpiler", async () => {
      // Include discovery now happens inside Transpiler.discoverSources()
      // Runner just passes config.includeDirs directly
      mockConfig.includeDirs = ["/extra/include"];

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );

      const transpilerCall = vi.mocked(Transpiler).mock.calls[0][0];
      expect(transpilerCall.includeDirs).toEqual(["/extra/include"]);
    });

    it("uses output directory when specified", async () => {
      mockConfig.outputPath = "build/";

      // Mock directory check
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
      } as fs.Stats);

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );

      const transpilerCall = vi.mocked(Transpiler).mock.calls[0][0];
      expect(transpilerCall.outDir).toBe("build/");
    });

    it("uses same directory as input when no output specified", async () => {
      mockConfig.outputPath = "";

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );

      const transpilerCall = vi.mocked(Transpiler).mock.calls[0][0];
      expect(transpilerCall.outDir).toBe("/project/src");
    });

    it("handles explicit output filename for single file", async () => {
      mockConfig.outputPath = "output/result.c";

      mockTranspilerInstance.run.mockResolvedValue({
        success: true,
        outputFiles: ["/project/output/main.c"],
        errors: [],
      });

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );

      expect(fs.renameSync).toHaveBeenCalled();
    });

    it("errors on explicit filename with multiple files", async () => {
      mockConfig.outputPath = "output/result.c";
      vi.mocked(InputExpansion.expandInputs).mockReturnValue([
        "/project/src/a.cnx",
        "/project/src/b.cnx",
      ]);

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(1)",
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: Cannot use explicit output filename with multiple input files",
      );
    });

    it("passes all config options to Transpiler", async () => {
      mockConfig = {
        inputs: ["src/"],
        outputPath: "build/",
        includeDirs: ["/inc"],
        defines: { DEBUG: true },
        preprocess: false,
        verbose: false,
        cppRequired: true,
        noCache: true,
        parseOnly: true,
        headerOutDir: "include/",
        basePath: "src/",
        target: "teensy41",
        debugMode: true,
      };

      // Mock directory input
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => true,
      } as fs.Stats);

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );

      const transpilerCall = vi.mocked(Transpiler).mock.calls[0][0];
      expect(transpilerCall.preprocess).toBe(false);
      expect(transpilerCall.cppRequired).toBe(true);
      expect(transpilerCall.noCache).toBe(true);
      expect(transpilerCall.parseOnly).toBe(true);
      expect(transpilerCall.headerOutDir).toBe("include/");
      expect(transpilerCall.basePath).toBe("src/");
      expect(transpilerCall.target).toBe("teensy41");
      expect(transpilerCall.debugMode).toBe(true);
    });

    it("exits with 0 on success", async () => {
      mockTranspilerInstance.run.mockResolvedValue({
        success: true,
        outputFiles: ["/project/src/main.c"],
        errors: [],
      });

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );
    });

    it("exits with 1 on failure", async () => {
      mockTranspilerInstance.run.mockResolvedValue({
        success: false,
        outputFiles: [],
        errors: ["Some error"],
      });

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(1)",
      );
    });

    it("separates directory and file inputs", async () => {
      mockConfig.inputs = ["src/", "extra/main.cnx"];

      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return (
          (path as string).endsWith("src/") ||
          (path as string).includes("main.cnx")
        );
      });
      vi.mocked(fs.statSync).mockImplementation((path) => {
        return {
          isDirectory: () => (path as string).endsWith("src/"),
        } as fs.Stats;
      });

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );

      const transpilerCall = vi.mocked(Transpiler).mock.calls[0][0];
      expect(transpilerCall.inputs).toHaveLength(2);
    });

    it("doesn't rename when generated file matches explicit path", async () => {
      mockConfig.outputPath = "/project/output/main.c";

      mockTranspilerInstance.run.mockResolvedValue({
        success: true,
        outputFiles: ["/project/output/main.c"],
        errors: [],
      });

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );

      expect(fs.renameSync).not.toHaveBeenCalled();
    });
  });
});
