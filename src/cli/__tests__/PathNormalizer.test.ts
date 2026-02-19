/**
 * Unit tests for PathNormalizer
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import PathNormalizer from "../PathNormalizer";
import NodeFileSystem from "../../transpiler/NodeFileSystem";
import IFileSystem from "../../transpiler/types/IFileSystem";
import ICliConfig from "../types/ICliConfig";

// Store original environment variables at module level for all tests
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

describe("PathNormalizer", () => {
  describe("expandTilde", () => {
    beforeEach(() => {
      process.env.HOME = "/home/testuser";
      process.env.USERPROFILE = "C:\\Users\\testuser";
    });

    afterEach(() => {
      process.env.HOME = originalHome;
      process.env.USERPROFILE = originalUserProfile;
    });

    it("expands ~/path to home directory path", () => {
      const result = PathNormalizer.expandTilde("~/foo/bar");
      expect(result).toBe("/home/testuser/foo/bar");
    });

    it("expands bare ~ to home directory", () => {
      const result = PathNormalizer.expandTilde("~");
      expect(result).toBe("/home/testuser");
    });

    it("leaves absolute paths unchanged", () => {
      const result = PathNormalizer.expandTilde("/abs/path");
      expect(result).toBe("/abs/path");
    });

    it("leaves relative paths unchanged", () => {
      const result = PathNormalizer.expandTilde("relative/path");
      expect(result).toBe("relative/path");
    });

    it("leaves mid-path tilde unchanged", () => {
      const result = PathNormalizer.expandTilde("/foo/~/bar");
      expect(result).toBe("/foo/~/bar");
    });

    it("uses USERPROFILE when HOME is not set", () => {
      delete process.env.HOME;
      const result = PathNormalizer.expandTilde("~/docs");
      expect(result).toBe("C:\\Users\\testuser/docs");
    });

    it("returns path unchanged when no home env is set", () => {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
      const result = PathNormalizer.expandTilde("~/docs");
      expect(result).toBe("~/docs");
    });
  });

  describe("expandRecursive", () => {
    let tempDir: string;
    const fs = NodeFileSystem.instance;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "pathnorm-test-"));
      // Create nested directory structure:
      // tempDir/
      //   a/
      //     a1/
      //     a2/
      //   b/
      mkdirSync(join(tempDir, "a", "a1"), { recursive: true });
      mkdirSync(join(tempDir, "a", "a2"), { recursive: true });
      mkdirSync(join(tempDir, "b"), { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("returns single-element array for path without ** suffix", () => {
      const result = PathNormalizer.expandRecursive(tempDir, fs);
      expect(result).toEqual([tempDir]);
    });

    it("expands path/** to all subdirectories", () => {
      const result = PathNormalizer.expandRecursive(`${tempDir}/**`, fs);
      expect(result).toContain(tempDir);
      expect(result).toContain(join(tempDir, "a"));
      expect(result).toContain(join(tempDir, "a", "a1"));
      expect(result).toContain(join(tempDir, "a", "a2"));
      expect(result).toContain(join(tempDir, "b"));
      expect(result).toHaveLength(5);
    });

    it("returns empty array for nonexistent path with **", () => {
      const result = PathNormalizer.expandRecursive("/nonexistent/path/**", fs);
      expect(result).toEqual([]);
    });

    it("returns empty array for nonexistent path without **", () => {
      const result = PathNormalizer.expandRecursive("/nonexistent/path", fs);
      expect(result).toEqual([]);
    });

    it("returns single-element array if path is a file", () => {
      const filePath = join(tempDir, "file.txt");
      writeFileSync(filePath, "content");
      const result = PathNormalizer.expandRecursive(filePath, fs);
      expect(result).toEqual([filePath]);
    });
  });

  describe("normalizePath", () => {
    beforeEach(() => {
      process.env.HOME = "/home/testuser";
    });

    afterEach(() => {
      process.env.HOME = originalHome;
    });

    it("expands tilde in path", () => {
      const result = PathNormalizer.normalizePath("~/output");
      expect(result).toBe("/home/testuser/output");
    });

    it("leaves absolute path unchanged", () => {
      const result = PathNormalizer.normalizePath("/abs/path");
      expect(result).toBe("/abs/path");
    });

    it("handles empty string", () => {
      const result = PathNormalizer.normalizePath("");
      expect(result).toBe("");
    });
  });

  describe("normalizeIncludePaths", () => {
    let tempDir: string;
    const fs = NodeFileSystem.instance;

    beforeEach(() => {
      process.env.HOME = "/home/testuser";
      tempDir = mkdtempSync(join(tmpdir(), "pathnorm-include-"));
      mkdirSync(join(tempDir, "sub1"), { recursive: true });
      mkdirSync(join(tempDir, "sub2"), { recursive: true });
    });

    afterEach(() => {
      process.env.HOME = originalHome;
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("expands tilde in all paths", () => {
      // Use mock fs for tilde paths since they won't exist
      const mockFs: IFileSystem = {
        exists: (p) => p === "/home/testuser/a" || p === "/home/testuser/b",
        isDirectory: (p) =>
          p === "/home/testuser/a" || p === "/home/testuser/b",
        readdir: () => [],
        readFile: () => "",
        writeFile: () => {},
        mkdir: () => {},
        isFile: () => false,
        stat: () => ({ mtimeMs: 0 }),
      };
      const result = PathNormalizer.normalizeIncludePaths(
        ["~/a", "~/b"],
        mockFs,
      );
      expect(result).toEqual(["/home/testuser/a", "/home/testuser/b"]);
    });

    it("expands ** in paths", () => {
      const result = PathNormalizer.normalizeIncludePaths(
        [`${tempDir}/**`],
        fs,
      );
      expect(result).toContain(tempDir);
      expect(result).toContain(join(tempDir, "sub1"));
      expect(result).toContain(join(tempDir, "sub2"));
    });

    it("handles mixed paths with tilde and **", () => {
      const result = PathNormalizer.normalizeIncludePaths(
        [tempDir, `${tempDir}/**`],
        fs,
      );
      expect(result).toContain(tempDir);
      expect(result).toContain(join(tempDir, "sub1"));
    });

    it("filters out nonexistent paths", () => {
      const result = PathNormalizer.normalizeIncludePaths(
        ["/nonexistent", tempDir],
        fs,
      );
      expect(result).toEqual([tempDir]);
    });

    it("returns empty array for empty input", () => {
      const result = PathNormalizer.normalizeIncludePaths([], fs);
      expect(result).toEqual([]);
    });

    it("deduplicates paths", () => {
      const result = PathNormalizer.normalizeIncludePaths(
        [tempDir, tempDir, join(tempDir, "sub1"), tempDir],
        fs,
      );
      // Each path appears only once, order preserved
      expect(result).toEqual([tempDir, join(tempDir, "sub1")]);
    });

    it("deduplicates paths from overlapping recursive expansions", () => {
      // tempDir/** expands to [tempDir, sub1, sub2]
      // Adding tempDir explicitly shouldn't duplicate
      const result = PathNormalizer.normalizeIncludePaths(
        [tempDir, `${tempDir}/**`],
        fs,
      );
      // tempDir should appear only once
      const tempDirCount = result.filter((p) => p === tempDir).length;
      expect(tempDirCount).toBe(1);
    });
  });

  describe("expandRecursive symlink handling", () => {
    it("handles symlink loops via realpath", () => {
      const mockFs: IFileSystem = {
        exists: () => true,
        isDirectory: () => true,
        // Simulate symlink loop: dir -> subdir -> (symlink to dir)
        readdir: (dir) => {
          if (dir === "/root") return ["subdir"];
          if (dir === "/root/subdir") return ["link-to-root"];
          return [];
        },
        // realpath resolves the symlink to its target
        realpath: (path) => {
          if (path === "/root/subdir/link-to-root") return "/root";
          return path;
        },
        readFile: () => "",
        writeFile: () => {},
        mkdir: () => {},
        isFile: () => false,
        stat: () => ({ mtimeMs: 0 }),
      };

      const result = PathNormalizer.expandRecursive("/root/**", mockFs);

      // Should include /root and /root/subdir but NOT loop infinitely
      expect(result).toContain("/root");
      expect(result).toContain("/root/subdir");
      // The symlink directory is detected but already visited
      expect(result).toHaveLength(2);
    });

    it("works without realpath (graceful degradation)", () => {
      const mockFs: IFileSystem = {
        exists: () => true,
        isDirectory: (path) =>
          path === "/root" || path === "/root/sub1" || path === "/root/sub2",
        readdir: (dir) => {
          if (dir === "/root") return ["sub1", "sub2"];
          return [];
        },
        // No realpath method
        readFile: () => "",
        writeFile: () => {},
        mkdir: () => {},
        isFile: () => false,
        stat: () => ({ mtimeMs: 0 }),
      };

      const result = PathNormalizer.expandRecursive("/root/**", mockFs);

      expect(result).toContain("/root");
      expect(result).toContain("/root/sub1");
      expect(result).toContain("/root/sub2");
      expect(result).toHaveLength(3);
    });
  });

  describe("normalizeConfig", () => {
    let tempDir: string;
    const fs = NodeFileSystem.instance;

    beforeEach(() => {
      process.env.HOME = "/home/testuser";
      tempDir = mkdtempSync(join(tmpdir(), "pathnorm-config-"));
      mkdirSync(join(tempDir, "include", "sub"), { recursive: true });
    });

    afterEach(() => {
      process.env.HOME = originalHome;
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("normalizes all path fields in config", () => {
      const mockFs: IFileSystem = {
        exists: () => true,
        isDirectory: () => true,
        readdir: () => [],
        readFile: () => "",
        writeFile: () => {},
        mkdir: () => {},
        isFile: () => false,
        stat: () => ({ mtimeMs: 0 }),
      };

      const config: ICliConfig = {
        inputs: ["file.cnx"],
        outputPath: "~/build",
        includeDirs: ["~/sdk/include"],
        defines: {},
        preprocess: false,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
        headerOutDir: "~/include",
        basePath: "~/src",
      };

      const result = PathNormalizer.normalizeConfig(config, mockFs);

      expect(result.outputPath).toBe("/home/testuser/build");
      expect(result.headerOutDir).toBe("/home/testuser/include");
      expect(result.basePath).toBe("/home/testuser/src");
      expect(result.includeDirs).toEqual(["/home/testuser/sdk/include"]);
    });

    it("handles undefined optional fields", () => {
      const config: ICliConfig = {
        inputs: ["file.cnx"],
        outputPath: "",
        includeDirs: [],
        defines: {},
        preprocess: false,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
      };

      const result = PathNormalizer.normalizeConfig(config);

      expect(result.headerOutDir).toBeUndefined();
      expect(result.basePath).toBeUndefined();
    });

    it("expands ** in include paths", () => {
      const config: ICliConfig = {
        inputs: [],
        outputPath: "",
        includeDirs: [`${tempDir}/include/**`],
        defines: {},
        preprocess: false,
        verbose: false,
        cppRequired: false,
        noCache: false,
        parseOnly: false,
      };

      const result = PathNormalizer.normalizeConfig(config, fs);

      expect(result.includeDirs).toContain(join(tempDir, "include"));
      expect(result.includeDirs).toContain(join(tempDir, "include", "sub"));
    });

    it("preserves non-path fields unchanged", () => {
      const config: ICliConfig = {
        inputs: ["a.cnx", "b.cnx"],
        outputPath: "",
        includeDirs: [],
        defines: { DEBUG: true },
        preprocess: true,
        verbose: true,
        cppRequired: true,
        noCache: true,
        parseOnly: true,
        target: "teensy41",
        debugMode: true,
      };

      const result = PathNormalizer.normalizeConfig(config);

      expect(result.inputs).toEqual(["a.cnx", "b.cnx"]);
      expect(result.defines).toEqual({ DEBUG: true });
      expect(result.preprocess).toBe(true);
      expect(result.verbose).toBe(true);
      expect(result.cppRequired).toBe(true);
      expect(result.noCache).toBe(true);
      expect(result.parseOnly).toBe(true);
      expect(result.target).toBe("teensy41");
      expect(result.debugMode).toBe(true);
    });
  });
});
