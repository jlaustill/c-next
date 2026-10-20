/**
 * Unit tests for PlatformIOCommand
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { relative, resolve } from "node:path";
import PlatformIOCommand from "../PlatformIOCommand";
import ConfigLoader from "../ConfigLoader";
import IFileSystem from "../../cnx/types/IFileSystem";
import TestFileSystem from "../../cnx/types/__testUtils__/TestFileSystem";
import ConfigFileNames from "../../cnx/PARSE/1-Discover/ConfigFileNames";
import DiagnosticText from "../DiagnosticText";
import packageJson from "../../../package.json" with { type: "json" };

/**
 * A PlatformIO project in memory at the cwd, which install and uninstall
 * configure: its files by name, and what the commands removed.
 */
class PioProject {
  private readonly files = new Map<string, string>();
  readonly removed: string[] = [];
  /** Every path written, in order, by name relative to the project. */
  readonly written: string[] = [];
  readonly fs: IFileSystem;

  constructor(
    entries: Record<string, string>,
    overrides: Partial<IFileSystem> = {},
  ) {
    for (const [name, content] of Object.entries(entries)) {
      this.files.set(PioProject.at(name), content);
    }
    this.fs = TestFileSystem.with({
      exists: (path: string) => this.files.has(path),
      isFile: (path: string) => this.files.has(path),
      readFile: (path: string) => {
        const content = this.files.get(path);
        if (content === undefined) {
          throw new Error(`ENOENT: ${path}`);
        }
        return content;
      },
      writeFile: (path: string, content: string) => {
        this.written.push(relative(process.cwd(), path));
        this.files.set(path, content);
      },
      mkdir: () => {},
      unlink: (path: string) => {
        this.removed.push(path);
        this.files.delete(path);
      },
      ...overrides,
    });
  }

  /** The file `name` in the project, or undefined when there is none. */
  file(name: string): string | undefined {
    return this.files.get(PioProject.at(name));
  }

  /** The project's config under `name`, parsed. */
  config(name: string): Record<string, unknown> {
    const content = this.file(name);
    expect(content).toBeDefined();
    return JSON.parse(content as string);
  }

  private static at(name: string): string {
    return resolve(process.cwd(), name);
  }
}

describe("PlatformIOCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Mock process.exit to throw so execution stops (simulates real exit behavior)
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("install", () => {
    it("fails when platformio.ini doesn't exist", () => {
      const project = new PioProject({});

      expect(() => PlatformIOCommand.install(project.fs)).toThrow(
        "process.exit(1)",
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: platformio.ini not found in current directory",
      );
    });

    it("creates cnx_build.py script", () => {
      const project = new PioProject({ "platformio.ini": "[env:esp32]\n" });

      PlatformIOCommand.install(project.fs);

      const script = project.file("cnx_build.py");
      expect(script).toContain("Import");
      expect(script).toContain("transpile_cnx");
    });

    it("generates script that uses entry point, not per-file loop", () => {
      const project = new PioProject({ "platformio.ini": "[env:esp32]\n" });

      PlatformIOCommand.install(project.fs);

      const script = project.file("cnx_build.py");
      // Should use entry point approach
      expect(script).toContain('Path("src/main.cnx")');
      // ADR-049: the environment being built names the target (#1668)
      expect(script).toContain(
        '["cnx", str(entry), "--pio-env", env["PIOENV"]]',
      );

      // Should NOT loop over individual .cnx files
      expect(script).not.toContain("for cnx_file");
      expect(script).not.toContain("rglob");
    });

    it("generates script that names a missing cnx and how to install it (#2174)", () => {
      const project = new PioProject({ "platformio.ini": "[env:esp32]\n" });

      PlatformIOCommand.install(project.fs);

      const script = project.file("cnx_build.py");
      expect(script).toContain("except FileNotFoundError:");
      expect(script).toContain(
        `print("  ✗ cnx not found on PATH: npm i -g ${packageJson.name}")`,
      );
    });

    it("generates script that shows a successful run's target and warnings", () => {
      const project = new PioProject({ "platformio.ini": "[env:esp32]\n" });

      PlatformIOCommand.install(project.fs);

      const script = project.file("cnx_build.py");
      // #1760 review: the ADR-049 `Target:` line was filtered out of pio run,
      // and warnings, which go to stderr, were printed only on failure
      expect(script).toContain(
        'line.startswith(("Compiled", "Target", "Collected", "Generated"))',
      );
      expect(script).toContain(
        "if result.stderr:\n            print(result.stderr.rstrip())",
      );
    });

    it("generates script that runs at import time, not as buildprog pre-action (issue #833)", () => {
      // Issue #833: buildprog fires AFTER compilation, so transpile runs too late
      // The script should run transpilation at import time (before compilation)
      const project = new PioProject({ "platformio.ini": "[env:esp32]\n" });

      PlatformIOCommand.install(project.fs);

      const script = project.file("cnx_build.py");
      // Should NOT use AddPreAction (runs too late)
      expect(script).not.toContain("AddPreAction");
      expect(script).not.toContain("buildprog");

      // Should call transpile_cnx() at top level (import time)
      expect(script).toContain("transpile_cnx()");
    });

    it("adds extra_scripts to platformio.ini when not present", () => {
      const project = new PioProject({
        "platformio.ini": "[env:esp32]\nboard = esp32dev\n",
      });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toContain(
        "extra_scripts = pre:cnx_build.py",
      );
    });

    it("appends to existing extra_scripts", () => {
      const project = new PioProject({
        "platformio.ini": "[env:esp32]\nextra_scripts = post:other.py\n",
      });

      PlatformIOCommand.install(project.fs);

      const ini = project.file("platformio.ini");
      expect(ini).toContain("post:other.py");
      expect(ini).toContain("pre:cnx_build.py");
    });

    // #2221 review: since a reinstall goes on to set up the config, nothing
    // pinned what it leaves alone; writing platformio.ini again lists the
    // script twice, and the first-install banner is not a reinstall's
    it("leaves platformio.ini and the first-install banner alone on a reinstall", () => {
      const ini = "[env:esp32]\nextra_scripts = pre:cnx_build.py\n";
      const project = new PioProject({ "platformio.ini": ini });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(ini);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("already configured"),
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("PlatformIO integration configured"),
      );
    });

    it("outputs success message with next steps", () => {
      const project = new PioProject({ "platformio.ini": "[env:esp32]\n" });

      PlatformIOCommand.install(project.fs);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("PlatformIO integration configured"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Next steps"),
      );
    });

    describe("config setup", () => {
      it("creates cnx.config.json when the project has no config", () => {
        const project = new PioProject({ "platformio.ini": "[env:esp32]\n" });

        PlatformIOCommand.install(project.fs);

        const config = project.config("cnx.config.json");
        expect(config.include).toContain(".pio/libdeps");
        expect(config.headerOut).toBe("include");
      });

      // #2235, closed by #2261: platformio.ini makes the project its own root,
      // so an ancestor's config is not the project's before the install, and
      // the config the install writes shadows nothing.
      it("reads no ancestor's config, before the install or after it", () => {
        const ancestor = { target: "teensy41", cppRequired: true };
        const project = new PioProject({
          "platformio.ini": "[env:teensy41]\n",
          "../cnx.config.json": JSON.stringify(ancestor),
        });
        const cwd = process.cwd();

        expect(ConfigLoader.load(cwd, project.fs)).toEqual({
          kind: "loaded",
          config: {},
        });
        PlatformIOCommand.install(project.fs);

        expect(ConfigLoader.load(cwd, project.fs)).toEqual({
          kind: "loaded",
          config: {
            _path: resolve(cwd, "cnx.config.json"),
            include: [resolve(cwd, ".pio/libdeps")],
            headerOut: resolve(cwd, "include"),
          },
        });
        expect(project.config("../cnx.config.json")).toEqual(ancestor);
      });

      it("appends .pio/libdeps to existing include array", () => {
        const project = new PioProject({
          "platformio.ini": "[env:esp32]\n",
          "cnx.config.json": JSON.stringify({ include: ["lib/"] }),
        });

        PlatformIOCommand.install(project.fs);

        const config = project.config("cnx.config.json");
        expect(config.include).toContain("lib/");
        expect(config.include).toContain(".pio/libdeps");
      });

      it("sets headerOut only if not already set", () => {
        const project = new PioProject({
          "platformio.ini": "[env:esp32]\n",
          "cnx.config.json": JSON.stringify({ headerOut: "custom/" }),
        });

        PlatformIOCommand.install(project.fs);

        expect(project.config("cnx.config.json").headerOut).toBe("custom/");
      });

      it("does not duplicate .pio/libdeps if already present", () => {
        const project = new PioProject({
          "platformio.ini": "[env:esp32]\n",
          "cnx.config.json": JSON.stringify({
            include: [".pio/libdeps", "lib/"],
          }),
        });

        PlatformIOCommand.install(project.fs);

        const include = project.config("cnx.config.json").include as string[];
        expect(include.filter((i) => i === ".pio/libdeps")).toHaveLength(1);
      });

      it("preserves other existing config values", () => {
        const project = new PioProject({
          "platformio.ini": "[env:esp32]\n",
          "cnx.config.json": JSON.stringify({
            cppRequired: true,
            target: "teensy41",
            include: ["lib/"],
          }),
        });

        PlatformIOCommand.install(project.fs);

        const config = project.config("cnx.config.json");
        expect(config.cppRequired).toBe(true);
        expect(config.target).toBe("teensy41");
      });

      // #2165: it wrote `cnx.config.json` whatever the project used, and the
      // walk reads that name first, so a `.cnxrc` was shadowed with no word.
      it("updates the config a run reads, under the name it has", () => {
        const project = new PioProject({
          "platformio.ini": "[env:esp32]\n",
          ".cnxrc": JSON.stringify({ target: "teensy41" }),
        });

        PlatformIOCommand.install(project.fs);

        expect(project.config(".cnxrc")).toMatchObject({
          target: "teensy41",
          include: [".pio/libdeps"],
        });
        expect(project.file("cnx.config.json")).toBeUndefined();
      });

      // #2221 review: an already-configured platformio.ini returned before
      // the config was set up, so a reinstall left it without the defaults
      it("updates the config on a reinstall too", () => {
        const project = new PioProject({
          "platformio.ini": "[env:esp32]\nextra_scripts = pre:cnx_build.py\n",
          ".cnxrc": JSON.stringify({ target: "teensy41" }),
        });

        PlatformIOCommand.install(project.fs);

        expect(project.config(".cnxrc")).toEqual({
          target: "teensy41",
          include: [".pio/libdeps"],
          headerOut: "include",
        });
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("already configured"),
        );
      });

      // #2221 review: a reinstall replaced a config it could not parse, so a
      // trailing comma cost the project its settings, and `null` crashed
      it.each([
        ["a trailing comma", '{"target":"teensy41","include":["lib/"],}'],
        ["null", "null"],
      ])("stops at a config holding %s, writing nothing", (_label, content) => {
        const project = new PioProject({
          "platformio.ini": "[env:esp32]\nextra_scripts = pre:cnx_build.py\n",
          ".cnxrc": content,
        });

        expect(() => PlatformIOCommand.install(project.fs)).toThrow(
          "process.exit(1)",
        );

        expect(project.written).toEqual([]);
        expect(project.file(".cnxrc")).toBe(content);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("nothing was written"),
        );
      });

      // #2221 review: a config it cannot read was only a warning, so install
      // went on to write; the first case crashed half-installed on EACCES,
      // the second wrote a cnx.config.json shadowing the unreadable one
      it.each([["cnx.config.json"], [".cnx.json"]])(
        "stops at a %s it cannot read, writing nothing",
        (name) => {
          const unreadable = resolve(process.cwd(), name);
          const project = new PioProject(
            {
              "platformio.ini": "[env:esp32]\n",
              [name]: JSON.stringify({ target: "teensy41" }),
            },
            {
              readFile: (path: string) => {
                if (path === unreadable) {
                  throw new Error("EACCES: permission denied");
                }
                return "[env:esp32]\n";
              },
            },
          );

          expect(() => PlatformIOCommand.install(project.fs)).toThrow(
            "process.exit(1)",
          );

          expect(project.written).toEqual([]);
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            `Error: Failed to read config ${unreadable}: EACCES: permission denied; nothing was written. Fix it and run --pio-install again.`,
          );
        },
      );

      it("rewrites no config that already has the defaults", () => {
        const project = new PioProject({
          "platformio.ini": "[env:esp32]\nextra_scripts = pre:cnx_build.py\n",
          ".cnxrc": JSON.stringify({
            include: [".pio/libdeps"],
            headerOut: "include",
          }),
        });

        PlatformIOCommand.install(project.fs);

        expect(project.written).toEqual(["cnx_build.py"]);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining("already has the PlatformIO defaults"),
        );
      });

      it("stops with E0918 at a config under an old name, writing nothing (#2165)", () => {
        const ini = "[env:esp32]\n";
        const project = new PioProject({
          "platformio.ini": ini,
          ".cnextrc": "{}",
        });

        expect(() => PlatformIOCommand.install(project.fs)).toThrow(
          "process.exit(1)",
        );

        const error = ConfigFileNames.errorFor({
          path: resolve(process.cwd(), ".cnextrc"),
          successor: ".cnxrc",
          besideConfig: null,
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          `Error: ${DiagnosticText.of(error)}`,
        );
        expect(project.file("platformio.ini")).toBe(ini);
        expect(project.file("cnx_build.py")).toBeUndefined();
        expect(project.file(".cnxrc")).toBeUndefined();
      });
    });
  });

  describe("which entries name the hook", () => {
    it("adds the hook beside a script whose name only ends in cnx_build.py", () => {
      const project = new PioProject({
        "platformio.ini": "[env:esp32]\nextra_scripts = pre:my_cnx_build.py\n",
      });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(
        "[env:esp32]\nextra_scripts = pre:my_cnx_build.py\n    pre:cnx_build.py\n",
      );
    });

    it("installs where only a comment names cnext_build.py", () => {
      const ini = "; replaced cnext_build.py\n[env:esp32]\n";
      const project = new PioProject({ "platformio.ini": ini });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(
        "; replaced cnext_build.py\n[env:esp32]\nextra_scripts = pre:cnx_build.py\n",
      );
    });

    it("uninstall keeps an entry that only starts with pre:cnx_build.py", () => {
      const project = new PioProject({
        "platformio.ini":
          "[env:esp32]\nextra_scripts =\n    pre:cnx_build.py.bak\n    pre:cnx_build.py\n",
        "cnx_build.py": "",
      });

      PlatformIOCommand.uninstall(project.fs);

      expect(project.file("platformio.ini")).toBe(
        "[env:esp32]\nextra_scripts =\n    pre:cnx_build.py.bak\n",
      );
    });
  });

  describe("install over the old cnext_build.py integration (#2174)", () => {
    it.each([
      [
        "its platformio.ini entry",
        {
          "platformio.ini": "[env:esp32]\nextra_scripts = pre:cnext_build.py\n",
        },
      ],
      [
        "its script",
        { "platformio.ini": "[env:esp32]\n", "cnext_build.py": "" },
      ],
    ])("stops at %s, writing nothing", (_what, files) => {
      const project = new PioProject(files);

      expect(() => PlatformIOCommand.install(project.fs)).toThrow(
        "process.exit(1)",
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: this project has the old cnext_build.py integration, which runs `cnext`; nothing was written. Run cnx --pio-uninstall, then cnx --pio-install.",
      );
      expect(project.written).toEqual([]);
    });
  });

  describe("uninstall", () => {
    it("fails when platformio.ini doesn't exist", () => {
      const project = new PioProject({});

      expect(() => PlatformIOCommand.uninstall(project.fs)).toThrow(
        "process.exit(1)",
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: platformio.ini not found in current directory",
      );
    });

    it("removes cnx_build.py when it exists", () => {
      const project = new PioProject({
        "platformio.ini": "[env:esp32]\n",
        "cnx_build.py": "",
      });

      PlatformIOCommand.uninstall(project.fs);

      expect(project.removed).toEqual([resolve(process.cwd(), "cnx_build.py")]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Removed"),
      );
    });

    it("reports when cnx_build.py doesn't exist", () => {
      const project = new PioProject({ "platformio.ini": "[env:esp32]\n" });

      PlatformIOCommand.uninstall(project.fs);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("already removed"),
      );
    });

    it("removes cnx_build.py reference from platformio.ini", () => {
      const project = new PioProject({
        "platformio.ini": "[env:esp32]\nextra_scripts = pre:cnx_build.py\n",
        "cnx_build.py": "",
      });

      PlatformIOCommand.uninstall(project.fs);

      expect(project.file("platformio.ini")).not.toContain("cnx_build.py");
    });

    it("removes an indented cnx_build.py and keeps its sibling scripts", () => {
      const project = new PioProject({
        "platformio.ini":
          "[env:esp32]\nextra_scripts =\n    pre:cnx_build.py\n    post:other.py\n",
        "cnx_build.py": "",
      });

      PlatformIOCommand.uninstall(project.fs);

      const ini = project.file("platformio.ini");
      expect(ini).not.toContain("cnx_build.py");
      // The removed run reaches back only to the previous entry, never through it.
      expect(ini).toContain("post:other.py");
    });

    it.each([
      [
        "standalone",
        "[env:esp32]\nextra_scripts = pre:cnext_build.py\n",
        "[env:esp32]\n",
      ],
      [
        "indented",
        "[env:esp32]\nextra_scripts =\n    pre:cnext_build.py\n    post:other.py\n",
        "[env:esp32]\nextra_scripts =\n    post:other.py\n",
      ],
    ])(
      "removes the old cnext_build.py and its %s entry (#2174)",
      (_form, ini, cleaned) => {
        const project = new PioProject({
          "platformio.ini": ini,
          "cnext_build.py": "",
        });

        PlatformIOCommand.uninstall(project.fs);

        expect(project.removed).toEqual([
          resolve(process.cwd(), "cnext_build.py"),
        ]);
        expect(project.file("platformio.ini")).toBe(cleaned);
      },
    );

    it("removes both scripts and both entries when both names are present", () => {
      const project = new PioProject({
        "platformio.ini":
          "[env:esp32]\nextra_scripts =\n    pre:cnext_build.py\n    pre:cnx_build.py\n    post:other.py\n",
        "cnext_build.py": "",
        "cnx_build.py": "",
      });

      PlatformIOCommand.uninstall(project.fs);

      expect(project.removed).toEqual([
        resolve(process.cwd(), "cnx_build.py"),
        resolve(process.cwd(), "cnext_build.py"),
      ]);
      expect(project.file("platformio.ini")).toBe(
        "[env:esp32]\nextra_scripts =\n    post:other.py\n",
      );
    });

    it("reports when no integration found", () => {
      const project = new PioProject({ "platformio.ini": "[env:esp32]\n" });

      PlatformIOCommand.uninstall(project.fs);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("No cnx integration found"),
      );
    });

    it("handles file deletion errors", () => {
      const project = new PioProject(
        { "platformio.ini": "[env:esp32]\n", "cnx_build.py": "" },
        {
          unlink: () => {
            throw new Error("Permission denied");
          },
        },
      );

      expect(() => PlatformIOCommand.uninstall(project.fs)).toThrow(
        "process.exit(1)",
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error removing"),
        expect.anything(),
      );
    });

    it("outputs success message after removal", () => {
      const project = new PioProject({
        "platformio.ini": "[env:esp32]\nextra_scripts = pre:cnx_build.py\n",
        "cnx_build.py": "",
      });

      PlatformIOCommand.uninstall(project.fs);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("integration removed"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "To re-enable integration: cnx --pio-install",
      );
    });
  });
});
