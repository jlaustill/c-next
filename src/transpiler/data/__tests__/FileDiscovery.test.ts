/**
 * Unit tests for FileDiscovery
 *
 * Tests file discovery functionality:
 * - discoverFile: Discover single file
 * - discoverFiles: Discover multiple files
 * - filterByType, getCNextFiles, getHeaderFiles: Filter utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import FileDiscovery from "../FileDiscovery";
import EFileType from "../types/EFileType";

describe("FileDiscovery", () => {
  const testDir = join(__dirname, "__test_file_discovery__");
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
      const file = FileDiscovery.discoverFile(join(srcDir, "main.cnx"));

      expect(file).not.toBeNull();
      expect(file!.path).toBe(resolve(srcDir, "main.cnx"));
      expect(file!.type).toBe(EFileType.CNext);
    });

    it("returns null for non-existing file", () => {
      const file = FileDiscovery.discoverFile(join(srcDir, "nonexistent.cnx"));

      expect(file).toBeNull();
    });

    it("returns null for directory path", () => {
      const file = FileDiscovery.discoverFile(srcDir);

      expect(file).toBeNull();
    });

    it("classifies file type correctly", () => {
      const cnxFile = FileDiscovery.discoverFile(join(srcDir, "main.cnx"));
      const hFile = FileDiscovery.discoverFile(join(includeDir, "types.h"));
      const cppFile = FileDiscovery.discoverFile(join(srcDir, "impl.cpp"));

      expect(cnxFile!.type).toBe(EFileType.CNext);
      expect(hFile!.type).toBe(EFileType.CHeader);
      expect(cppFile!.type).toBe(EFileType.CppSource);
    });

    it("resolves relative paths to absolute", () => {
      const file = FileDiscovery.discoverFile(join(srcDir, "main.cnx"));

      expect(file).not.toBeNull();
      expect(file!.path.startsWith("/")).toBe(true);
    });
  });

  // ==========================================================================
  // discoverFiles
  // ==========================================================================

  describe("discoverFiles", () => {
    it("discovers multiple existing files", () => {
      const files = FileDiscovery.discoverFiles([
        join(srcDir, "main.cnx"),
        join(srcDir, "utils.cnx"),
        join(includeDir, "types.h"),
      ]);

      expect(files).toHaveLength(3);
    });

    it("warns and skips non-existing files", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const files = FileDiscovery.discoverFiles([
        join(srcDir, "main.cnx"),
        join(srcDir, "nonexistent.cnx"),
      ]);

      expect(files).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("File not found"),
      );
    });

    it("returns empty array for empty input", () => {
      const files = FileDiscovery.discoverFiles([]);

      expect(files).toHaveLength(0);
    });

    it("handles all non-existing files", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const files = FileDiscovery.discoverFiles([
        join(srcDir, "nonexistent1.cnx"),
        join(srcDir, "nonexistent2.cnx"),
      ]);

      expect(files).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // filterByType
  // ==========================================================================

  describe("filterByType", () => {
    it("filters files by C-Next type", () => {
      const allFiles = FileDiscovery.discoverFiles([
        join(srcDir, "main.cnx"),
        join(srcDir, "utils.cnx"),
        join(srcDir, "legacy.cnext"),
        join(srcDir, "impl.c"),
        join(srcDir, "impl.cpp"),
        join(includeDir, "types.h"),
      ]);
      const cnxFiles = FileDiscovery.filterByType(allFiles, EFileType.CNext);

      expect(cnxFiles.every((f) => f.type === EFileType.CNext)).toBe(true);
      expect(cnxFiles.length).toBeGreaterThan(0);
    });

    it("filters files by C header type", () => {
      const allFiles = FileDiscovery.discoverFiles([
        join(srcDir, "main.cnx"),
        join(includeDir, "types.h"),
        join(includeDir, "utils.hpp"),
      ]);
      const hFiles = FileDiscovery.filterByType(allFiles, EFileType.CHeader);

      expect(hFiles.every((f) => f.type === EFileType.CHeader)).toBe(true);
    });

    it("returns empty array when no matches", () => {
      const cnxFiles = FileDiscovery.discoverFiles([
        join(srcDir, "main.cnx"),
        join(srcDir, "utils.cnx"),
      ]);
      const hFiles = FileDiscovery.filterByType(cnxFiles, EFileType.CHeader);

      expect(hFiles).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getCNextFiles
  // ==========================================================================

  describe("getCNextFiles", () => {
    it("returns only C-Next files", () => {
      const allFiles = FileDiscovery.discoverFiles([
        join(srcDir, "main.cnx"),
        join(srcDir, "utils.cnx"),
        join(srcDir, "legacy.cnext"),
        join(srcDir, "impl.c"),
        join(includeDir, "types.h"),
      ]);
      const cnxFiles = FileDiscovery.getCNextFiles(allFiles);

      expect(cnxFiles.every((f) => f.type === EFileType.CNext)).toBe(true);
      expect(cnxFiles.length).toBeGreaterThan(0);
    });

    it("includes both .cnx and .cnext files", () => {
      const allFiles = FileDiscovery.discoverFiles([
        join(srcDir, "main.cnx"),
        join(srcDir, "utils.cnx"),
        join(srcDir, "legacy.cnext"),
      ]);
      const cnxFiles = FileDiscovery.getCNextFiles(allFiles);

      // Should include both main.cnx and legacy.cnext
      expect(cnxFiles.some((f) => f.extension === ".cnx")).toBe(true);
      expect(cnxFiles.some((f) => f.extension === ".cnext")).toBe(true);
    });
  });

  // ==========================================================================
  // getHeaderFiles
  // ==========================================================================

  describe("getHeaderFiles", () => {
    it("returns C and C++ header files", () => {
      const allFiles = FileDiscovery.discoverFiles([
        join(includeDir, "types.h"),
        join(includeDir, "utils.hpp"),
        join(includeDir, "config.hxx"),
        join(srcDir, "impl.c"),
      ]);
      const headerFiles = FileDiscovery.getHeaderFiles(allFiles);

      expect(headerFiles.length).toBeGreaterThan(0);
      expect(
        headerFiles.every(
          (f) => f.type === EFileType.CHeader || f.type === EFileType.CppHeader,
        ),
      ).toBe(true);
    });

    it("includes .h, .hpp, and .hxx files", () => {
      const allFiles = FileDiscovery.discoverFiles([
        join(includeDir, "types.h"),
        join(includeDir, "utils.hpp"),
        join(includeDir, "config.hxx"),
      ]);
      const headerFiles = FileDiscovery.getHeaderFiles(allFiles);

      expect(headerFiles.some((f) => f.extension === ".h")).toBe(true);
      expect(headerFiles.some((f) => f.extension === ".hpp")).toBe(true);
      expect(headerFiles.some((f) => f.extension === ".hxx")).toBe(true);
    });

    it("excludes source files", () => {
      const allFiles = FileDiscovery.discoverFiles([
        join(srcDir, "impl.c"),
        join(srcDir, "impl.cpp"),
        join(includeDir, "types.h"),
      ]);
      const headerFiles = FileDiscovery.getHeaderFiles(allFiles);

      expect(headerFiles.some((f) => f.extension === ".c")).toBe(false);
      expect(headerFiles.some((f) => f.extension === ".cpp")).toBe(false);
    });
  });
});
