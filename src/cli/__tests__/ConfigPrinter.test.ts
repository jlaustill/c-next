/**
 * Unit tests for ConfigPrinter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ConfigPrinter from "../ConfigPrinter";
import ICliConfig from "../types/ICliConfig";
import IFileConfig from "../types/IFileConfig";

describe("ConfigPrinter", () => {
  describe("getVersion", () => {
    it("returns a version string", () => {
      const version = ConfigPrinter.getVersion();

      expect(typeof version).toBe("string");
      expect(version.length).toBeGreaterThan(0);
    });

    it("returns a semantic version format", () => {
      const version = ConfigPrinter.getVersion();

      // Should match semver pattern (e.g., "0.1.51")
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe("showConfig", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let output: string[];

    beforeEach(() => {
      output = [];
      consoleLogSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
        output.push(msg ?? "");
      });
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it("displays config file path when provided", () => {
      const config: ICliConfig = {
        input: "",
        outputPath: "",
        includeDirs: [],
        defines: {},
        preprocess: true,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
      };
      const fileConfig: IFileConfig = {
        _path: "/path/to/cnext.config.json",
      };

      ConfigPrinter.showConfig(config, fileConfig);

      const fullOutput = output.join("\n");
      expect(fullOutput).toContain("/path/to/cnext.config.json");
    });

    it("displays (none) when no config file is loaded", () => {
      const config: ICliConfig = {
        input: "",
        outputPath: "",
        includeDirs: [],
        defines: {},
        preprocess: true,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
      };
      const fileConfig: IFileConfig = {};

      ConfigPrinter.showConfig(config, fileConfig);

      const fullOutput = output.join("\n");
      expect(fullOutput).toContain("Config file:    (none)");
    });

    it("displays cppRequired value", () => {
      const config: ICliConfig = {
        input: "",
        outputPath: "",
        includeDirs: [],
        defines: {},
        preprocess: true,
        verbose: false,
        cppRequired: true,
        noCache: false,
        parseOnly: false,
      };

      ConfigPrinter.showConfig(config, {});

      const fullOutput = output.join("\n");
      expect(fullOutput).toContain("cppRequired:    true");
    });

    it("displays debugMode value", () => {
      const config: ICliConfig = {
        input: "",
        outputPath: "",
        includeDirs: [],
        defines: {},
        preprocess: true,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
        debugMode: true,
      };

      ConfigPrinter.showConfig(config, {});

      const fullOutput = output.join("\n");
      expect(fullOutput).toContain("debugMode:      true");
    });

    it("displays target value when set", () => {
      const config: ICliConfig = {
        input: "",
        outputPath: "",
        includeDirs: [],
        defines: {},
        preprocess: true,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
        target: "teensy41",
      };

      ConfigPrinter.showConfig(config, {});

      const fullOutput = output.join("\n");
      expect(fullOutput).toContain("target:         teensy41");
    });

    it("displays (none) for target when not set", () => {
      const config: ICliConfig = {
        input: "",
        outputPath: "",
        includeDirs: [],
        defines: {},
        preprocess: true,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
      };

      ConfigPrinter.showConfig(config, {});

      const fullOutput = output.join("\n");
      expect(fullOutput).toContain("target:         (none)");
    });

    it("displays output path when set", () => {
      const config: ICliConfig = {
        input: "",
        outputPath: "build/",
        includeDirs: [],
        defines: {},
        preprocess: true,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
      };

      ConfigPrinter.showConfig(config, {});

      const fullOutput = output.join("\n");
      expect(fullOutput).toContain("output:         build/");
    });

    it("displays (same dir as input) when output not set", () => {
      const config: ICliConfig = {
        input: "",
        outputPath: "",
        includeDirs: [],
        defines: {},
        preprocess: true,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
      };

      ConfigPrinter.showConfig(config, {});

      const fullOutput = output.join("\n");
      expect(fullOutput).toContain("output:         (same dir as input)");
    });

    it("displays include directories", () => {
      const config: ICliConfig = {
        input: "",
        outputPath: "",
        includeDirs: ["lib/", "vendor/include/"],
        defines: {},
        preprocess: true,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
      };

      ConfigPrinter.showConfig(config, {});

      const fullOutput = output.join("\n");
      expect(fullOutput).toContain("- lib/");
      expect(fullOutput).toContain("- vendor/include/");
    });

    it("displays (none) when no include directories", () => {
      const config: ICliConfig = {
        input: "",
        outputPath: "",
        includeDirs: [],
        defines: {},
        preprocess: true,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
      };

      ConfigPrinter.showConfig(config, {});

      const fullOutput = output.join("\n");
      expect(fullOutput).toContain("include:        (none)");
    });

    it("displays defines with values", () => {
      const config: ICliConfig = {
        input: "",
        outputPath: "",
        includeDirs: [],
        defines: { DEBUG: true, VERSION: "1.0" },
        preprocess: true,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
      };

      ConfigPrinter.showConfig(config, {});

      const fullOutput = output.join("\n");
      expect(fullOutput).toContain("- DEBUG");
      expect(fullOutput).toContain("- VERSION=1.0");
    });

    it("displays header text", () => {
      const config: ICliConfig = {
        input: "",
        outputPath: "",
        includeDirs: [],
        defines: {},
        preprocess: true,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
      };

      ConfigPrinter.showConfig(config, {});

      const fullOutput = output.join("\n");
      expect(fullOutput).toContain("Effective configuration:");
      expect(fullOutput).toContain(
        "CLI flags take precedence over config file values",
      );
    });
  });
});
