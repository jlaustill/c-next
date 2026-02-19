/**
 * Unit tests for PathNormalizer
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import PathNormalizer from "../PathNormalizer";

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
});
