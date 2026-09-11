/**
 * Unit tests for ConfigLoader
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ConfigLoader from "../ConfigLoader";

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

    it("loads cnext.config.json when present", () => {
      const configContent = { cppRequired: true, target: "teensy41" };
      writeFileSync(
        join(tempDir, "cnext.config.json"),
        JSON.stringify(configContent),
      );

      const config = ConfigLoader.load(tempDir);

      expect(config.cppRequired).toBe(true);
      expect(config.target).toBe("teensy41");
      expect(config._path).toBe(join(tempDir, "cnext.config.json"));
    });

    it("loads .cnext.json when present", () => {
      const configContent = { noCache: true };
      writeFileSync(
        join(tempDir, ".cnext.json"),
        JSON.stringify(configContent),
      );

      const config = ConfigLoader.load(tempDir);

      expect(config.noCache).toBe(true);
      expect(config._path).toBe(join(tempDir, ".cnext.json"));
    });

    it("loads .cnextrc when present", () => {
      const configContent = { debugMode: true };
      writeFileSync(join(tempDir, ".cnextrc"), JSON.stringify(configContent));

      const config = ConfigLoader.load(tempDir);

      expect(config.debugMode).toBe(true);
      expect(config._path).toBe(join(tempDir, ".cnextrc"));
    });

    it("prefers cnext.config.json over .cnext.json", () => {
      writeFileSync(
        join(tempDir, "cnext.config.json"),
        JSON.stringify({ target: "from-config" }),
      );
      writeFileSync(
        join(tempDir, ".cnext.json"),
        JSON.stringify({ target: "from-cnext" }),
      );

      const config = ConfigLoader.load(tempDir);

      expect(config.target).toBe("from-config");
    });

    it("prefers .cnext.json over .cnextrc", () => {
      writeFileSync(
        join(tempDir, ".cnext.json"),
        JSON.stringify({ target: "from-cnext" }),
      );
      writeFileSync(
        join(tempDir, ".cnextrc"),
        JSON.stringify({ target: "from-rc" }),
      );

      const config = ConfigLoader.load(tempDir);

      expect(config.target).toBe("from-cnext");
    });

    it("searches up the directory tree", () => {
      // Create nested directory structure
      const subDir = join(tempDir, "src", "components");
      const { mkdirSync } = require("node:fs");
      mkdirSync(subDir, { recursive: true });

      // Put config in root
      writeFileSync(
        join(tempDir, "cnext.config.json"),
        JSON.stringify({ target: "found-in-parent" }),
      );

      const config = ConfigLoader.load(subDir);

      expect(config.target).toBe("found-in-parent");
      expect(config._path).toBe(join(tempDir, "cnext.config.json"));
    });

    it("returns empty object and logs warning for invalid JSON", () => {
      writeFileSync(join(tempDir, "cnext.config.json"), "{ invalid json }");

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
        join(tempDir, "cnext.config.json"),
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
          join(tempDir, "cnext.config.json"),
          JSON.stringify({ headerOut: "include" }),
        );

        const config = ConfigLoader.load(tempDir);

        expect(config.headerOut).toBe(join(tempDir, "include"));
      });

      it("resolves headerOut to the same path when loaded from a nested directory", () => {
        const subDir = join(tempDir, "src");
        mkdirSync(subDir, { recursive: true });
        writeFileSync(
          join(tempDir, "cnext.config.json"),
          JSON.stringify({ headerOut: "include" }),
        );

        const fromRoot = ConfigLoader.load(tempDir);
        const fromSubDir = ConfigLoader.load(subDir);

        expect(fromSubDir.headerOut).toBe(join(tempDir, "include"));
        expect(fromSubDir.headerOut).toBe(fromRoot.headerOut);
      });

      it("resolves output against the config file's directory", () => {
        writeFileSync(
          join(tempDir, "cnext.config.json"),
          JSON.stringify({ output: "build" }),
        );

        const config = ConfigLoader.load(tempDir);

        expect(config.output).toBe(join(tempDir, "build"));
      });

      it("resolves include entries against the config file's directory", () => {
        const subDir = join(tempDir, "src");
        mkdirSync(subDir, { recursive: true });
        writeFileSync(
          join(tempDir, "cnext.config.json"),
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
          join(tempDir, "cnext.config.json"),
          JSON.stringify({ include: ["", "vendor"] }),
        );

        const config = ConfigLoader.load(tempDir);

        expect(config.include).toEqual([join(tempDir, "vendor")]);
      });

      it("leaves an absolute headerOut unchanged", () => {
        writeFileSync(
          join(tempDir, "cnext.config.json"),
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
          join(tempDir, "cnext.config.json"),
          JSON.stringify({ headerOut: "~/generated" }),
        );

        const config = ConfigLoader.load(tempDir);

        expect(config.headerOut).toBe(join(home, "generated"));
      });
    });
  });
});
