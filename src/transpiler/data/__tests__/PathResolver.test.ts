/**
 * Unit tests for PathResolver
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
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

      const result = resolver.getOutputPath(file, false);

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

      const result = resolver.getOutputPath(file, true);

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

      const result = resolver.getOutputPath(file, false);

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

      const result = resolver.getOutputPath(file, false);

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

      const result = resolver.getHeaderOutputPath(file);

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

      const result = resolver.getHeaderOutputPath(file);

      expect(result).toBe(join(headerDir, "main.h"));
    });

    it("strips basePath from header output", () => {
      // File at src/subdir/utils.cnx with basePath "src"
      // Should output to include/subdir/utils.h (not include/src/subdir/utils.h)
      const filePath = join(srcDir, "subdir", "utils.cnx");
      writeFileSync(filePath, "");

      // Create resolver with srcDir parent as input
      const resolver = new PathResolver({
        inputs: [testDir],
        outDir,
        headerOutDir: headerDir,
        basePath: "src",
      });

      const file = createFile(filePath);
      const result = resolver.getHeaderOutputPath(file);

      expect(result).toBe(join(headerDir, "subdir", "utils.h"));
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

      const result = resolver.getHeaderOutputPath(file);

      expect(result).toBe(join(headerDir, "subdir", "utils.h"));
    });
  });
});
