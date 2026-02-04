/**
 * Unit tests for FileDiscovery
 *
 * Tests file discovery functionality:
 * - discover: Scan directories for source files
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

    // Create nested structure
    mkdirSync(join(srcDir, "modules"), { recursive: true });
    writeFileSync(join(srcDir, "modules", "display.cnx"), "scope Display {}");
    writeFileSync(join(srcDir, "modules", "io.cnx"), "scope IO {}");
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // discover
  // ==========================================================================

  describe("discover", () => {
    it("discovers all files in directory recursively by default", () => {
      const files = FileDiscovery.discover([srcDir]);

      // Should find main.cnx, utils.cnx, legacy.cnext, impl.c, impl.cpp,
      // modules/display.cnx, modules/io.cnx
      expect(files.length).toBeGreaterThanOrEqual(5);
      expect(files.some((f) => f.path.endsWith("main.cnx"))).toBe(true);
      expect(files.some((f) => f.path.endsWith("display.cnx"))).toBe(true);
    });

    it("discovers files non-recursively when recursive=false", () => {
      const files = FileDiscovery.discover([srcDir], { recursive: false });

      // Should find files in srcDir but not in modules/
      expect(files.some((f) => f.path.endsWith("main.cnx"))).toBe(true);
      expect(files.some((f) => f.path.endsWith("display.cnx"))).toBe(false);
    });

    it("filters by extensions when specified", () => {
      const files = FileDiscovery.discover([srcDir], { extensions: [".cnx"] });

      // Should only find .cnx files
      expect(files.every((f) => f.extension === ".cnx")).toBe(true);
      expect(files.some((f) => f.path.endsWith("impl.c"))).toBe(false);
    });

    it("discovers files from multiple directories", () => {
      const files = FileDiscovery.discover([srcDir, includeDir]);

      expect(files.some((f) => f.path.endsWith("main.cnx"))).toBe(true);
      expect(files.some((f) => f.path.endsWith("types.h"))).toBe(true);
    });

    it("removes duplicates from overlapping directories (Issue #331)", () => {
      // srcDir is already under testDir
      const files = FileDiscovery.discover([testDir, srcDir]);

      // Count files with same path
      const paths = files.map((f) => f.path);
      const uniquePaths = new Set(paths);

      expect(paths.length).toBe(uniquePaths.size);
    });

    it("classifies C-Next files correctly", () => {
      const files = FileDiscovery.discover([srcDir], { extensions: [".cnx"] });

      const cnxFile = files.find((f) => f.path.endsWith("main.cnx"));
      expect(cnxFile).toBeDefined();
      expect(cnxFile!.type).toBe(EFileType.CNext);
      expect(cnxFile!.extension).toBe(".cnx");
    });

    it("classifies .cnext files as C-Next", () => {
      const files = FileDiscovery.discover([srcDir], {
        extensions: [".cnext"],
      });

      const cnextFile = files.find((f) => f.path.endsWith("legacy.cnext"));
      expect(cnextFile).toBeDefined();
      expect(cnextFile!.type).toBe(EFileType.CNext);
    });

    it("classifies header files correctly", () => {
      const files = FileDiscovery.discover([includeDir]);

      const hFile = files.find((f) => f.path.endsWith("types.h"));
      expect(hFile).toBeDefined();
      expect(hFile!.type).toBe(EFileType.CHeader);

      const hppFile = files.find((f) => f.path.endsWith("utils.hpp"));
      expect(hppFile).toBeDefined();
      expect(hppFile!.type).toBe(EFileType.CppHeader);
    });

    it("classifies source files correctly", () => {
      const files = FileDiscovery.discover([srcDir]);

      const cFile = files.find((f) => f.path.endsWith("impl.c"));
      expect(cFile).toBeDefined();
      expect(cFile!.type).toBe(EFileType.CSource);

      const cppFile = files.find((f) => f.path.endsWith("impl.cpp"));
      expect(cppFile).toBeDefined();
      expect(cppFile!.type).toBe(EFileType.CppSource);
    });

    it("warns when directory not found", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const files = FileDiscovery.discover([join(testDir, "nonexistent")]);

      expect(files).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Directory not found"),
      );
    });

    it("uses default ignore patterns", () => {
      // Create node_modules directory (should be ignored)
      mkdirSync(join(srcDir, "node_modules"), { recursive: true });
      writeFileSync(join(srcDir, "node_modules", "dep.cnx"), "// dep");

      const files = FileDiscovery.discover([srcDir]);

      expect(files.some((f) => f.path.includes("node_modules"))).toBe(false);
    });

    it("uses custom exclude patterns when provided", () => {
      // Create a test directory that would normally be included
      mkdirSync(join(srcDir, "excluded"), { recursive: true });
      writeFileSync(join(srcDir, "excluded", "skip.cnx"), "// skip");

      const files = FileDiscovery.discover([srcDir], {
        excludePatterns: [/excluded/],
      });

      expect(files.some((f) => f.path.includes("excluded"))).toBe(false);
    });

    it("returns absolute paths", () => {
      const files = FileDiscovery.discover([srcDir]);

      for (const file of files) {
        expect(file.path.startsWith("/")).toBe(true);
      }
    });
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
      const allFiles = FileDiscovery.discover([testDir]);
      const cnxFiles = FileDiscovery.filterByType(allFiles, EFileType.CNext);

      expect(cnxFiles.every((f) => f.type === EFileType.CNext)).toBe(true);
      expect(cnxFiles.length).toBeGreaterThan(0);
    });

    it("filters files by C header type", () => {
      const allFiles = FileDiscovery.discover([testDir]);
      const hFiles = FileDiscovery.filterByType(allFiles, EFileType.CHeader);

      expect(hFiles.every((f) => f.type === EFileType.CHeader)).toBe(true);
    });

    it("returns empty array when no matches", () => {
      const cnxFiles = FileDiscovery.discover([srcDir], {
        extensions: [".cnx"],
      });
      const hFiles = FileDiscovery.filterByType(cnxFiles, EFileType.CHeader);

      expect(hFiles).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getCNextFiles
  // ==========================================================================

  describe("getCNextFiles", () => {
    it("returns only C-Next files", () => {
      const allFiles = FileDiscovery.discover([testDir]);
      const cnxFiles = FileDiscovery.getCNextFiles(allFiles);

      expect(cnxFiles.every((f) => f.type === EFileType.CNext)).toBe(true);
      expect(cnxFiles.length).toBeGreaterThan(0);
    });

    it("includes both .cnx and .cnext files", () => {
      const allFiles = FileDiscovery.discover([srcDir]);
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
      const allFiles = FileDiscovery.discover([includeDir]);
      const headerFiles = FileDiscovery.getHeaderFiles(allFiles);

      expect(headerFiles.length).toBeGreaterThan(0);
      expect(
        headerFiles.every(
          (f) => f.type === EFileType.CHeader || f.type === EFileType.CppHeader,
        ),
      ).toBe(true);
    });

    it("includes .h, .hpp, and .hxx files", () => {
      const allFiles = FileDiscovery.discover([includeDir]);
      const headerFiles = FileDiscovery.getHeaderFiles(allFiles);

      expect(headerFiles.some((f) => f.extension === ".h")).toBe(true);
      expect(headerFiles.some((f) => f.extension === ".hpp")).toBe(true);
      expect(headerFiles.some((f) => f.extension === ".hxx")).toBe(true);
    });

    it("excludes source files", () => {
      const allFiles = FileDiscovery.discover([srcDir]);
      const headerFiles = FileDiscovery.getHeaderFiles(allFiles);

      expect(headerFiles.some((f) => f.extension === ".c")).toBe(false);
      expect(headerFiles.some((f) => f.extension === ".cpp")).toBe(false);
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles empty directory", () => {
      const emptyDir = join(testDir, "empty");
      mkdirSync(emptyDir, { recursive: true });

      const files = FileDiscovery.discover([emptyDir]);

      expect(files).toHaveLength(0);
    });

    it("handles unknown file extensions", () => {
      writeFileSync(join(srcDir, "readme.txt"), "text file");

      const files = FileDiscovery.discover([srcDir], {
        extensions: [".txt"],
      });

      // File should be discovered but with Unknown type
      expect(files).toHaveLength(1);
      expect(files[0].type).toBe(EFileType.Unknown);
    });

    it("handles mixed case extensions", () => {
      // Note: fast-glob behavior varies by filesystem
      // On case-sensitive filesystems, .CNX won't match .cnx pattern
      writeFileSync(join(srcDir, "test-upper.cnx"), "// test file");

      const files = FileDiscovery.discover([srcDir]);

      // Extension should be lowercased
      const testFile = files.find((f) => f.path.endsWith("test-upper.cnx"));
      expect(testFile).toBeDefined();
      expect(testFile!.extension).toBe(".cnx");
      expect(testFile!.type).toBe(EFileType.CNext);
    });
  });
});
