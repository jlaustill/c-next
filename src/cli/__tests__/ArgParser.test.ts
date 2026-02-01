/**
 * Unit tests for ArgParser
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ArgParser from "../ArgParser";

describe("ArgParser", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitSpy: any;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock process.exit to prevent test from exiting
    exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  // Helper to create argv array (simulates process.argv)
  function argv(...args: string[]): string[] {
    return ["node", "cnext", ...args];
  }

  describe("parse", () => {
    describe("input files", () => {
      it("parses single input file", () => {
        const result = ArgParser.parse(argv("input.cnx"));

        expect(result.inputFiles).toEqual(["input.cnx"]);
      });

      it("parses multiple input files", () => {
        const result = ArgParser.parse(argv("a.cnx", "b.cnx", "c.cnx"));

        expect(result.inputFiles).toEqual(["a.cnx", "b.cnx", "c.cnx"]);
      });

      it("parses directory as input", () => {
        const result = ArgParser.parse(argv("src/"));

        expect(result.inputFiles).toEqual(["src/"]);
      });
    });

    describe("output options", () => {
      it("parses -o flag with file", () => {
        const result = ArgParser.parse(argv("input.cnx", "-o", "output.c"));

        expect(result.outputPath).toBe("output.c");
      });

      it("parses --output flag", () => {
        const result = ArgParser.parse(argv("input.cnx", "--output", "build/"));

        expect(result.outputPath).toBe("build/");
      });

      it("parses --header-out flag", () => {
        const result = ArgParser.parse(
          argv("input.cnx", "--header-out", "include/"),
        );

        expect(result.headerOutDir).toBe("include/");
      });

      it("parses --base-path flag", () => {
        const result = ArgParser.parse(
          argv("input.cnx", "--base-path", "src/"),
        );

        expect(result.basePath).toBe("src/");
      });
    });

    describe("compilation options", () => {
      it("parses --cpp flag", () => {
        const result = ArgParser.parse(argv("input.cnx", "--cpp"));

        expect(result.cppRequired).toBe(true);
      });

      it("defaults cppRequired to false", () => {
        const result = ArgParser.parse(argv("input.cnx"));

        expect(result.cppRequired).toBe(false);
      });

      it("parses single --include flag", () => {
        const result = ArgParser.parse(argv("input.cnx", "--include", "lib/"));

        expect(result.includeDirs).toEqual(["lib/"]);
      });

      it("parses multiple --include flags", () => {
        const result = ArgParser.parse(
          argv("input.cnx", "--include", "lib/", "--include", "vendor/"),
        );

        expect(result.includeDirs).toEqual(["lib/", "vendor/"]);
      });

      it("parses --target flag", () => {
        const result = ArgParser.parse(
          argv("input.cnx", "--target", "teensy41"),
        );

        expect(result.target).toBe("teensy41");
      });

      it("parses -D flag without value", () => {
        const result = ArgParser.parse(argv("input.cnx", "-D", "DEBUG"));

        expect(result.defines).toEqual({ DEBUG: true });
      });

      it("parses -D flag with value", () => {
        const result = ArgParser.parse(argv("input.cnx", "-D", "VERSION=1.0"));

        expect(result.defines).toEqual({ VERSION: "1.0" });
      });

      it("parses multiple -D flags", () => {
        const result = ArgParser.parse(
          argv("input.cnx", "-D", "DEBUG", "-D", "VERSION=2.0"),
        );

        expect(result.defines).toEqual({ DEBUG: true, VERSION: "2.0" });
      });
    });

    describe("mode flags", () => {
      it("parses --parse flag", () => {
        const result = ArgParser.parse(argv("input.cnx", "--parse"));

        expect(result.parseOnly).toBe(true);
      });

      it("parses --clean flag", () => {
        const result = ArgParser.parse(argv("input.cnx", "--clean"));

        expect(result.cleanMode).toBe(true);
      });

      it("parses --config flag", () => {
        const result = ArgParser.parse(argv("input.cnx", "--config"));

        expect(result.showConfig).toBe(true);
      });
    });

    describe("debug/development options", () => {
      it("parses --verbose flag", () => {
        const result = ArgParser.parse(argv("input.cnx", "--verbose"));

        expect(result.verbose).toBe(true);
      });

      it("parses --debug flag", () => {
        const result = ArgParser.parse(argv("input.cnx", "--debug"));

        expect(result.debugMode).toBe(true);
      });

      it("parses --no-preprocess flag", () => {
        const result = ArgParser.parse(argv("input.cnx", "--no-preprocess"));

        expect(result.preprocess).toBe(false);
      });

      it("defaults preprocess to true", () => {
        const result = ArgParser.parse(argv("input.cnx"));

        expect(result.preprocess).toBe(true);
      });

      it("parses --no-cache flag", () => {
        const result = ArgParser.parse(argv("input.cnx", "--no-cache"));

        expect(result.noCache).toBe(true);
      });
    });

    describe("PlatformIO flags", () => {
      it("parses --pio-install flag", () => {
        const result = ArgParser.parse(argv("input.cnx", "--pio-install"));

        expect(result.pioInstall).toBe(true);
      });

      it("parses --pio-uninstall flag", () => {
        const result = ArgParser.parse(argv("input.cnx", "--pio-uninstall"));

        expect(result.pioUninstall).toBe(true);
      });
    });

    // Note: --help and --version are handled directly by yargs with process.exit()
    // so they don't appear in the parsed result

    describe("complex argument combinations", () => {
      it("parses all options together", () => {
        const result = ArgParser.parse(
          argv(
            "src/",
            "extra.cnx",
            "-o",
            "build/",
            "--cpp",
            "--include",
            "lib/",
            "--target",
            "cortex-m4",
            "-D",
            "DEBUG",
            "--verbose",
            "--no-cache",
            "--header-out",
            "include/",
          ),
        );

        expect(result.inputFiles).toEqual(["src/", "extra.cnx"]);
        expect(result.outputPath).toBe("build/");
        expect(result.cppRequired).toBe(true);
        expect(result.includeDirs).toEqual(["lib/"]);
        expect(result.target).toBe("cortex-m4");
        expect(result.defines).toEqual({ DEBUG: true });
        expect(result.verbose).toBe(true);
        expect(result.noCache).toBe(true);
        expect(result.headerOutDir).toBe("include/");
      });
    });

    describe("default values", () => {
      it("has correct defaults for all fields", () => {
        const result = ArgParser.parse(argv("input.cnx"));

        expect(result.outputPath).toBe("");
        expect(result.includeDirs).toEqual([]);
        expect(result.defines).toEqual({});
        expect(result.cppRequired).toBe(false);
        expect(result.target).toBeUndefined();
        expect(result.preprocess).toBe(true);
        expect(result.verbose).toBe(false);
        expect(result.noCache).toBe(false);
        expect(result.parseOnly).toBe(false);
        expect(result.headerOutDir).toBeUndefined();
        expect(result.basePath).toBeUndefined();
        expect(result.cleanMode).toBe(false);
        expect(result.showConfig).toBe(false);
        expect(result.pioInstall).toBe(false);
        expect(result.pioUninstall).toBe(false);
        expect(result.debugMode).toBe(false);
      });
    });

    describe("error handling", () => {
      it("exits with code 0 when no arguments provided", () => {
        expect(() => ArgParser.parse(argv())).toThrow("process.exit(0)");
        expect(exitSpy).toHaveBeenCalledWith(0);
      });

      it("shows help when no arguments provided", () => {
        try {
          ArgParser.parse(argv());
        } catch {
          // Expected to throw due to process.exit mock
        }

        // Help should have been shown (via console.log)
        expect(consoleLogSpy).toHaveBeenCalled();
      });

      it("ignores -I flag (yargs without strict mode)", () => {
        // yargs without strict mode accepts unknown options
        // The fail handler only triggers on actual parse errors (e.g., missing requiresArg values)
        // In practice, users will see -I being ignored and the help text shows --include
        const result = ArgParser.parse(argv("input.cnx", "-I", "path"));
        expect(result.inputFiles).toEqual(["input.cnx"]);
        // -I doesn't populate includeDirs - shows users to use --include
        expect(result.includeDirs).toEqual([]);
      });

      it("ignores unknown flags (yargs without strict mode)", () => {
        // yargs without strict mode accepts unknown options
        const result = ArgParser.parse(argv("input.cnx", "--unknown-flag"));
        expect(result.inputFiles).toEqual(["input.cnx"]);
      });
    });
  });
});
