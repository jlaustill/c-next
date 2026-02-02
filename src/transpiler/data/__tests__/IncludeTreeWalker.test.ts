/**
 * Unit tests for IncludeTreeWalker
 * Issue #591: Tests for the shared include tree traversal utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import IncludeTreeWalker from "../IncludeTreeWalker";
import IDiscoveredFile from "../types/IDiscoveredFile";

describe("IncludeTreeWalker", () => {
  let testDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `include-walker-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("walk", () => {
    it("calls callback for each include file", () => {
      // Create test files
      const file1 = join(testDir, "file1.cnx");
      const file2 = join(testDir, "file2.cnx");
      writeFileSync(file1, "// no includes");
      writeFileSync(file2, "// no includes");

      const callback = vi.fn();
      const includes = [{ path: file1 }, { path: file2 }];

      IncludeTreeWalker.walk(includes, [], callback);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ path: file1 }),
      );
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ path: file2 }),
      );
    });

    it("handles nested includes recursively", () => {
      // Create nested include structure: a.cnx -> b.cnx -> c.cnx
      const fileA = join(testDir, "a.cnx");
      const fileB = join(testDir, "b.cnx");
      const fileC = join(testDir, "c.cnx");

      writeFileSync(fileA, `#include "b.cnx"`);
      writeFileSync(fileB, `#include "c.cnx"`);
      writeFileSync(fileC, "// leaf node");

      const visited: string[] = [];
      const callback = (file: IDiscoveredFile) => {
        visited.push(file.path);
      };

      IncludeTreeWalker.walk([{ path: fileA }], [testDir], callback);

      expect(visited).toContain(fileA);
      expect(visited).toContain(fileB);
      expect(visited).toContain(fileC);
    });

    it("handles circular includes without infinite loop", () => {
      // Create circular: a.cnx -> b.cnx -> a.cnx
      const fileA = join(testDir, "a.cnx");
      const fileB = join(testDir, "b.cnx");

      writeFileSync(fileA, `#include "b.cnx"`);
      writeFileSync(fileB, `#include "a.cnx"`);

      const visited: string[] = [];
      const callback = (file: IDiscoveredFile) => {
        visited.push(file.path);
      };

      // Should not hang
      IncludeTreeWalker.walk([{ path: fileA }], [testDir], callback);

      // Each file should be visited exactly once
      expect(visited.filter((p) => p === fileA)).toHaveLength(1);
      expect(visited.filter((p) => p === fileB)).toHaveLength(1);
    });

    it("stops branch traversal when callback returns false", () => {
      const fileA = join(testDir, "a.cnx");
      const fileB = join(testDir, "b.cnx");

      writeFileSync(fileA, `#include "b.cnx"`);
      writeFileSync(fileB, "// leaf");

      const visited: string[] = [];
      const callback = (file: IDiscoveredFile) => {
        visited.push(file.path);
        if (file.path === fileA) return false; // Stop after a.cnx
      };

      IncludeTreeWalker.walk([{ path: fileA }], [testDir], callback);

      expect(visited).toContain(fileA);
      expect(visited).not.toContain(fileB); // Should not visit b.cnx
    });

    it("skips unreadable files gracefully", () => {
      const validFile = join(testDir, "valid.cnx");
      const missingFile = join(testDir, "missing.cnx");

      writeFileSync(validFile, "// exists");

      const callback = vi.fn();

      // Should not throw
      IncludeTreeWalker.walk(
        [{ path: validFile }, { path: missingFile }],
        [],
        callback,
      );

      // Valid file should be visited, missing file should be skipped
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ path: validFile }),
      );
    });
  });

  describe("walkFromFile", () => {
    it("walks includes starting from a file path", () => {
      const root = join(testDir, "root.cnx");
      const child = join(testDir, "child.cnx");

      writeFileSync(root, `#include "child.cnx"`);
      writeFileSync(child, "// leaf");

      const visited: string[] = [];
      const callback = (file: IDiscoveredFile) => {
        visited.push(file.path);
      };

      IncludeTreeWalker.walkFromFile(root, [testDir], callback);

      // Root is not visited (only its includes), but child is
      expect(visited).not.toContain(root);
      expect(visited).toContain(child);
    });
  });
});
