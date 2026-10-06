/**
 * Unit tests for FileDiscovery
 *
 * Tests file discovery functionality:
 * - discoverFile: Discover single file
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import FileDiscovery from "../FileDiscovery";
import EFileType from "../types/EFileType";
import NodeFileSystem from "../NodeFileSystem";

describe("FileDiscovery", () => {
  // #1640: NOT under `src/`. A test that writes into the tree another
  // test scans is the coupling -- `tmpdir()` has no scanner. The pid
  // suffix keeps concurrent runs apart, which being under `__dirname`
  // used to provide by accident.
  const testDir = join(tmpdir(), `cnx-file-discovery-${process.pid}`);
  const srcDir = join(testDir, "src");
  const includeDir = join(testDir, "include");

  beforeEach(() => {
    // Create test directory structure
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(includeDir, { recursive: true });

    // Create C-Next files
    writeFileSync(join(srcDir, "main.cnx"), "void main() {}");
    writeFileSync(join(srcDir, "utils.cnx"), "scope Utils {}");
    writeFileSync(join(srcDir, "legacy.cnext"), "// legacy extension");

    // Create header files
    writeFileSync(join(includeDir, "types.h"), "typedef int MyInt;");
    writeFileSync(join(includeDir, "utils.hpp"), "namespace Utils {}");
    writeFileSync(join(includeDir, "config.hxx"), "struct Config {};");

    // Create source files
    writeFileSync(join(srcDir, "impl.c"), "int main() {}");
    writeFileSync(join(srcDir, "impl.cpp"), "int main() {}");
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // discoverFile
  // ==========================================================================

  describe("discoverFile", () => {
    it("returns discovered file for existing file", () => {
      const file = FileDiscovery.discoverFile(
        join(srcDir, "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(file).not.toBeNull();
      expect(file!.path).toBe(resolve(srcDir, "main.cnx"));
      expect(file!.type).toBe(EFileType.CNext);
    });

    it("returns null for non-existing file", () => {
      const file = FileDiscovery.discoverFile(
        join(srcDir, "nonexistent.cnx"),
        NodeFileSystem.instance,
      );

      expect(file).toBeNull();
    });

    it("returns null for directory path", () => {
      const file = FileDiscovery.discoverFile(srcDir, NodeFileSystem.instance);

      expect(file).toBeNull();
    });

    it("classifies file type correctly", () => {
      const cnxFile = FileDiscovery.discoverFile(
        join(srcDir, "main.cnx"),
        NodeFileSystem.instance,
      );
      const hFile = FileDiscovery.discoverFile(
        join(includeDir, "types.h"),
        NodeFileSystem.instance,
      );
      const cppFile = FileDiscovery.discoverFile(
        join(srcDir, "impl.cpp"),
        NodeFileSystem.instance,
      );

      expect(cnxFile!.type).toBe(EFileType.CNext);
      expect(hFile!.type).toBe(EFileType.CHeader);
      expect(cppFile!.type).toBe(EFileType.CppSource);
    });

    it("resolves relative paths to absolute", () => {
      const file = FileDiscovery.discoverFile(
        join(srcDir, "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(file).not.toBeNull();
      expect(file!.path.startsWith("/")).toBe(true);
    });
  });
});
