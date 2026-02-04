/**
 * Unit tests for IncludeDiscovery
 *
 * Tests include path discovery functionality:
 * - discoverIncludePaths: Auto-discovery of include directories
 * - findProjectRoot: Project root detection
 * - extractIncludes/extractIncludesWithInfo: Parse #include directives
 * - resolveInclude: Resolve include paths
 * - PlatformIO and Arduino library discovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import IncludeDiscovery from "../IncludeDiscovery";
import IFileSystem from "../../types/IFileSystem";

describe("IncludeDiscovery", () => {
  const testDir = join(__dirname, "__test_include_discovery__");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // findProjectRoot
  // ==========================================================================

  describe("findProjectRoot", () => {
    it("finds project root with platformio.ini", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      mkdirSync(join(testDir, "src"), { recursive: true });

      const result = IncludeDiscovery.findProjectRoot(join(testDir, "src"));

      expect(result).toBe(resolve(testDir));
    });

    it("finds project root with cnext.config.json", () => {
      writeFileSync(join(testDir, "cnext.config.json"), "{}");
      mkdirSync(join(testDir, "src"), { recursive: true });

      const result = IncludeDiscovery.findProjectRoot(join(testDir, "src"));

      expect(result).toBe(resolve(testDir));
    });

    it("finds project root with .cnext.json", () => {
      writeFileSync(join(testDir, ".cnext.json"), "{}");
      mkdirSync(join(testDir, "src"), { recursive: true });

      const result = IncludeDiscovery.findProjectRoot(join(testDir, "src"));

      expect(result).toBe(resolve(testDir));
    });

    it("finds project root with .cnextrc", () => {
      writeFileSync(join(testDir, ".cnextrc"), "{}");
      mkdirSync(join(testDir, "src"), { recursive: true });

      const result = IncludeDiscovery.findProjectRoot(join(testDir, "src"));

      expect(result).toBe(resolve(testDir));
    });

    it("finds project root with .git directory", () => {
      mkdirSync(join(testDir, ".git"), { recursive: true });
      mkdirSync(join(testDir, "src", "modules"), { recursive: true });

      const result = IncludeDiscovery.findProjectRoot(
        join(testDir, "src", "modules"),
      );

      expect(result).toBe(resolve(testDir));
    });

    it("prefers platformio.ini over other markers", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      writeFileSync(join(testDir, "cnext.config.json"), "{}");
      mkdirSync(join(testDir, "src"), { recursive: true });

      const result = IncludeDiscovery.findProjectRoot(join(testDir, "src"));

      // Should find testDir since platformio.ini is checked first
      expect(result).toBe(resolve(testDir));
    });

    it("stops at first directory with marker", () => {
      // Inner has cnext.config.json, outer has platformio.ini
      const innerDir = join(testDir, "inner");
      mkdirSync(innerDir, { recursive: true });
      writeFileSync(join(testDir, "platformio.ini"), "[env]");
      writeFileSync(join(innerDir, "cnext.config.json"), "{}");

      const result = IncludeDiscovery.findProjectRoot(innerDir);

      expect(result).toBe(resolve(innerDir));
    });

    it("returns null when no marker found", () => {
      // Use a path that walks up to filesystem root
      // This is tricky to test - the actual repo has markers
      // We test with a mock filesystem instead
      const mockFs: IFileSystem = {
        exists: () => false,
        isDirectory: () => true,
        isFile: () => false,
        readFile: () => "",
        writeFile: () => {},
        readdir: () => [],
        mkdir: () => {},
        stat: () => ({ mtimeMs: 0 }),
      };

      const result = IncludeDiscovery.findProjectRoot(
        "/some/deep/path",
        mockFs,
      );

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // extractIncludes
  // ==========================================================================

  describe("extractIncludes", () => {
    it("extracts local includes with quotes", () => {
      const content = `
        #include "types.h"
        #include "utils/helper.h"
      `;

      const includes = IncludeDiscovery.extractIncludes(content);

      expect(includes).toContain("types.h");
      expect(includes).toContain("utils/helper.h");
    });

    it("extracts system includes with angle brackets", () => {
      const content = `
        #include <stdio.h>
        #include <Arduino.h>
      `;

      const includes = IncludeDiscovery.extractIncludes(content);

      expect(includes).toContain("stdio.h");
      expect(includes).toContain("Arduino.h");
    });

    it("extracts mixed include styles", () => {
      const content = `
        #include "local.h"
        #include <system.h>
        #include "another/path.h"
      `;

      const includes = IncludeDiscovery.extractIncludes(content);

      expect(includes).toHaveLength(3);
    });

    it("handles includes with whitespace variations", () => {
      const content = `
        #include "normal.h"
        #  include "spaced.h"
        #include  "extra.h"
      `;

      const includes = IncludeDiscovery.extractIncludes(content);

      expect(includes).toContain("normal.h");
      expect(includes).toContain("spaced.h");
      expect(includes).toContain("extra.h");
    });

    it("returns empty array for content without includes", () => {
      const content = `
        void main() {
          int x = 5;
        }
      `;

      const includes = IncludeDiscovery.extractIncludes(content);

      expect(includes).toHaveLength(0);
    });

    it("handles nested paths", () => {
      const content = '#include "deep/nested/path/header.h"';

      const includes = IncludeDiscovery.extractIncludes(content);

      expect(includes).toContain("deep/nested/path/header.h");
    });

    it("handles .cnx includes", () => {
      const content = '#include "shared.cnx"';

      const includes = IncludeDiscovery.extractIncludes(content);

      expect(includes).toContain("shared.cnx");
    });
  });

  // ==========================================================================
  // extractIncludesWithInfo
  // ==========================================================================

  describe("extractIncludesWithInfo", () => {
    it("identifies local includes", () => {
      const content = '#include "local.h"';

      const includes = IncludeDiscovery.extractIncludesWithInfo(content);

      expect(includes).toHaveLength(1);
      expect(includes[0].path).toBe("local.h");
      expect(includes[0].isLocal).toBe(true);
    });

    it("identifies system includes", () => {
      const content = "#include <system.h>";

      const includes = IncludeDiscovery.extractIncludesWithInfo(content);

      expect(includes).toHaveLength(1);
      expect(includes[0].path).toBe("system.h");
      expect(includes[0].isLocal).toBe(false);
    });

    it("differentiates mixed includes", () => {
      const content = `
        #include "local.h"
        #include <system.h>
        #include "another.h"
      `;

      const includes = IncludeDiscovery.extractIncludesWithInfo(content);

      expect(includes).toHaveLength(3);
      expect(includes[0].isLocal).toBe(true);
      expect(includes[1].isLocal).toBe(false);
      expect(includes[2].isLocal).toBe(true);
    });
  });

  // ==========================================================================
  // resolveInclude
  // ==========================================================================

  describe("resolveInclude", () => {
    beforeEach(() => {
      mkdirSync(join(testDir, "include"), { recursive: true });
      writeFileSync(join(testDir, "include", "types.h"), "typedef int MyInt;");
      writeFileSync(join(testDir, "include", "utils.h"), "void helper();");
    });

    it("resolves include in search path", () => {
      const result = IncludeDiscovery.resolveInclude("types.h", [
        join(testDir, "include"),
      ]);

      expect(result).toBe(join(testDir, "include", "types.h"));
    });

    it("returns null when include not found", () => {
      const result = IncludeDiscovery.resolveInclude("nonexistent.h", [
        join(testDir, "include"),
      ]);

      expect(result).toBeNull();
    });

    it("searches paths in order", () => {
      const secondDir = join(testDir, "second");
      mkdirSync(secondDir, { recursive: true });
      writeFileSync(join(secondDir, "types.h"), "// second");

      const result = IncludeDiscovery.resolveInclude("types.h", [
        join(testDir, "include"),
        secondDir,
      ]);

      // Should find in first search path
      expect(result).toBe(join(testDir, "include", "types.h"));
    });

    it("resolves nested paths", () => {
      mkdirSync(join(testDir, "include", "nested"), { recursive: true });
      writeFileSync(join(testDir, "include", "nested", "deep.h"), "// deep");

      const result = IncludeDiscovery.resolveInclude("nested/deep.h", [
        join(testDir, "include"),
      ]);

      expect(result).toBe(join(testDir, "include", "nested", "deep.h"));
    });

    it("handles absolute paths directly", () => {
      const absolutePath = join(testDir, "include", "types.h");

      const result = IncludeDiscovery.resolveInclude(absolutePath, []);

      expect(result).toBe(absolutePath);
    });

    it("returns null for non-existent absolute path", () => {
      const absolutePath = join(testDir, "include", "nonexistent.h");

      const result = IncludeDiscovery.resolveInclude(absolutePath, []);

      expect(result).toBeNull();
    });

    it("skips directories (only returns files)", () => {
      mkdirSync(join(testDir, "include", "subdir"), { recursive: true });

      const result = IncludeDiscovery.resolveInclude("subdir", [
        join(testDir, "include"),
      ]);

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // discoverIncludePaths
  // ==========================================================================

  describe("discoverIncludePaths", () => {
    it("includes file's own directory", () => {
      writeFileSync(join(testDir, "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "main.cnx"),
      );

      expect(paths).toContain(resolve(testDir));
    });

    it("adds common project directories when project root found", () => {
      writeFileSync(join(testDir, "cnext.config.json"), "{}");
      mkdirSync(join(testDir, "include"), { recursive: true });
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      expect(paths).toContain(join(testDir, "include"));
      expect(paths).toContain(join(testDir, "src"));
    });

    it("removes duplicate paths", () => {
      writeFileSync(join(testDir, "cnext.config.json"), "{}");
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      const uniquePaths = new Set(paths);
      expect(paths.length).toBe(uniquePaths.size);
    });

    it("discovers PlatformIO library paths when platformio.ini exists", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      mkdirSync(join(testDir, ".pio", "libdeps", "esp32", "SomeLib"), {
        recursive: true,
      });
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      expect(
        paths.some((p) => p.includes(".pio") && p.includes("SomeLib")),
      ).toBe(true);
    });

    it("parses lib_extra_dirs from platformio.ini", () => {
      mkdirSync(join(testDir, "extra_libs"), { recursive: true });
      writeFileSync(
        join(testDir, "platformio.ini"),
        `
[env:esp32]
lib_extra_dirs = extra_libs
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      expect(paths.some((p) => p.includes("extra_libs"))).toBe(true);
    });

    it("handles comma-separated lib_extra_dirs", () => {
      mkdirSync(join(testDir, "lib1"), { recursive: true });
      mkdirSync(join(testDir, "lib2"), { recursive: true });
      // Use comma-separated format which is more reliably parsed
      writeFileSync(
        join(testDir, "platformio.ini"),
        `[env:esp32]
lib_extra_dirs = lib1, lib2
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      expect(paths.some((p) => p.includes("lib1"))).toBe(true);
      expect(paths.some((p) => p.includes("lib2"))).toBe(true);
    });

    it("handles lib_extra_dirs with comments", () => {
      mkdirSync(join(testDir, "extra"), { recursive: true });
      writeFileSync(
        join(testDir, "platformio.ini"),
        `
[env:esp32]
lib_extra_dirs = extra ; this is a comment
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      expect(paths.some((p) => p.includes("extra"))).toBe(true);
    });

    it("handles lib_extra_dirs with quoted paths", () => {
      mkdirSync(join(testDir, "quoted lib"), { recursive: true });
      writeFileSync(
        join(testDir, "platformio.ini"),
        `
[env:esp32]
lib_extra_dirs = "quoted lib"
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      expect(paths.some((p) => p.includes("quoted lib"))).toBe(true);
    });
  });

  // ==========================================================================
  // PlatformIO library discovery
  // ==========================================================================

  describe("PlatformIO library discovery", () => {
    it("discovers library root directories", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      mkdirSync(join(testDir, ".pio", "libdeps", "esp32", "Library1"), {
        recursive: true,
      });
      mkdirSync(join(testDir, ".pio", "libdeps", "esp32", "Library2"), {
        recursive: true,
      });
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      expect(paths.some((p) => p.includes("Library1"))).toBe(true);
      expect(paths.some((p) => p.includes("Library2"))).toBe(true);
    });

    it("discovers library src subdirectories", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      const libPath = join(testDir, ".pio", "libdeps", "esp32", "MyLib");
      mkdirSync(join(libPath, "src"), { recursive: true });
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      expect(paths.some((p) => p.endsWith("src") && p.includes("MyLib"))).toBe(
        true,
      );
    });

    it("discovers library include subdirectories", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      const libPath = join(testDir, ".pio", "libdeps", "esp32", "MyLib");
      mkdirSync(join(libPath, "include"), { recursive: true });
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      expect(
        paths.some((p) => p.endsWith("include") && p.includes("MyLib")),
      ).toBe(true);
    });

    it("handles multiple environments", () => {
      writeFileSync(
        join(testDir, "platformio.ini"),
        "[env:esp32]\n[env:teensy41]",
      );
      mkdirSync(join(testDir, ".pio", "libdeps", "esp32", "EspLib"), {
        recursive: true,
      });
      mkdirSync(join(testDir, ".pio", "libdeps", "teensy41", "TeensyLib"), {
        recursive: true,
      });
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      expect(paths.some((p) => p.includes("EspLib"))).toBe(true);
      expect(paths.some((p) => p.includes("TeensyLib"))).toBe(true);
    });
  });

  // ==========================================================================
  // Arduino library discovery
  // ==========================================================================

  describe("Arduino library discovery", () => {
    it("discovers Arduino libraries when HOME is set", () => {
      // This test is environment-dependent
      // We'll test with a mock filesystem
      const mockHome = testDir;
      const originalHome = process.env.HOME;

      try {
        process.env.HOME = mockHome;

        // Create Arduino library structure
        mkdirSync(join(mockHome, "Arduino", "libraries", "MyLib"), {
          recursive: true,
        });
        writeFileSync(join(testDir, "cnext.config.json"), "{}");
        mkdirSync(join(testDir, "src"), { recursive: true });
        writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

        const paths = IncludeDiscovery.discoverIncludePaths(
          join(testDir, "src", "main.cnx"),
        );

        expect(paths.some((p) => p.includes("MyLib"))).toBe(true);
      } finally {
        process.env.HOME = originalHome;
      }
    });

    it("discovers Arduino library src subdirectory", () => {
      const mockHome = testDir;
      const originalHome = process.env.HOME;

      try {
        process.env.HOME = mockHome;

        mkdirSync(join(mockHome, "Arduino", "libraries", "MyLib", "src"), {
          recursive: true,
        });
        writeFileSync(join(testDir, "cnext.config.json"), "{}");
        mkdirSync(join(testDir, "src"), { recursive: true });
        writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

        const paths = IncludeDiscovery.discoverIncludePaths(
          join(testDir, "src", "main.cnx"),
        );

        expect(
          paths.some((p) => p.endsWith("src") && p.includes("MyLib")),
        ).toBe(true);
      } finally {
        process.env.HOME = originalHome;
      }
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles missing .pio directory gracefully", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      // No .pio directory
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      // Should not throw
      expect(paths.length).toBeGreaterThan(0);
    });

    it("handles malformed platformio.ini gracefully", () => {
      writeFileSync(join(testDir, "platformio.ini"), "not valid ini content");
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      // Should not throw
      expect(paths.length).toBeGreaterThan(0);
    });

    it("handles non-existent lib_extra_dirs", () => {
      writeFileSync(
        join(testDir, "platformio.ini"),
        `
[env:esp32]
lib_extra_dirs = nonexistent_dir
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = IncludeDiscovery.discoverIncludePaths(
        join(testDir, "src", "main.cnx"),
      );

      // Should not include nonexistent dir
      expect(paths.some((p) => p.includes("nonexistent_dir"))).toBe(false);
    });

    it("handles empty HOME environment variable", () => {
      const originalHome = process.env.HOME;
      const originalUserProfile = process.env.USERPROFILE;

      try {
        delete process.env.HOME;
        delete process.env.USERPROFILE;

        writeFileSync(join(testDir, "cnext.config.json"), "{}");
        mkdirSync(join(testDir, "src"), { recursive: true });
        writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

        const paths = IncludeDiscovery.discoverIncludePaths(
          join(testDir, "src", "main.cnx"),
        );

        // Should not throw, just skip Arduino discovery
        expect(paths.length).toBeGreaterThan(0);
      } finally {
        process.env.HOME = originalHome;
        process.env.USERPROFILE = originalUserProfile;
      }
    });
  });
});
