/**
 * Unit tests for Runner
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Runner from "../Runner";
import Transpiler from "../../transpiler/Transpiler";
import ResultPrinter from "../ResultPrinter";
import ICliConfig from "../types/ICliConfig";
import InputExpansion from "../../transpiler/data/InputExpansion";
import * as fs from "node:fs";

// Mock dependencies
vi.mock("../../transpiler/Transpiler");
vi.mock("../ResultPrinter");
vi.mock("../../transpiler/data/InputExpansion");
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
  let mockTranspilerInstance: { transpile: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    // Default config
    mockConfig = {
      input: "src/main.cnx",
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

    // Mock Transpiler
    mockTranspilerInstance = {
      transpile: vi.fn().mockResolvedValue({
        success: true,
        outputFiles: ["/project/src/main.c"],
        errors: [],
      }),
    };
    // vitest v4 requires function keyword for constructor mocks (not arrow functions)
    vi.mocked(Transpiler).mockImplementation(function () {
      return mockTranspilerInstance as unknown as Transpiler;
    });

    // Default: not a C++ entry point
    vi.mocked(InputExpansion.isCppEntryPoint).mockReturnValue(false);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("execute", () => {
    it("resolves input and runs transpiler", async () => {
      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );

      expect(Transpiler).toHaveBeenCalled();
      expect(mockTranspilerInstance.transpile).toHaveBeenCalled();
      expect(ResultPrinter.print).toHaveBeenCalled();
    });

    it("passes include paths to Transpiler", async () => {
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
      // outDir should be dirname of resolved input
      expect(transpilerCall.outDir).toBeDefined();
    });

    it("handles explicit output filename", async () => {
      mockConfig.outputPath = "output/result.c";

      mockTranspilerInstance.transpile.mockResolvedValue({
        success: true,
        outputFiles: ["/project/output/main.c"],
        errors: [],
      });

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );

      expect(fs.renameSync).toHaveBeenCalled();
    });

    it("passes all config options to Transpiler", async () => {
      mockConfig = {
        input: "src/main.cnx",
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
      mockTranspilerInstance.transpile.mockResolvedValue({
        success: true,
        outputFiles: ["/project/src/main.c"],
        errors: [],
      });

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );
    });

    it("exits with 1 on failure", async () => {
      mockTranspilerInstance.transpile.mockResolvedValue({
        success: false,
        outputFiles: [],
        errors: ["Some error"],
      });

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(1)",
      );
    });

    it("doesn't rename when generated file matches explicit path", async () => {
      mockConfig.outputPath = "/project/output/main.c";

      mockTranspilerInstance.transpile.mockResolvedValue({
        success: true,
        outputFiles: ["/project/output/main.c"],
        errors: [],
      });

      await expect(Runner.execute(mockConfig)).rejects.toThrow(
        "process.exit(0)",
      );

      expect(fs.renameSync).not.toHaveBeenCalled();
    });

    describe("C++ entry point", () => {
      beforeEach(() => {
        vi.mocked(InputExpansion.isCppEntryPoint).mockReturnValue(true);
        mockConfig.input = "src/main.cpp";
      });

      it("prints scanning message for C++ entry point", async () => {
        mockTranspilerInstance.transpile.mockResolvedValue({
          success: true,
          outputFiles: [],
          errors: [],
          filesProcessed: 1,
          files: [{ sourcePath: "/project/src/led.cnx" }],
        });

        await expect(Runner.execute(mockConfig)).rejects.toThrow(
          "process.exit(0)",
        );

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("Scanning main.cpp for C-Next includes..."),
        );
      });

      it("prints found files when C-Next sources discovered", async () => {
        mockTranspilerInstance.transpile.mockResolvedValue({
          success: true,
          outputFiles: ["/project/src/led.c"],
          errors: [],
          filesProcessed: 2,
          files: [
            { sourcePath: "/project/src/led.cnx" },
            { sourcePath: "/project/src/motor.cnx" },
          ],
        });

        await expect(Runner.execute(mockConfig)).rejects.toThrow(
          "process.exit(0)",
        );

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("Found 2 C-Next source file(s)"),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("led.cnx"),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("motor.cnx"),
        );
      });

      it("prints getting started guide when no C-Next files found", async () => {
        mockTranspilerInstance.transpile.mockResolvedValue({
          success: true,
          outputFiles: [],
          errors: [],
          filesProcessed: 0,
          files: [],
        });

        await expect(Runner.execute(mockConfig)).rejects.toThrow(
          "process.exit(0)",
        );

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("No C-Next files found"),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("Create a .cnx file"),
        );
      });

      it("does not print C++ entry point messages for .cnx files", async () => {
        vi.mocked(InputExpansion.isCppEntryPoint).mockReturnValue(false);
        mockConfig.input = "src/main.cnx";

        mockTranspilerInstance.transpile.mockResolvedValue({
          success: true,
          outputFiles: ["/project/src/main.c"],
          errors: [],
          filesProcessed: 1,
          files: [{ sourcePath: "/project/src/main.cnx" }],
        });

        await expect(Runner.execute(mockConfig)).rejects.toThrow(
          "process.exit(0)",
        );

        expect(consoleLogSpy).not.toHaveBeenCalledWith(
          expect.stringContaining("Scanning"),
        );
        expect(consoleLogSpy).not.toHaveBeenCalledWith(
          expect.stringContaining("Found"),
        );
      });
    });
  });
});
