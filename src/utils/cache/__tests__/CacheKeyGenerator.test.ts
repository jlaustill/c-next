/**
 * Unit tests for CacheKeyGenerator.
 * Tests cache key generation and validation for file-based caching.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import CacheKeyGenerator from "../CacheKeyGenerator";

describe("CacheKeyGenerator", () => {
  let testDir: string;
  let testFile: string;

  beforeEach(() => {
    // Create a unique test directory for each test
    testDir = join(tmpdir(), `cache-key-test-${Date.now()}-${Math.random()}`);
    mkdirSync(testDir, { recursive: true });
    testFile = join(testDir, "test.h");
    writeFileSync(testFile, "// test content");
  });

  afterEach(() => {
    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("generate", () => {
    it("should generate mtime-based key", () => {
      const key = CacheKeyGenerator.generate(testFile);
      expect(key).toMatch(/^mtime:\d+(\.\d+)?$/);
    });

    it("should generate consistent key for unchanged file", () => {
      const key1 = CacheKeyGenerator.generate(testFile);
      const key2 = CacheKeyGenerator.generate(testFile);
      expect(key1).toBe(key2);
    });

    it("should throw for non-existent file", () => {
      expect(() => {
        CacheKeyGenerator.generate("/no/such/file.h");
      }).toThrow();
    });
  });

  describe("isValid", () => {
    it("should validate unchanged file", () => {
      const key = CacheKeyGenerator.generate(testFile);
      expect(CacheKeyGenerator.isValid(testFile, key)).toBe(true);
    });

    it("should invalidate when file changes", async () => {
      const key = CacheKeyGenerator.generate(testFile);

      // Wait a bit and modify the file to ensure mtime changes
      await new Promise((resolve) => setTimeout(resolve, 10));
      writeFileSync(testFile, "// modified content");

      expect(CacheKeyGenerator.isValid(testFile, key)).toBe(false);
    });

    it("should return false for non-existent file", () => {
      expect(CacheKeyGenerator.isValid("/no/such/file.h", "mtime:123")).toBe(
        false,
      );
    });

    it("should return false for mismatched key", () => {
      expect(CacheKeyGenerator.isValid(testFile, "mtime:0")).toBe(false);
    });

    it("should return false for malformed key", () => {
      expect(CacheKeyGenerator.isValid(testFile, "invalid-key")).toBe(false);
    });
  });

  describe("key format", () => {
    it("should use mtime prefix", () => {
      const key = CacheKeyGenerator.generate(testFile);
      expect(key.startsWith("mtime:")).toBe(true);
    });

    it("should contain numeric timestamp after prefix", () => {
      const key = CacheKeyGenerator.generate(testFile);
      const timestamp = key.replace("mtime:", "");
      expect(Number.isFinite(parseFloat(timestamp))).toBe(true);
    });
  });

  describe("file deletion handling", () => {
    it("should invalidate after file is deleted", () => {
      const key = CacheKeyGenerator.generate(testFile);
      unlinkSync(testFile);

      expect(CacheKeyGenerator.isValid(testFile, key)).toBe(false);
    });
  });
});
