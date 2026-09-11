/**
 * Unit tests for PathResolver
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import PathResolver from "../PathResolver";
import IDiscoveredFile from "../types/IDiscoveredFile";
import EFileType from "../types/EFileType";

describe("PathResolver", () => {
  const testDir = join(process.cwd(), "test-path-resolver-tmp");
  const srcDir = join(testDir, "src");
  const outDir = join(testDir, "build");
  const headerDir = join(testDir, "include");

  beforeEach(() => {
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(join(srcDir, "subdir"), { recursive: true });
    mkdirSync(outDir, { recursive: true });
    mkdirSync(headerDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  /**
   * Create a mock discovered file
   */
  function createFile(path: string): IDiscoveredFile {
    return {
      path: resolve(path),
      type: EFileType.CNext,
      extension: ".cnx",
    };
  }

  describe("getRelativePathFromInputs", () => {
    it("returns relative path for file under input directory", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
      });

      const filePath = join(srcDir, "main.cnx");
      writeFileSync(filePath, "");

      expect(resolver.getRelativePathFromInputs(filePath)).toBe("main.cnx");
    });

    it("returns relative path preserving subdirectory structure", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
      });

      const filePath = join(srcDir, "subdir", "utils.cnx");
      writeFileSync(filePath, "");

      expect(resolver.getRelativePathFromInputs(filePath)).toBe(
        join("subdir", "utils.cnx"),
      );
    });

    it("returns null for file not under any input directory", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
      });

      const filePath = "/some/other/path/file.cnx";

      expect(resolver.getRelativePathFromInputs(filePath)).toBeNull();
    });

    it("skips file inputs (only directories establish structure)", () => {
      const singleFile = join(srcDir, "single.cnx");
      writeFileSync(singleFile, "");

      const resolver = new PathResolver({
        inputs: [singleFile], // File, not directory
        outDir,
      });

      // File inputs don't establish relative structure
      expect(resolver.getRelativePathFromInputs(singleFile)).toBeNull();
    });
  });

  describe("getSourceRelativePath", () => {
    it("returns relative path when file is under input", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
      });

      const filePath = join(srcDir, "subdir", "utils.cnx");
      writeFileSync(filePath, "");

      expect(resolver.getSourceRelativePath(filePath)).toBe(
        join("subdir", "utils.cnx"),
      );
    });

    it("returns basename when file is not under any input", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
      });

      const filePath = "/some/other/path/file.cnx";

      expect(resolver.getSourceRelativePath(filePath)).toBe("file.cnx");
    });
  });

  describe("getOutputPath", () => {
    it("generates .c output path in outDir", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
      });

      const filePath = join(srcDir, "main.cnx");
      writeFileSync(filePath, "");
      const file = createFile(filePath);

      const result = resolver.getOutputPath(file, ".c");

      expect(result).toBe(join(outDir, "main.c"));
    });

    it("generates .cpp output path when cppMode is true", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
      });

      const filePath = join(srcDir, "main.cnx");
      writeFileSync(filePath, "");
      const file = createFile(filePath);

      const result = resolver.getOutputPath(file, ".cpp");

      expect(result).toBe(join(outDir, "main.cpp"));
    });

    it("preserves directory structure in output", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
      });

      const filePath = join(srcDir, "subdir", "utils.cnx");
      writeFileSync(filePath, "");
      const file = createFile(filePath);

      const result = resolver.getOutputPath(file, ".c");

      expect(result).toBe(join(outDir, "subdir", "utils.c"));
    });

    it("outputs next to source when file not under input", () => {
      const otherDir = join(testDir, "other");
      mkdirSync(otherDir, { recursive: true });

      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
      });

      const filePath = join(otherDir, "external.cnx");
      writeFileSync(filePath, "");
      const file = createFile(filePath);

      const result = resolver.getOutputPath(file, ".c");

      expect(result).toBe(join(otherDir, "external.c"));
    });
  });

  describe("getHeaderOutputPath", () => {
    it("generates .h path in outDir when no headerOutDir", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
      });

      const filePath = join(srcDir, "main.cnx");
      writeFileSync(filePath, "");
      const file = createFile(filePath);

      const result = resolver.getHeaderOutputPath(file, ".h");

      expect(result).toBe(join(outDir, "main.h"));
    });

    it("generates .h path in headerOutDir when specified", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
        headerOutDir: headerDir,
      });

      const filePath = join(srcDir, "main.cnx");
      writeFileSync(filePath, "");
      const file = createFile(filePath);

      const result = resolver.getHeaderOutputPath(file, ".h");

      expect(result).toBe(join(headerDir, "main.h"));
    });

    it("preserves directory structure in header output", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
        headerOutDir: headerDir,
      });

      const filePath = join(srcDir, "subdir", "utils.cnx");
      writeFileSync(filePath, "");
      const file = createFile(filePath);

      const result = resolver.getHeaderOutputPath(file, ".h");

      expect(result).toBe(join(headerDir, "subdir", "utils.h"));
    });

    it("outputs header next to source when no headerOutDir and file not under input", () => {
      const otherDir = join(testDir, "other");
      mkdirSync(otherDir, { recursive: true });

      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
        // No headerOutDir specified
      });

      const filePath = join(otherDir, "external.cnx");
      writeFileSync(filePath, "");
      const file = createFile(filePath);

      const result = resolver.getHeaderOutputPath(file, ".h");

      expect(result).toBe(join(otherDir, "external.h"));
    });

    /**
     * Issue #1548 review: this assertion used to be `toContain("standalone.h")`,
     * which holds under the CWD-relative branch AND the basename branch alike --
     * so it could not detect which one ran, and its comment claimed basename
     * while the code took the CWD-relative path. Asserting the whole path makes
     * it a test of the decision rather than of the filename.
     *
     * With no projectRoot the CWD is the base, which is the layout issue #1467
     * pins: no project root means no config file, so headerOutDir can only have
     * come from `--header-out`, and a flag is relative to the shell.
     */
    it("keeps structure relative to the CWD when no projectRoot is given", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
        headerOutDir: headerDir,
      });

      // Create file in testDir (not under srcDir input, but under the CWD)
      const filePath = join(testDir, "standalone.cnx");
      writeFileSync(filePath, "");
      const file = createFile(filePath);

      const result = resolver.getHeaderOutputPath(file, ".h");

      expect(result).toBe(
        join(headerDir, relative(process.cwd(), testDir), "standalone.h"),
      );
    });

    /**
     * Issue #1547 / #1548 review: anchoring headerOut itself fixed the header
     * ROOT, but the path built inside that root was still derived from
     * `process.cwd()` for any file not under the entry's directory -- i.e. any
     * `#include` reaching sideways or upward. The destination, and the
     * `#include` emitted into the generated .c, therefore still slid with the
     * shell. These pin the subpath to the project root instead.
     */
    describe("projectRoot anchoring (issue #1547)", () => {
      it("derives the header subpath from projectRoot, not the cwd", () => {
        const libDir = join(testDir, "lib");
        mkdirSync(libDir, { recursive: true });
        const filePath = join(libDir, "util.cnx");
        writeFileSync(filePath, "");

        const resolver = new PathResolver({
          inputs: [srcDir],
          outDir,
          headerOutDir: headerDir,
          projectRoot: testDir,
        });

        const result = resolver.getHeaderOutputPath(createFile(filePath), ".h");

        expect(result).toBe(join(headerDir, "lib", "util.h"));
      });

      it("derives the same header path regardless of the cwd the run starts in", () => {
        const libDir = join(testDir, "lib");
        mkdirSync(libDir, { recursive: true });
        const filePath = join(libDir, "util.cnx");
        writeFileSync(filePath, "");

        const build = () =>
          new PathResolver({
            inputs: [srcDir],
            outDir,
            headerOutDir: headerDir,
            projectRoot: testDir,
          }).getHeaderOutputPath(createFile(filePath), ".h");

        const originalCwd = process.cwd();
        try {
          process.chdir(testDir);
          const fromRoot = build();
          process.chdir(srcDir);
          const fromSrcDir = build();
          process.chdir(libDir);
          const fromLibDir = build();

          expect(fromSrcDir).toBe(fromRoot);
          expect(fromLibDir).toBe(fromRoot);
          expect(fromRoot).toBe(join(headerDir, "lib", "util.h"));
        } finally {
          process.chdir(originalCwd);
        }
      });

      it("emits a CWD-independent include path for a file outside the entry directory", () => {
        const libDir = join(testDir, "lib");
        mkdirSync(libDir, { recursive: true });
        const filePath = join(libDir, "util.cnx");
        writeFileSync(filePath, "");

        const build = () =>
          new PathResolver({
            inputs: [srcDir],
            outDir,
            headerOutDir: headerDir,
            projectRoot: testDir,
          }).getHeaderIncludePath(filePath, ".h");

        const originalCwd = process.cwd();
        try {
          process.chdir(testDir);
          const fromRoot = build();
          process.chdir(srcDir);
          const fromSrcDir = build();

          expect(fromRoot).toBe("lib/util.h");
          expect(fromSrcDir).toBe(fromRoot);
        } finally {
          process.chdir(originalCwd);
        }
      });

      it("falls back to the basename for a file outside the project root", () => {
        const outsideDir = join(testDir, "..", "path-resolver-outside-tmp");
        mkdirSync(outsideDir, { recursive: true });
        const filePath = join(outsideDir, "stray.cnx");
        writeFileSync(filePath, "");

        const resolver = new PathResolver({
          inputs: [srcDir],
          outDir,
          headerOutDir: headerDir,
          projectRoot: testDir,
        });

        const result = resolver.getHeaderOutputPath(createFile(filePath), ".h");

        expect(result).toBe(join(headerDir, "stray.h"));

        rmSync(outsideDir, { recursive: true, force: true });
      });
    });

    // Issue #933: Test C++ mode header extension
    it("generates .hpp path in C++ mode", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
      });

      const filePath = join(srcDir, "main.cnx");
      writeFileSync(filePath, "");
      const file = createFile(filePath);

      const result = resolver.getHeaderOutputPath(file, ".hpp");

      expect(result).toBe(join(outDir, "main.hpp"));
    });

    it("generates .hpp path in headerOutDir in C++ mode", () => {
      const resolver = new PathResolver({
        inputs: [srcDir],
        outDir,
        headerOutDir: headerDir,
      });

      const filePath = join(srcDir, "main.cnx");
      writeFileSync(filePath, "");
      const file = createFile(filePath);

      const result = resolver.getHeaderOutputPath(file, ".hpp");

      expect(result).toBe(join(headerDir, "main.hpp"));
    });
  });
});
