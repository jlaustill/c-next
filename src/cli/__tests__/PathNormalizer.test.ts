/**
 * Unit tests for PathNormalizer
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import PathNormalizer from "../PathNormalizer";
import NodeFileSystem from "../../transpiler/NodeFileSystem";

describe("PathNormalizer", () => {
  describe("expandTilde", () => {
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;

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
});
