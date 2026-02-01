/**
 * Unit tests for ConfigLoader
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ConfigLoader from "../ConfigLoader";

describe("ConfigLoader", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "configloader-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
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
        basePath: "src/",
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
      expect(config.include).toEqual(["lib/", "vendor/"]);
      expect(config.output).toBe("build/");
      expect(config.headerOut).toBe("include/");
      expect(config.basePath).toBe("src/");
    });
  });
});
