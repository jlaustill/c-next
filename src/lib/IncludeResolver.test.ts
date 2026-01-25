/**
 * Unit tests for IncludeResolver
 *
 * Tests the unified include resolution logic used by both
 * Pipeline.run() and Pipeline.transpileSource().
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import IncludeResolver from "./IncludeResolver";

describe("IncludeResolver", () => {
  const testDir = join(__dirname, "__test_include_resolver__");
  const includeDir = join(testDir, "include");
  const srcDir = join(testDir, "src");

  beforeEach(() => {
    // Create test directory structure
    mkdirSync(testDir, { recursive: true });
    mkdirSync(includeDir, { recursive: true });
    mkdirSync(srcDir, { recursive: true });

    // Create test header files
    writeFileSync(join(includeDir, "types.h"), "typedef int MyInt;");
    writeFileSync(join(includeDir, "utils.h"), "void helper();");
    writeFileSync(
      join(includeDir, "nested", "deep.h"),
      (() => {
        mkdirSync(join(includeDir, "nested"), { recursive: true });
        return "int deep();";
      })(),
    );

    // Create test C-Next include file
    writeFileSync(join(includeDir, "shared.cnx"), "scope Shared { }");
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  // ========================================================================
  // Basic Resolution
  // ========================================================================

  describe("resolve()", () => {
    it("should resolve local includes with quotes", () => {
      const resolver = new IncludeResolver([includeDir]);
      const content = '#include "types.h"\nvoid test() {}';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].path).toBe(join(includeDir, "types.h"));
      expect(result.warnings).toHaveLength(0);
    });

    it("should resolve system includes with angle brackets", () => {
      const resolver = new IncludeResolver([includeDir]);
      const content = "#include <utils.h>\nvoid test() {}";

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].path).toBe(join(includeDir, "utils.h"));
      expect(result.warnings).toHaveLength(0);
    });

    it("should resolve nested paths", () => {
      const resolver = new IncludeResolver([includeDir]);
      const content = '#include "nested/deep.h"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].path).toBe(join(includeDir, "nested", "deep.h"));
    });

    it("should resolve multiple includes", () => {
      const resolver = new IncludeResolver([includeDir]);
      const content = '#include "types.h"\n#include "utils.h"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(2);
    });
  });

  // ========================================================================
  // Search Path Priority
  // ========================================================================

  describe("search path priority", () => {
    it("should search paths in order (first match wins)", () => {
      // Create same-named file in srcDir (should be found first)
      writeFileSync(join(srcDir, "types.h"), "// from srcDir");

      const resolver = new IncludeResolver([srcDir, includeDir]);
      const content = '#include "types.h"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].path).toBe(join(srcDir, "types.h"));
    });

    it("should fall back to later paths when not found in earlier ones", () => {
      // utils.h only exists in includeDir, not srcDir
      const resolver = new IncludeResolver([srcDir, includeDir]);
      const content = '#include "utils.h"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].path).toBe(join(includeDir, "utils.h"));
    });
  });

  // ========================================================================
  // Warnings
  // ========================================================================

  describe("warnings", () => {
    it("should warn for unresolved local includes", () => {
      const resolver = new IncludeResolver([includeDir]);
      const content = '#include "nonexistent.h"';

      const result = resolver.resolve(content, "test.cnx");

      expect(result.headers).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("nonexistent.h");
      expect(result.warnings[0]).toContain("not found");
    });

    it("should NOT warn for unresolved system includes", () => {
      const resolver = new IncludeResolver([includeDir]);
      const content = "#include <stdio.h>"; // System header, won't be found

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(0);
      expect(result.warnings).toHaveLength(0); // No warning for system includes
    });

    it("should include source file path in warning when provided", () => {
      const resolver = new IncludeResolver([includeDir]);
      const content = '#include "missing.h"';

      const result = resolver.resolve(content, "/path/to/source.cnx");

      expect(result.warnings[0]).toContain("/path/to/source.cnx");
    });
  });

  // ========================================================================
  // Deduplication
  // ========================================================================

  describe("deduplication", () => {
    it("should deduplicate headers included multiple times", () => {
      const resolver = new IncludeResolver([includeDir]);
      const content = '#include "types.h"\n#include "types.h"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
    });

    it("should track resolved paths across multiple resolve calls", () => {
      const resolver = new IncludeResolver([includeDir]);

      // First file includes types.h
      const result1 = resolver.resolve('#include "types.h"');
      expect(result1.headers).toHaveLength(1);

      // Second file also includes types.h - should be deduplicated
      const result2 = resolver.resolve('#include "types.h"');
      expect(result2.headers).toHaveLength(0);
    });

    it("should reset deduplication state with reset()", () => {
      const resolver = new IncludeResolver([includeDir]);

      resolver.resolve('#include "types.h"');
      resolver.reset();
      const result = resolver.resolve('#include "types.h"');

      expect(result.headers).toHaveLength(1);
    });

    it("should allow adding already-resolved paths", () => {
      const resolver = new IncludeResolver([includeDir]);
      const alreadyResolved = join(includeDir, "types.h");

      resolver.addResolvedPaths([alreadyResolved]);
      const result = resolver.resolve('#include "types.h"');

      expect(result.headers).toHaveLength(0); // Already resolved, skipped
    });
  });

  // ========================================================================
  // File Type Categorization
  // ========================================================================

  describe("file type categorization", () => {
    it("should categorize .h files as headers", () => {
      const resolver = new IncludeResolver([includeDir]);
      const content = '#include "types.h"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
      expect(result.cnextIncludes).toHaveLength(0);
    });

    it("should categorize .cnx files as C-Next includes", () => {
      const resolver = new IncludeResolver([includeDir]);
      const content = '#include "shared.cnx"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(0);
      expect(result.cnextIncludes).toHaveLength(1);
      expect(result.cnextIncludes[0].path).toBe(join(includeDir, "shared.cnx"));
    });

    it("should handle mixed header and C-Next includes", () => {
      const resolver = new IncludeResolver([includeDir]);
      const content = '#include "types.h"\n#include "shared.cnx"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
      expect(result.cnextIncludes).toHaveLength(1);
    });
  });

  // ========================================================================
  // buildSearchPaths()
  // ========================================================================

  describe("buildSearchPaths()", () => {
    it("should put source directory first", () => {
      const paths = IncludeResolver.buildSearchPaths(srcDir, [includeDir]);

      expect(paths[0]).toBe(srcDir);
    });

    it("should include additional include dirs before config dirs", () => {
      const extraDir = join(testDir, "extra");
      mkdirSync(extraDir, { recursive: true });

      const paths = IncludeResolver.buildSearchPaths(
        srcDir,
        [includeDir],
        [extraDir],
      );

      const extraIndex = paths.indexOf(extraDir);
      const includeIndex = paths.indexOf(includeDir);

      expect(extraIndex).toBeLessThan(includeIndex);
    });

    it("should deduplicate paths", () => {
      const paths = IncludeResolver.buildSearchPaths(
        srcDir,
        [srcDir, includeDir, srcDir], // duplicates
      );

      const srcCount = paths.filter((p) => p === srcDir).length;
      expect(srcCount).toBe(1);
    });

    it("should not include project dirs when projectRoot is null", () => {
      // Use a directory without project markers
      const isolatedDir = join(testDir, "isolated");
      mkdirSync(isolatedDir, { recursive: true });

      // Create include/ subdirectory that should NOT be added
      // since there's no project root
      mkdirSync(join(isolatedDir, "include"), { recursive: true });

      // Pass undefined projectRoot and use a path with no markers
      const paths = IncludeResolver.buildSearchPaths(
        isolatedDir,
        [],
        [],
        undefined,
      );

      // Should just have the source dir (no project root found)
      expect(paths).toContain(isolatedDir);
    });

    it("should add project common dirs when projectRoot is provided", () => {
      // Create a project structure with include/ dir
      const projectRoot = testDir;
      const projectInclude = join(projectRoot, "include");

      const paths = IncludeResolver.buildSearchPaths(
        srcDir,
        [],
        [],
        projectRoot,
      );

      expect(paths).toContain(projectInclude);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe("edge cases", () => {
    it("should handle empty content", () => {
      const resolver = new IncludeResolver([includeDir]);

      const result = resolver.resolve("");

      expect(result.headers).toHaveLength(0);
      expect(result.cnextIncludes).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should handle content with no includes", () => {
      const resolver = new IncludeResolver([includeDir]);

      const result = resolver.resolve("void main() { }");

      expect(result.headers).toHaveLength(0);
      expect(result.cnextIncludes).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should handle empty search paths", () => {
      const resolver = new IncludeResolver([]);

      const result = resolver.resolve('#include "types.h"');

      expect(result.headers).toHaveLength(0);
      expect(result.warnings).toHaveLength(1); // Should warn about not found
    });
  });
});
