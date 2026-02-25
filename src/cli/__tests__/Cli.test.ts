/**
 * Unit tests for Cli
 *
 * Note: Cli.run() reads process.argv directly, making it hard to test in isolation.
 * These tests mock dependencies to verify the orchestration logic.
 *
 * TESTABILITY RECOMMENDATION: Refactor Cli.run() to accept argv as a parameter:
 *   static run(argv: string[] = process.argv): ICliResult
 * This would make testing much easier without changing the default behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Cli from "../Cli";
import ArgParser from "../ArgParser";
import ConfigLoader from "../ConfigLoader";
import ConfigPrinter from "../ConfigPrinter";
import PlatformIOCommand from "../PlatformIOCommand";
import CleanCommand from "../CleanCommand";
import IParsedArgs from "../types/IParsedArgs";
import IFileConfig from "../types/IFileConfig";

// Mock all dependencies
vi.mock("../ArgParser");
vi.mock("../ConfigLoader");
vi.mock("../ConfigPrinter");
vi.mock("../PlatformIOCommand");
vi.mock("../CleanCommand");
vi.mock("../PathNormalizer", () => ({
  default: {
    // Pass through the config unchanged for unit tests
    normalizeConfig: (config: unknown) => config,
  },
}));

describe("Cli", () => {
  let mockParsedArgs: IParsedArgs;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Default parsed args
    mockParsedArgs = {
      inputFiles: ["input.cnx"],
      outputPath: "",
      includeDirs: [],
      defines: {},
      preprocess: true,
      verbose: false,
      cppRequired: false,
      noCache: false,
      parseOnly: false,
      cleanMode: false,
      showConfig: false,
      pioInstall: false,
      pioUninstall: false,
      debugMode: false,
      serveMode: false,
    };

    // Default mocks
    vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);
    vi.mocked(ConfigLoader.load).mockReturnValue({});

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("run", () => {
    it("returns shouldRun: true with config when input is provided", () => {
      const result = Cli.run();

      expect(result.shouldRun).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.config).toBeDefined();
      expect(result.config?.input).toBe("input.cnx");
    });

    it("handles --pio-install flag", () => {
      mockParsedArgs.pioInstall = true;
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const result = Cli.run();

      expect(PlatformIOCommand.install).toHaveBeenCalled();
      expect(result.shouldRun).toBe(false);
      expect(result.exitCode).toBe(0);
    });

    it("handles --pio-uninstall flag", () => {
      mockParsedArgs.pioUninstall = true;
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const result = Cli.run();

      expect(PlatformIOCommand.uninstall).toHaveBeenCalled();
      expect(result.shouldRun).toBe(false);
      expect(result.exitCode).toBe(0);
    });

    it("handles --serve flag", () => {
      mockParsedArgs.serveMode = true;
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const result = Cli.run();

      expect(result.shouldRun).toBe(false);
      expect(result.exitCode).toBe(0);
      expect(result.serveMode).toBe(true);
    });

    it("handles --config flag", () => {
      mockParsedArgs.showConfig = true;
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const result = Cli.run();

      expect(ConfigPrinter.showConfig).toHaveBeenCalled();
      expect(result.shouldRun).toBe(false);
      expect(result.exitCode).toBe(0);
    });

    it("handles --clean flag", () => {
      mockParsedArgs.cleanMode = true;
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const result = Cli.run();

      expect(CleanCommand.execute).toHaveBeenCalled();
      expect(result.shouldRun).toBe(false);
      expect(result.exitCode).toBe(0);
    });

    it("returns error when no input file specified", () => {
      mockParsedArgs.inputFiles = [];
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const result = Cli.run();

      expect(result.shouldRun).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: No input file specified",
      );
    });

    it("loads config from input file directory", () => {
      mockParsedArgs.inputFiles = ["/path/to/src/main.cnx"];
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      Cli.run();

      expect(ConfigLoader.load).toHaveBeenCalledWith("/path/to/src");
    });

    it("loads config from cwd when no input file", () => {
      mockParsedArgs.inputFiles = [];
      mockParsedArgs.showConfig = true; // To avoid error path
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      Cli.run();

      expect(ConfigLoader.load).toHaveBeenCalledWith(process.cwd());
    });
  });

  describe("config merging", () => {
    it("merges CLI args with file config", () => {
      const fileConfig: IFileConfig = {
        cppRequired: true,
        target: "teensy41",
        include: ["lib/"],
      };
      vi.mocked(ConfigLoader.load).mockReturnValue(fileConfig);

      const result = Cli.run();

      // Note: cppRequired from CLI (false) takes precedence over file config (true)
      // because yargs always returns a defined boolean, so ?? doesn't fall through.
      // Only undefined CLI values fall through to file config.
      expect(result.config?.target).toBe("teensy41");
      expect(result.config?.includeDirs).toContain("lib/");
    });

    it("honors config file cppRequired when CLI does not specify --cpp (issue #827)", () => {
      // Issue #827: When user doesn't pass --cpp, config file cppRequired should be used
      // yargs returns cppRequired: false as the default, but config file should override
      const fileConfig: IFileConfig = {
        cppRequired: true,
      };
      vi.mocked(ConfigLoader.load).mockReturnValue(fileConfig);

      // CLI has cppRequired: false (yargs default when --cpp not specified)
      mockParsedArgs.cppRequired = false;
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const result = Cli.run();

      // Config file's cppRequired: true should be honored
      expect(result.config?.cppRequired).toBe(true);
    });

    it("CLI --cpp flag takes precedence over file config", () => {
      mockParsedArgs.cppRequired = true;
      mockParsedArgs.target = "cortex-m0";
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const fileConfig: IFileConfig = {
        cppRequired: false,
        target: "teensy41",
      };
      vi.mocked(ConfigLoader.load).mockReturnValue(fileConfig);

      const result = Cli.run();

      // CLI --cpp flag should take precedence
      expect(result.config?.cppRequired).toBe(true);
      expect(result.config?.target).toBe("cortex-m0");
    });

    it("merges include directories from both sources", () => {
      mockParsedArgs.includeDirs = ["cli-include/"];
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const fileConfig: IFileConfig = {
        include: ["config-include/"],
      };
      vi.mocked(ConfigLoader.load).mockReturnValue(fileConfig);

      const result = Cli.run();

      // Config includes come first, CLI includes second
      expect(result.config?.includeDirs).toEqual([
        "config-include/",
        "cli-include/",
      ]);
    });

    it("uses CLI output path over config output", () => {
      mockParsedArgs.outputPath = "cli-build/";
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const fileConfig: IFileConfig = {
        output: "config-build/",
      };
      vi.mocked(ConfigLoader.load).mockReturnValue(fileConfig);

      const result = Cli.run();

      expect(result.config?.outputPath).toBe("cli-build/");
    });

    it("falls back to config output when CLI not specified", () => {
      mockParsedArgs.outputPath = "";
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const fileConfig: IFileConfig = {
        output: "config-build/",
      };
      vi.mocked(ConfigLoader.load).mockReturnValue(fileConfig);

      const result = Cli.run();

      expect(result.config?.outputPath).toBe("config-build/");
    });

    it("handles noCache from CLI or config", () => {
      mockParsedArgs.noCache = true;
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const result = Cli.run();

      expect(result.config?.noCache).toBe(true);
    });

    it("handles noCache from config when CLI is false", () => {
      mockParsedArgs.noCache = false;
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const fileConfig: IFileConfig = {
        noCache: true,
      };
      vi.mocked(ConfigLoader.load).mockReturnValue(fileConfig);

      const result = Cli.run();

      // noCache uses OR: args.noCache || fileConfig.noCache === true
      expect(result.config?.noCache).toBe(true);
    });

    it("passes through all config fields", () => {
      mockParsedArgs = {
        inputFiles: ["a.cnx"],
        outputPath: "build/",
        includeDirs: ["inc/"],
        defines: { DEBUG: true },
        preprocess: false,
        verbose: true,
        cppRequired: true,
        noCache: true,
        parseOnly: true,
        headerOutDir: "headers/",
        basePath: "src/",
        target: "avr",
        debugMode: true,
        cleanMode: false,
        showConfig: false,
        pioInstall: false,
        pioUninstall: false,
        serveMode: false,
      };
      vi.mocked(ArgParser.parse).mockReturnValue(mockParsedArgs);

      const result = Cli.run();

      expect(result.config).toEqual({
        input: "a.cnx",
        outputPath: "build/",
        includeDirs: ["inc/"],
        defines: { DEBUG: true },
        preprocess: false,
        verbose: true,
        cppRequired: true,
        noCache: true,
        parseOnly: true,
        headerOutDir: "headers/",
        basePath: "src/",
        target: "avr",
        debugMode: true,
      });
    });
  });
});
