/**
 * Unit tests for PlatformIOCommand
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { relative, resolve } from "node:path";
import PlatformIOCommand from "../PlatformIOCommand";
import ConfigLoader from "../ConfigLoader";
import IFileSystem from "../../cnx/types/IFileSystem";
import TestFileSystem from "../../cnx/types/__testUtils__/TestFileSystem";
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

        expect(ConfigLoader.load(cwd, project.fs)).toEqual({});
        PlatformIOCommand.install(project.fs);

        expect(ConfigLoader.load(cwd, project.fs)).toEqual({
          _path: resolve(cwd, "cnx.config.json"),
          include: [resolve(cwd, ".pio/libdeps")],
          headerOut: resolve(cwd, "include"),
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
    });
  });

  describe("which entries name the hook", () => {
    it("adds the hook beside a script whose name only ends in cnx_build.py", () => {
      const project = new PioProject({
        "platformio.ini": "[env:esp32]\nextra_scripts = pre:my_cnx_build.py\n",
      });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(
        "[env:esp32]\nextra_scripts = pre:my_cnx_build.py, pre:cnx_build.py\n",
      );
    });

    it("adds the hook beside a script whose name only starts with cnx_build.py", () => {
      const project = new PioProject({
        "platformio.ini": "[env:esp32]\nextra_scripts = pre:cnx_build.py.bak\n",
      });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(
        "[env:esp32]\nextra_scripts = pre:cnx_build.py.bak, pre:cnx_build.py\n",
      );
    });

    it("installs where only a comment names cnx_build.py", () => {
      const ini = "; replaced cnx_build.py\n[env:esp32]\n";
      const project = new PioProject({ "platformio.ini": ini });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(
        "; replaced cnx_build.py\n[env:esp32]\nextra_scripts = pre:cnx_build.py\n",
      );
    });

    it.each([
      ["first", "pre:cnx_build.py, post:other.py"],
      ["last", "post:other.py, pre:cnx_build.py"],
    ])(
      "reinstall leaves a one-line list with the hook %s alone",
      (_where, list) => {
        const ini = `[env:esp32]\nextra_scripts = ${list}\n`;
        const project = new PioProject({ "platformio.ini": ini });

        PlatformIOCommand.install(project.fs);

        expect(project.file("platformio.ini")).toBe(ini);
      },
    );

    it("installs where the only cnx_build.py entry is commented out", () => {
      const project = new PioProject({
        "platformio.ini":
          "[env:esp32]\n; extra_scripts = pre:cnx_build.py\nextra_scripts =\n    post:other.py ; uploads\n",
      });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(
        "[env:esp32]\n; extra_scripts = pre:cnx_build.py\nextra_scripts =\n    post:other.py ; uploads\n    pre:cnx_build.py\n",
      );
    });

    it("adds to a one-line list as one more item, its comment kept", () => {
      const project = new PioProject({
        "platformio.ini":
          "[env:esp32]\nextra_scripts = pre:a.py, post:b.py ; ours\n",
      });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(
        "[env:esp32]\nextra_scripts = pre:a.py, post:b.py, pre:cnx_build.py ; ours\n",
      );
    });

    it("installs where the only entry is commented out with #", () => {
      const project = new PioProject({
        "platformio.ini": "[env:esp32]\n# extra_scripts = pre:cnx_build.py\n",
      });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(
        "[env:esp32]\nextra_scripts = pre:cnx_build.py\n# extra_scripts = pre:cnx_build.py\n",
      );
    });

    // #2174 review: PlatformIO splits a value after expanding its references
    it("adds a line of its own to a reference to a list of lines", () => {
      const common = "[common]\nextra_scripts =\n    pre:a.py\n    post:b.py\n";
      const project = new PioProject({
        "platformio.ini": `[env:a]\nextra_scripts = \${common.extra_scripts}\n${common}`,
      });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(
        `[env:a]\nextra_scripts = \${common.extra_scripts}\n    pre:cnx_build.py\n${common}`,
      );
    });

    it("adds an item to a reference to a one-line list", () => {
      const common = "[common]\nextra_scripts = pre:a.py, post:b.py\n";
      const project = new PioProject({
        "platformio.ini": `[env:a]\nextra_scripts = \${common.extra_scripts}\n${common}`,
      });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(
        `[env:a]\nextra_scripts = \${common.extra_scripts}, pre:cnx_build.py\n${common}`,
      );
    });

    it("stops at a reference only the build machine can expand", () => {
      const ini = "[env:a]\nextra_scripts = ${sysenv.SCRIPTS}\n";
      const project = new PioProject({ "platformio.ini": ini });

      expect(() => PlatformIOCommand.install(project.fs)).toThrow(
        "process.exit(1)",
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: extra_scripts = ${sysenv.SCRIPTS} in [env:a] names a value only the build machine knows, so it is not known how to add the hook; nothing was written. Add pre:cnx_build.py to it by hand, then run cnx --pio-install again.",
      );
      expect(project.written).toEqual([]);
    });

    it("reinstalls over a hook already beside a build machine's reference", () => {
      const ini =
        "[env:a]\nextra_scripts = ${sysenv.SCRIPTS}, pre:cnx_build.py\n";
      const project = new PioProject({ "platformio.ini": ini });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(ini);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "✓ PlatformIO already configured for cnx",
      );
    });

    it("installs into a CRLF file with its line breaks and indent", () => {
      const project = new PioProject({
        "platformio.ini":
          "[env:esp32]\r\nextra_scripts =\r\n\tpost:other.py\r\n",
      });

      PlatformIOCommand.install(project.fs);

      expect(project.file("platformio.ini")).toBe(
        "[env:esp32]\r\nextra_scripts =\r\n\tpost:other.py\r\n\tpre:cnx_build.py\r\n",
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

    it("removes the hook from a one-line list holding a build machine's reference", () => {
      const project = new PioProject({
        "platformio.ini":
          "[env:a]\nextra_scripts = ${sysenv.SCRIPTS}, pre:cnx_build.py\n",
      });

      PlatformIOCommand.uninstall(project.fs);

      expect(project.file("platformio.ini")).toBe(
        "[env:a]\nextra_scripts = ${sysenv.SCRIPTS}\n",
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

    it.each([
      [
        "standalone",
        "[env:esp32]\nextra_scripts = pre:cnx_build.py\n",
        "[env:esp32]\n",
      ],
      [
        "indented",
        "[env:esp32]\nextra_scripts =\n    pre:cnx_build.py\n    post:other.py\n",
        "[env:esp32]\nextra_scripts =\n    post:other.py\n",
      ],
    ])(
      "removes cnx_build.py and its %s entry, keeping sibling scripts",
      (_form, ini, cleaned) => {
        const project = new PioProject({
          "platformio.ini": ini,
          "cnx_build.py": "",
        });

        PlatformIOCommand.uninstall(project.fs);

        expect(project.removed).toEqual([
          resolve(process.cwd(), "cnx_build.py"),
        ]);
        expect(project.file("platformio.ini")).toBe(cleaned);
      },
    );

    // #2174 review: PlatformIO splits a one-line list at ", ", reads a value
    // on the key's line together with the indented lines below it, and skips
    // a commented-out line
    it.each([
      [
        "first in a one-line list",
        "[env:esp32]\nextra_scripts = pre:cnx_build.py, post:other.py\n",
        "[env:esp32]\nextra_scripts = post:other.py\n",
      ],
      [
        "last in a one-line list",
        "[env:esp32]\nextra_scripts = post:other.py, pre:cnx_build.py ; ours\n",
        "[env:esp32]\nextra_scripts = post:other.py ; ours\n",
      ],
      [
        "on the key's line, with scripts continuing below it",
        "[env:esp32]\nextra_scripts = pre:cnx_build.py\n    post:upload.py\n",
        "[env:esp32]\nextra_scripts =\n    post:upload.py\n",
      ],
      [
        "below a commented-out line, in a later section too",
        "[env:a]\n; extra_scripts = pre:cnx_build.py\n[env:b]\nextra_scripts = pre:cnx_build.py\n",
        "[env:a]\n; extra_scripts = pre:cnx_build.py\n[env:b]\n",
      ],
    ])("removes the entry %s", (_form, ini, cleaned) => {
      const project = new PioProject({ "platformio.ini": ini });

      PlatformIOCommand.uninstall(project.fs);

      expect(project.file("platformio.ini")).toBe(cleaned);
    });

    it("leaves a commented-out entry alone", () => {
      const ini = "[env:esp32]\n; extra_scripts = pre:cnx_build.py\n";
      const project = new PioProject({ "platformio.ini": ini });

      PlatformIOCommand.uninstall(project.fs);

      expect(project.file("platformio.ini")).toBe(ini);
      expect(project.written).toEqual([]);
    });

    it("removes the entries of every section, keeping each one's other scripts", () => {
      const project = new PioProject({
        "platformio.ini":
          "[env:a]\nextra_scripts =\n    pre:cnx_build.py\n    post:a.py\n[env:b]\nextra_scripts = pre:cnx_build.py, post:b.py\n",
      });

      PlatformIOCommand.uninstall(project.fs);

      expect(project.file("platformio.ini")).toBe(
        "[env:a]\nextra_scripts =\n    post:a.py\n[env:b]\nextra_scripts = post:b.py\n",
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
