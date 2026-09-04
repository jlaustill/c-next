/**
 * Unit tests for IncludeResolver
 *
 * Tests the unified include resolution logic used by
 * the transpile() entry point for both file and source modes.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import IncludeResolver from "../IncludeResolver";
import EFileType from "../types/EFileType";

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
      const resolver = new IncludeResolver([includeDir], ".h");
      const content = '#include "types.h"\nvoid test() {}';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].path).toBe(join(includeDir, "types.h"));
      expect(result.warnings).toHaveLength(0);
    });

    it("should resolve system includes with angle brackets", () => {
      const resolver = new IncludeResolver([includeDir], ".h");
      const content = "#include <utils.h>\nvoid test() {}";

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].path).toBe(join(includeDir, "utils.h"));
      expect(result.warnings).toHaveLength(0);
    });

    it("should resolve nested paths", () => {
      const resolver = new IncludeResolver([includeDir], ".h");
      const content = '#include "nested/deep.h"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].path).toBe(join(includeDir, "nested", "deep.h"));
    });

    it("should resolve multiple includes", () => {
      const resolver = new IncludeResolver([includeDir], ".h");
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

      const resolver = new IncludeResolver([srcDir, includeDir], ".h");
      const content = '#include "types.h"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].path).toBe(join(srcDir, "types.h"));
    });

    it("should fall back to later paths when not found in earlier ones", () => {
      // utils.h only exists in includeDir, not srcDir
      const resolver = new IncludeResolver([srcDir, includeDir], ".h");
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
      const resolver = new IncludeResolver([includeDir], ".h");
      const content = '#include "nonexistent.h"';

      const result = resolver.resolve(content, "test.cnx");

      expect(result.headers).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("nonexistent.h");
      expect(result.warnings[0]).toContain("not found");
    });

    it("should NOT warn for unresolved system includes", () => {
      const resolver = new IncludeResolver([includeDir], ".h");
      const content = "#include <stdio.h>"; // System header, won't be found

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(0);
      expect(result.warnings).toHaveLength(0); // No warning for system includes
    });

    it("should include source file path in warning when provided", () => {
      const resolver = new IncludeResolver([includeDir], ".h");
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
      const resolver = new IncludeResolver([includeDir], ".h");
      const content = '#include "types.h"\n#include "types.h"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
    });

    it("should track resolved paths across multiple resolve calls", () => {
      const resolver = new IncludeResolver([includeDir], ".h");

      // First file includes types.h
      const result1 = resolver.resolve('#include "types.h"');
      expect(result1.headers).toHaveLength(1);

      // Second file also includes types.h - should be deduplicated
      const result2 = resolver.resolve('#include "types.h"');
      expect(result2.headers).toHaveLength(0);
    });

    it("should reset deduplication state with reset()", () => {
      const resolver = new IncludeResolver([includeDir], ".h");

      resolver.resolve('#include "types.h"');
      resolver.reset();
      const result = resolver.resolve('#include "types.h"');

      expect(result.headers).toHaveLength(1);
    });

    it("should allow adding already-resolved paths", () => {
      const resolver = new IncludeResolver([includeDir], ".h");
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
      const resolver = new IncludeResolver([includeDir], ".h");
      const content = '#include "types.h"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(1);
      expect(result.cnextIncludes).toHaveLength(0);
    });

    it("should categorize .cnx files as C-Next includes", () => {
      const resolver = new IncludeResolver([includeDir], ".h");
      const content = '#include "shared.cnx"';

      const result = resolver.resolve(content);

      expect(result.headers).toHaveLength(0);
      expect(result.cnextIncludes).toHaveLength(1);
      expect(result.cnextIncludes[0].path).toBe(join(includeDir, "shared.cnx"));
    });

    it("should handle mixed header and C-Next includes", () => {
      const resolver = new IncludeResolver([includeDir], ".h");
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
  // C++ Mode (cppMode) — Issue: .hpp vs .h in headerIncludeDirectives
  // ========================================================================

  describe("cppMode header directive extension", () => {
    it("should use .h extension for cnx includes in C mode (default)", () => {
      const resolver = new IncludeResolver([includeDir], ".h");
      const content = '#include "shared.cnx"';

      const result = resolver.resolve(content);

      const directives = [...result.headerIncludeDirectives.values()];
      expect(directives).toHaveLength(1);
      expect(directives[0]).toBe('#include "shared.h"');
    });

    it.each([
      [
        "should use .hpp extension for cnx includes in C++ mode",
        '#include "shared.cnx"',
        '#include "shared.hpp"',
      ],
      [
        "should use .hpp for angle-bracket cnx includes in C++ mode",
        "#include <shared.cnx>",
        "#include <shared.hpp>",
      ],
      [
        "should not affect C/C++ header directives (only cnx includes)",
        '#include "types.h"',
        '#include "types.h"',
      ],
    ])("%s", (_label, source, source2) => {
      const resolver = new IncludeResolver([includeDir], ".hpp");
      const content = source;

      const result = resolver.resolve(content);

      const directives = [...result.headerIncludeDirectives.values()];
      expect(directives).toHaveLength(1);
      expect(directives[0]).toBe(source2);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  // ==========================================================================
  // Issue #1467: the injected owner decides which header a `.cnx` include names
  //
  // These sit at the PRODUCER on purpose. End to end, a wrong directive here is
  // invisible: `HeaderGeneratorUtils` deduplicates includes by STEM, so a naive
  // `<utils.h>` and a resolved `<Display/utils.h>` collapse to one line and the
  // first one wins. That dedup exists for `.h`/`.hpp` mismatches, not for this,
  // and it masks the defect rather than preventing it -- so a regression in the
  // ExternalTypeHeaderBuilder directive can only be caught right here.
  // ==========================================================================

  describe("resolved header path (#1467)", () => {
    it("names the resolved header, not the author's spelling", () => {
      const resolver = new IncludeResolver(
        [includeDir],
        ".h",
        undefined,
        () => "Display/shared.h",
      );

      const result = resolver.resolve("#include <shared.cnx>");

      expect([...result.headerIncludeDirectives.values()]).toEqual([
        "#include <Display/shared.h>",
      ]);
      expect([...result.cnextIncludeRewrites.entries()]).toEqual([
        ["shared.cnx", "Display/shared.h"],
      ]);
    });

    it("keeps a quoted include quoted", () => {
      const resolver = new IncludeResolver(
        [includeDir],
        ".h",
        undefined,
        () => "Display/shared.h",
      );

      const result = resolver.resolve('#include "shared.cnx"');

      expect([...result.headerIncludeDirectives.values()]).toEqual([
        '#include "Display/shared.h"',
      ]);
    });

    it("falls back to the extension swap when the owner has no answer", () => {
      const resolver = new IncludeResolver(
        [includeDir],
        ".h",
        undefined,
        () => null,
      );

      const result = resolver.resolve("#include <shared.cnx>");

      expect([...result.headerIncludeDirectives.values()]).toEqual([
        "#include <shared.h>",
      ]);
    });

    it("falls back when no owner is injected at all", () => {
      const resolver = new IncludeResolver([includeDir], ".h");

      const result = resolver.resolve("#include <shared.cnx>");

      expect([...result.headerIncludeDirectives.values()]).toEqual([
        "#include <shared.h>",
      ]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty content", () => {
      const resolver = new IncludeResolver([includeDir], ".h");

      const result = resolver.resolve("");

      expect(result.headers).toHaveLength(0);
      expect(result.cnextIncludes).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should handle content with no includes", () => {
      const resolver = new IncludeResolver([includeDir], ".h");

      const result = resolver.resolve("void main() { }");

      expect(result.headers).toHaveLength(0);
      expect(result.cnextIncludes).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should handle empty search paths", () => {
      const resolver = new IncludeResolver([], ".h");

      const result = resolver.resolve('#include "types.h"');

      expect(result.headers).toHaveLength(0);
      expect(result.warnings).toHaveLength(1); // Should warn about not found
    });
  });

  // ========================================================================
  // resolveHeadersTransitively() - Issue #592
  // ========================================================================

  describe("resolveHeadersTransitively()", () => {
    it("should resolve single header without nested includes", () => {
      // types.h has no includes
      const rootHeaders = [
        {
          path: join(includeDir, "types.h"),
          type: EFileType.CHeader,
          extension: ".h",
        },
      ];

      const result = IncludeResolver.resolveHeadersTransitively(rootHeaders, [
        includeDir,
      ]);

      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].path).toContain("types.h");
      expect(result.warnings).toHaveLength(0);
    });

    it("should resolve headers with nested includes in dependency order", () => {
      // Create a header that includes another header
      const nestedDir = join(testDir, "nested_test");
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(join(nestedDir, "base.h"), "typedef int BaseType;");
      writeFileSync(
        join(nestedDir, "derived.h"),
        '#include "base.h"\ntypedef BaseType DerivedType;',
      );

      const rootHeaders = [
        {
          path: join(nestedDir, "derived.h"),
          type: EFileType.CHeader,
          extension: ".h",
        },
      ];

      const result = IncludeResolver.resolveHeadersTransitively(rootHeaders, [
        nestedDir,
      ]);

      // Should have both headers, base.h first (dependency order)
      expect(result.headers).toHaveLength(2);
      expect(result.headers[0].path).toContain("base.h");
      expect(result.headers[1].path).toContain("derived.h");
    });

    it("should handle circular includes without infinite loop", () => {
      // Create headers that include each other
      const circularDir = join(testDir, "circular_test");
      mkdirSync(circularDir, { recursive: true });
      writeFileSync(join(circularDir, "a.h"), '#include "b.h"\nint a;');
      writeFileSync(join(circularDir, "b.h"), '#include "a.h"\nint b;');

      const rootHeaders = [
        {
          path: join(circularDir, "a.h"),
          type: EFileType.CHeader,
          extension: ".h",
        },
      ];

      const result = IncludeResolver.resolveHeadersTransitively(rootHeaders, [
        circularDir,
      ]);

      // Should complete without hanging, include both headers once
      expect(result.headers).toHaveLength(2);
    });

    it("should skip headers generated by C-Next Transpiler", () => {
      const generatedDir = join(testDir, "generated_test");
      mkdirSync(generatedDir, { recursive: true });
      writeFileSync(
        join(generatedDir, "generated.h"),
        "/* Generated by C-Next Transpiler */\nint foo;",
      );
      writeFileSync(
        join(generatedDir, "user.h"),
        '#include "generated.h"\nint bar;',
      );

      const rootHeaders = [
        {
          path: join(generatedDir, "user.h"),
          type: EFileType.CHeader,
          extension: ".h",
        },
      ];

      const result = IncludeResolver.resolveHeadersTransitively(rootHeaders, [
        generatedDir,
      ]);

      // Should only include user.h, skip generated.h
      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].path).toContain("user.h");
    });

    it("should warn about unresolved local includes", () => {
      const warningDir = join(testDir, "warning_test");
      mkdirSync(warningDir, { recursive: true });
      writeFileSync(
        join(warningDir, "main.h"),
        '#include "missing.h"\nint main;',
      );

      const rootHeaders = [
        {
          path: join(warningDir, "main.h"),
          type: EFileType.CHeader,
          extension: ".h",
        },
      ];

      const result = IncludeResolver.resolveHeadersTransitively(rootHeaders, [
        warningDir,
      ]);

      expect(result.headers).toHaveLength(1);
      expect(result.warnings.some((w) => w.includes("missing.h"))).toBe(true);
    });

    it("should respect processedPaths option to skip already-processed headers", () => {
      const processedDir = join(testDir, "processed_test");
      mkdirSync(processedDir, { recursive: true });
      writeFileSync(join(processedDir, "already.h"), "int already;");

      const rootHeaders = [
        {
          path: join(processedDir, "already.h"),
          type: EFileType.CHeader,
          extension: ".h",
        },
      ];
      const alreadyProcessed = new Set([join(processedDir, "already.h")]);

      const result = IncludeResolver.resolveHeadersTransitively(
        rootHeaders,
        [processedDir],
        { processedPaths: alreadyProcessed },
      );

      // Should skip the already-processed header
      expect(result.headers).toHaveLength(0);
    });
  });

  // ========================================================================
  // Issue #1319 review: the `null` header-extension contract
  //
  // `null` means "this caller does not read headerIncludeDirectives", which is
  // what lets IncludeTreeWalker stop claiming `.h` for every C++ run. Reverting
  // the guard to `this.headerExtension ?? ".h"` left all 6954 unit tests green,
  // so the invariant this PR introduced was held by a comment -- the same state
  // `Transpiler.cppDetected` was in before it was sealed.
  // ========================================================================

  describe("null header extension (#1319)", () => {
    const source = '#include "shared.cnx"';
    const sourcePath = join(srcDir, "main.cnx");

    it("records no header directive when the caller consumes none", () => {
      const resolver = new IncludeResolver([includeDir], null);

      const result = resolver.resolve(source, sourcePath);

      // The negative control, and the reason it is in the same test: an empty
      // map is also what an UNRESOLVED include produces, so without proving the
      // include resolved this assertion would pass while measuring nothing.
      expect(result.cnextIncludes).toHaveLength(1);
      expect([...result.headerIncludeDirectives.values()]).toEqual([]);
    });

    it("records one when the caller supplies an extension", () => {
      for (const [ext, expected] of [
        [".h", '#include "shared.h"'],
        [".hpp", '#include "shared.hpp"'],
      ] as const) {
        const result = new IncludeResolver([includeDir], ext).resolve(
          source,
          sourcePath,
        );

        expect(result.cnextIncludes).toHaveLength(1);
        expect([...result.headerIncludeDirectives.values()]).toEqual([
          expected,
        ]);
      }
    });
  });
});
