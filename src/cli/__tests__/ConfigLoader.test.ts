/**
 * Unit tests for ConfigLoader
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ConfigLoader from "../ConfigLoader";
import ConfigFileNames from "../../cnx/PARSE/1-Discover/ConfigFileNames";
import IFileConfig from "../types/IFileConfig";
import MockFileSystem from "./MockFileSystem";
import IFileSystem from "../../cnx/types/IFileSystem";

/** The config `load` found from `startDir`, which must not be E0918. */
function loaded(startDir: string, fs?: IFileSystem): IFileConfig {
  const result = ConfigLoader.load(startDir, fs);
  if (result.kind !== "loaded") {
    throw new Error(`expected a config, got ${JSON.stringify(result.errors)}`);
  }
  return result.config;
}

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
      const config = loaded(tempDir);
      expect(config).toEqual({});
    });

    it.each([
      ["cnx.config.json", { cppRequired: true, target: "teensy41" }],
      [".cnx.json", { noCache: true }],
      [".cnxrc", { debugMode: true }],
    ])("loads %s when present", (name, settings) => {
      writeFileSync(join(tempDir, name), JSON.stringify(settings));

      const config = loaded(tempDir);

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

      const config = loaded(tempDir);

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

      const config = loaded(tempDir);

      expect(config.target).toBe("from-cnx-json");
    });

    it("skips an empty config file and keeps searching upward", () => {
      // cosmiconfig's default (ignoreEmptySearchPlaces), kept by #1653's
      // replacement: an empty file is not a config, so the search continues.
      const subDir = join(tempDir, "app");
      mkdirSync(subDir, { recursive: true });
      writeFileSync(join(subDir, "cnx.config.json"), "  \n");
      writeFileSync(
        join(tempDir, ".cnxrc"),
        JSON.stringify({ target: "found-above-the-empty-one" }),
      );

      const config = loaded(subDir);

      expect(config.target).toBe("found-above-the-empty-one");
      expect(config._path).toBe(join(tempDir, ".cnxrc"));
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

      const config = loaded(subDir);

      expect(config.target).toBe("found-in-parent");
      expect(config._path).toBe(join(tempDir, "cnx.config.json"));
    });

    // #1826 review: cosmiconfig skipped a config it could not read and kept
    // searching; the replacement let EACCES escape and abort the run.
    it("skips an unreadable config with a warning and keeps searching upward", () => {
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

      const config = loaded("/p/app", unreadable);

      expect(config.target).toBe("from-parent");
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

        expect(loaded("/p", fs)).toEqual({});
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

      const config = loaded(tempDir);

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

      const config = loaded(tempDir);

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

        const config = loaded(tempDir);

        expect(config.headerOut).toBe(join(tempDir, "include"));
      });

      it("resolves headerOut to the same path when loaded from a nested directory", () => {
        const subDir = join(tempDir, "src");
        mkdirSync(subDir, { recursive: true });
        writeFileSync(
          join(tempDir, "cnx.config.json"),
          JSON.stringify({ headerOut: "include" }),
        );

        const fromRoot = loaded(tempDir);
        const fromSubDir = loaded(subDir);

        expect(fromSubDir.headerOut).toBe(join(tempDir, "include"));
        expect(fromSubDir.headerOut).toBe(fromRoot.headerOut);
      });

      it("resolves output against the config file's directory", () => {
        writeFileSync(
          join(tempDir, "cnx.config.json"),
          JSON.stringify({ output: "build" }),
        );

        const config = loaded(tempDir);

        expect(config.output).toBe(join(tempDir, "build"));
      });

      it("resolves include entries against the config file's directory", () => {
        const subDir = join(tempDir, "src");
        mkdirSync(subDir, { recursive: true });
        writeFileSync(
          join(tempDir, "cnx.config.json"),
          JSON.stringify({ include: ["vendor", ".pio/libdeps"] }),
        );

        const config = loaded(subDir);

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

        const config = loaded(tempDir);

        expect(config.include).toEqual([join(tempDir, "vendor")]);
      });

      it("leaves an absolute headerOut unchanged", () => {
        writeFileSync(
          join(tempDir, "cnx.config.json"),
          JSON.stringify({ headerOut: "/opt/generated/include" }),
        );

        const config = loaded(tempDir);

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

        const config = loaded(tempDir);

        expect(config.headerOut).toBe(join(home, "generated"));
      });
    });
  });

  // #2165: a config under an old name is E0918, never read and never skipped
  describe("old config file names", () => {
    it.each([
      ["cnext.config.json", "cnx.config.json"],
      [".cnext.json", ".cnx.json"],
      [".cnextrc", ".cnxrc"],
    ])("%s is E0918, naming %s", (oldName, successor) => {
      const fs = new MockFileSystem().addFile(`/p/${oldName}`, "{}");

      expect(ConfigLoader.load("/p", fs)).toEqual({
        kind: "renamed",
        errors: [
          ConfigFileNames.errorFor({
            path: `/p/${oldName}`,
            successor,
            besideConfig: null,
          }),
        ],
      });
    });

    it("is E0918 beside a new-name config, rather than reading the new one", () => {
      const fs = new MockFileSystem()
        .addFile("/p/cnx.config.json", JSON.stringify({ target: "new" }))
        .addFile("/p/cnext.config.json", JSON.stringify({ target: "old" }));

      expect(ConfigLoader.load("/p", fs)).toEqual({
        kind: "renamed",
        errors: [
          ConfigFileNames.errorFor({
            path: "/p/cnext.config.json",
            successor: "cnx.config.json",
            besideConfig: "/p/cnx.config.json",
          }),
        ],
      });
    });

    it("is E0918 for an empty old-name file, which a new name would skip", () => {
      const fs = new MockFileSystem()
        .addFile("/p/app/.cnextrc", "")
        .addFile("/p/cnx.config.json", JSON.stringify({ target: "above" }));

      expect(ConfigLoader.load("/p/app", fs).kind).toBe("renamed");
    });

    it("is E0918 below a new-name config: the walk reaches the old file first", () => {
      const fs = new MockFileSystem()
        .addFile("/p/app/cnext.config.json", "{}")
        .addFile("/p/cnx.config.json", JSON.stringify({ target: "above" }));

      expect(ConfigLoader.load("/p/app", fs).kind).toBe("renamed");
    });

    it("never reaches an old name above the config it loads", () => {
      const fs = new MockFileSystem()
        .addFile("/p/app/cnx.config.json", JSON.stringify({ target: "near" }))
        .addFile("/p/cnext.config.json", JSON.stringify({ target: "far" }));

      expect(loaded("/p/app", fs).target).toBe("near");
    });
  });

  describe("inDirectory", () => {
    it("is the first non-empty new-name config in that directory alone", () => {
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
