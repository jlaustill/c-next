/**
 * Unit tests for ConfigLoader
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import ConfigLoader from "../ConfigLoader";
import IncludeDiscovery from "../../cnx/PARSE/1-Discover/IncludeDiscovery";
import MockFileSystem from "./MockFileSystem";
import IFileSystem from "../../cnx/types/IFileSystem";

describe("ConfigLoader", () => {
  let tempDir: string;
  const originalHome = process.env.HOME;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "configloader-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    process.env.HOME = originalHome;
  });

  describe("load", () => {
    it("returns empty object when no config file exists", () => {
      const config = ConfigLoader.load(tempDir);
      expect(config).toEqual({});
    });

    it.each([
      ["cnx.config.json", { cppRequired: true, target: "teensy41" }],
      [".cnx.json", { noCache: true }],
      [".cnxrc", { debugMode: true }],
    ])("loads %s when present", (name, settings) => {
      writeFileSync(join(tempDir, name), JSON.stringify(settings));

      const config = ConfigLoader.load(tempDir);

      expect(config).toEqual({ ...settings, _path: join(tempDir, name) });
    });

    it("prefers cnx.config.json over .cnx.json", () => {
      writeFileSync(
        join(tempDir, "cnx.config.json"),
        JSON.stringify({ target: "from-config" }),
      );
      writeFileSync(
        join(tempDir, ".cnx.json"),
        JSON.stringify({ target: "from-cnx-json" }),
      );

      const config = ConfigLoader.load(tempDir);

      expect(config.target).toBe("from-config");
    });

    it("prefers .cnx.json over .cnxrc", () => {
      writeFileSync(
        join(tempDir, ".cnx.json"),
        JSON.stringify({ target: "from-cnx-json" }),
      );
      writeFileSync(
        join(tempDir, ".cnxrc"),
        JSON.stringify({ target: "from-rc" }),
      );

      const config = ConfigLoader.load(tempDir);

      expect(config.target).toBe("from-cnx-json");
    });

    // #2261 (owner ruling, 2026-10-19): any config file marks its directory as
    // the project root. An empty one used to be skipped, as cosmiconfig's
    // ignoreEmptySearchPlaces did, which read a config above the root.
    it("is the default settings for an empty config, and reads none above it", () => {
      const subDir = join(tempDir, "app");
      mkdirSync(subDir, { recursive: true });
      writeFileSync(join(subDir, "cnx.config.json"), "  \n");
      writeFileSync(
        join(tempDir, ".cnxrc"),
        JSON.stringify({ target: "above-the-empty-one" }),
      );

      expect(ConfigLoader.load(subDir)).toEqual({});
    });

    it("searches up the directory tree", () => {
      // Create nested directory structure
      const subDir = join(tempDir, "src", "components");
      const { mkdirSync } = require("node:fs");
      mkdirSync(subDir, { recursive: true });

      // Put config in root
      writeFileSync(
        join(tempDir, "cnx.config.json"),
        JSON.stringify({ target: "found-in-parent" }),
      );

      const config = ConfigLoader.load(subDir);

      expect(config.target).toBe("found-in-parent");
      expect(config._path).toBe(join(tempDir, "cnx.config.json"));
    });

    // #1826 review: the replacement for cosmiconfig let EACCES escape and abort
    // the run. #2261: the file still marks the root, so a run warns and reads
    // no config above it, where it used to go on to an ancestor's.
    it("warns about an unreadable config and reads none above it", () => {
      const fs = new MockFileSystem()
        .addFile("/p/app/cnx.config.json", "{}")
        .addFile("/p/.cnxrc", JSON.stringify({ target: "from-parent" }));
      const unreadable: IFileSystem = Object.assign(Object.create(fs), {
        readFile: (path: string) => {
          if (path === "/p/app/cnx.config.json") {
            throw Object.assign(new Error("EACCES: permission denied"), {
              code: "EACCES",
            });
          }
          return fs.readFile(path);
        },
      });
      const warn = vi.spyOn(console, "error").mockImplementation(() => {});

      const config = ConfigLoader.load("/p/app", unreadable);

      expect(config).toEqual({});
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to read config /p/app/cnx.config.json"),
      );
      warn.mockRestore();
    });

    it.each([["42"], ['"x"'], ["true"], ["[]"]])(
      "warns and ignores a config that parses to %s, which is not a JSON object",
      (content) => {
        const fs = new MockFileSystem().addFile("/p/.cnxrc", content);
        const warn = vi.spyOn(console, "error").mockImplementation(() => {});

        expect(ConfigLoader.load("/p", fs)).toEqual({});
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("/p/.cnxrc is not a JSON object"),
        );
        warn.mockRestore();
      },
    );

    it("returns empty object and logs warning for invalid JSON", () => {
      writeFileSync(join(tempDir, "cnx.config.json"), "{ invalid json }");

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const config = ConfigLoader.load(tempDir);

      expect(config).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Failed to parse"),
      );

      consoleSpy.mockRestore();
    });

    it("loads all config options correctly", () => {
      const fullConfig = {
        cppRequired: true,
        debugMode: true,
        target: "cortex-m4",
        noCache: true,
        include: ["lib/", "vendor/"],
        output: "build/",
        headerOut: "include/",
      };
      writeFileSync(
        join(tempDir, "cnx.config.json"),
        JSON.stringify(fullConfig),
      );

      const config = ConfigLoader.load(tempDir);

      expect(config.cppRequired).toBe(true);
      expect(config.debugMode).toBe(true);
      expect(config.target).toBe("cortex-m4");
      expect(config.noCache).toBe(true);
      // Issue #1547: paths a config file declares come back anchored to that
      // config file's directory, not left relative for the CWD to resolve.
      expect(config.include).toEqual([
        join(tempDir, "lib"),
        join(tempDir, "vendor"),
      ]);
      expect(config.output).toBe(join(tempDir, "build"));
      expect(config.headerOut).toBe(join(tempDir, "include"));
    });
    describe("path anchoring (issue #1547)", () => {
      it("resolves headerOut against the config file's directory", () => {
        writeFileSync(
          join(tempDir, "cnx.config.json"),
          JSON.stringify({ headerOut: "include" }),
        );

        const config = ConfigLoader.load(tempDir);

        expect(config.headerOut).toBe(join(tempDir, "include"));
      });

      it("resolves headerOut to the same path when loaded from a nested directory", () => {
        const subDir = join(tempDir, "src");
        mkdirSync(subDir, { recursive: true });
        writeFileSync(
          join(tempDir, "cnx.config.json"),
          JSON.stringify({ headerOut: "include" }),
        );

        const fromRoot = ConfigLoader.load(tempDir);
        const fromSubDir = ConfigLoader.load(subDir);

        expect(fromSubDir.headerOut).toBe(join(tempDir, "include"));
        expect(fromSubDir.headerOut).toBe(fromRoot.headerOut);
      });

      it("resolves output against the config file's directory", () => {
        writeFileSync(
          join(tempDir, "cnx.config.json"),
          JSON.stringify({ output: "build" }),
        );

        const config = ConfigLoader.load(tempDir);

        expect(config.output).toBe(join(tempDir, "build"));
      });

      it("resolves include entries against the config file's directory", () => {
        const subDir = join(tempDir, "src");
        mkdirSync(subDir, { recursive: true });
        writeFileSync(
          join(tempDir, "cnx.config.json"),
          JSON.stringify({ include: ["vendor", ".pio/libdeps"] }),
        );

        const config = ConfigLoader.load(subDir);

        expect(config.include).toEqual([
          join(tempDir, "vendor"),
          join(tempDir, ".pio", "libdeps"),
        ]);
      });

      /**
       * #1548 review: `output` and `headerOut` are truthiness-guarded because
       * `resolve(configDir, "")` returns `configDir` -- an empty `output` would
       * stop meaning "(same dir as input)". `include` needs the same guard for
       * the same reason: before anchoring, an empty entry was dropped by
       * `PathNormalizer.expandRecursive` (`fs.exists("")` is false); anchored
       * unguarded, it would put the whole project root on the header search
       * path. Both behaviors are silent, so a stray entry from a trailing
       * comma changes header resolution with nothing reported.
       */
      it("drops an empty include entry instead of resolving it to the project root", () => {
        writeFileSync(
          join(tempDir, "cnx.config.json"),
          JSON.stringify({ include: ["", "vendor"] }),
        );

        const config = ConfigLoader.load(tempDir);

        expect(config.include).toEqual([join(tempDir, "vendor")]);
      });

      it("leaves an absolute headerOut unchanged", () => {
        writeFileSync(
          join(tempDir, "cnx.config.json"),
          JSON.stringify({ headerOut: "/opt/generated/include" }),
        );

        const config = ConfigLoader.load(tempDir);

        expect(config.headerOut).toBe("/opt/generated/include");
      });

      it("expands a leading ~ in headerOut instead of anchoring it", () => {
        // #1548 review: set HOME rather than reading it. With an unset HOME,
        // expandTilde falls through to returning the path unchanged while
        // `join(undefined, ...)` throws -- the failure surfaces as a TypeError
        // inside the expectation rather than as a readable assertion diff.
        const home = "/home/testuser";
        process.env.HOME = home;
        writeFileSync(
          join(tempDir, "cnx.config.json"),
          JSON.stringify({ headerOut: "~/generated" }),
        );

        const config = ConfigLoader.load(tempDir);

        expect(config.headerOut).toBe(join(home, "generated"));
      });
    });
  });

  // #2261: the config is read from the project root, and from no directory
  // above it, so a run's settings and its root are one directory.
  describe("the project root", () => {
    it.each([
      [
        "package.json",
        (fs: MockFileSystem) => fs.addFile("/proj/tools/package.json", "{}"),
      ],
      [".git", (fs: MockFileSystem) => fs.addDirectory("/proj/tools/.git")],
      [
        "platformio.ini",
        (fs: MockFileSystem) => fs.addFile("/proj/tools/platformio.ini", ""),
      ],
    ])("reads no config above a %s", (_marker, mark) => {
      const fs = new MockFileSystem().addFile(
        "/proj/cnx.config.json",
        JSON.stringify({ headerOut: "include" }),
      );
      mark(fs);

      expect(ConfigLoader.load("/proj/tools", fs)).toEqual({});
    });

    it("reads the config above a directory with no marker, which is the root", () => {
      const fs = new MockFileSystem().addFile(
        "/proj/cnx.config.json",
        JSON.stringify({ headerOut: "include" }),
      );

      expect(ConfigLoader.load("/proj/tools", fs)).toMatchObject({
        _path: "/proj/cnx.config.json",
        headerOut: "/proj/include",
      });
    });

    it("reads no home .cnxrc for a project below a .git; without it, home is the root", () => {
      const fs = new MockFileSystem()
        .addFile("/home/.cnxrc", JSON.stringify({ headerOut: "headers" }))
        .addDirectory("/home/work/p/.git");

      expect(ConfigLoader.load("/home/work/p", fs)).toEqual({});
      expect(ConfigLoader.load("/home/work/q", fs)._path).toBe("/home/.cnxrc");
    });

    it.each([
      ["/proj/tools", "/proj/tools", "/proj/tools/.cnxrc"],
      ["/proj/lib/deep", "/proj", "/proj/cnx.config.json"],
      ["/proj/app", "/proj/app", undefined],
      ["/home/work/p", "/home/work/p", "/home/work/p/.cnx.json"],
      ["/home/work/r", "/home/work/r", undefined],
      ["/home/work/q", "/home", "/home/.cnxrc"],
    ])("from %s, the root is %s and the config %s", (start, root, config) => {
      const fs = new MockFileSystem()
        .addFile("/proj/cnx.config.json", "{}")
        .addFile("/proj/tools/.cnxrc", "{}")
        .addFile("/proj/app/package.json", "{}")
        .addFile("/home/.cnxrc", "{}")
        .addDirectory("/home/work/p/.git")
        .addFile("/home/work/p/.cnx.json", "{}")
        .addDirectory("/home/work/r/.git");

      const read = ConfigLoader.load(start, fs)._path;

      expect(IncludeDiscovery.findProjectRoot(start, fs)).toBe(root);
      expect(read).toBe(config);
      expect(read === undefined || dirname(read) === root).toBe(true);
    });
  });

  describe("inDirectory", () => {
    it("is the first non-empty config file in that directory alone", () => {
      const fs = new MockFileSystem()
        .addFile("/p/app/cnx.config.json", " ")
        .addFile("/p/app/.cnxrc", "{}")
        .addFile("/p/.cnx.json", "{}");

      expect(ConfigLoader.inDirectory("/p/app", fs)).toEqual({
        kind: "found",
        path: "/p/app/.cnxrc",
        content: "{}",
        unreadable: [],
      });
      expect(ConfigLoader.inDirectory("/q", fs)).toEqual({
        kind: "none",
        unreadable: [],
      });
    });
  });
});
