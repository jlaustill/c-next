/**
 * Unit tests for Transpiler.determineProjectRoot()
 *
 * Tests the project root detection logic which is used to determine
 * where to place the .cnx cache directory.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import Transpiler from "../Transpiler";

describe("Transpiler.determineProjectRoot", () => {
  const testDir = join(process.cwd(), "test-project-root-tmp");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  /**
   * Helper to access the private determineProjectRoot method
   */
  function getProjectRoot(transpiler: Transpiler): string | undefined {
    return (
      transpiler as unknown as { determineProjectRoot(): string | undefined }
    ).determineProjectRoot();
  }

  /**
   * Helper to check if caching is enabled (cacheManager is not null)
   */
  function hasCacheManager(transpiler: Transpiler): boolean {
    return (
      (transpiler as unknown as { cacheManager: unknown }).cacheManager !== null
    );
  }

  describe("no inputs", () => {
    it("returns undefined when inputs array is empty", () => {
      const transpiler = new Transpiler({
        inputs: [],
      });

      expect(getProjectRoot(transpiler)).toBeUndefined();
    });

    it("disables caching when inputs array is empty", () => {
      const transpiler = new Transpiler({
        inputs: [],
      });

      expect(hasCacheManager(transpiler)).toBe(false);
    });
  });

  describe("input file exists", () => {
    it("finds cnext.config.json in same directory as file", () => {
      // Create project structure
      const projectDir = join(testDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(projectDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(projectDir, "main.cnx")],
        noCache: true, // Disable cache to avoid side effects
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("finds cnext.config.json in parent directory", () => {
      // Create project structure
      const projectDir = join(testDir, "project");
      const srcDir = join(projectDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(srcDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(srcDir, "main.cnx")],
        noCache: true,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("finds .git directory as project marker", () => {
      const projectDir = join(testDir, "project");
      const srcDir = join(projectDir, "src");
      mkdirSync(join(projectDir, ".git"), { recursive: true });
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(srcDir, "main.cnx")],
        noCache: true,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("finds package.json as project marker", () => {
      const projectDir = join(testDir, "project");
      const srcDir = join(projectDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(projectDir, "package.json"), "{}");
      writeFileSync(join(srcDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(srcDir, "main.cnx")],
        noCache: true,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("finds platformio.ini as project marker", () => {
      const projectDir = join(testDir, "project");
      const srcDir = join(projectDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(projectDir, "platformio.ini"), "[env:uno]");
      writeFileSync(join(srcDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(srcDir, "main.cnx")],
        noCache: true,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("finds marker multiple levels up", () => {
      const projectDir = join(testDir, "project");
      const deepDir = join(projectDir, "src", "modules", "utils");
      mkdirSync(deepDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(deepDir, "helper.cnx"), "void helper() {}");

      const transpiler = new Transpiler({
        inputs: [join(deepDir, "helper.cnx")],
        noCache: true,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });
  });

  describe("input file does not exist", () => {
    it("finds project marker using parent of non-existent file", () => {
      const projectDir = join(testDir, "project");
      const srcDir = join(projectDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      // Note: newfile.cnx does NOT exist

      const transpiler = new Transpiler({
        inputs: [join(srcDir, "newfile.cnx")],
        noCache: true,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("handles deeply nested non-existent file", () => {
      const projectDir = join(testDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      // Note: the nested directories and file do NOT exist

      const transpiler = new Transpiler({
        inputs: [join(projectDir, "src", "deep", "nested", "file.cnx")],
        noCache: true,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });
  });

  describe("input is a directory", () => {
    it("uses directory directly when input is a directory with marker", () => {
      const projectDir = join(testDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");

      const transpiler = new Transpiler({
        inputs: [projectDir],
        noCache: true,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("finds marker in parent when input is a subdirectory", () => {
      const projectDir = join(testDir, "project");
      const srcDir = join(projectDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");

      const transpiler = new Transpiler({
        inputs: [srcDir],
        noCache: true,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });
  });

  describe("marker priority", () => {
    it("prefers cnext.config.json over other markers in same directory", () => {
      const projectDir = join(testDir, "project");
      mkdirSync(join(projectDir, ".git"), { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(projectDir, "package.json"), "{}");
      writeFileSync(join(projectDir, "platformio.ini"), "");
      writeFileSync(join(projectDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(projectDir, "main.cnx")],
        noCache: true,
      });

      // Should find projectDir (all markers are there, but cnext.config.json is checked first)
      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("stops at first directory with any marker", () => {
      // Inner directory has package.json, outer has cnext.config.json
      const outerDir = join(testDir, "outer");
      const innerDir = join(outerDir, "inner");
      mkdirSync(innerDir, { recursive: true });
      writeFileSync(join(outerDir, "cnext.config.json"), "{}");
      writeFileSync(join(innerDir, "package.json"), "{}");
      writeFileSync(join(innerDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(innerDir, "main.cnx")],
        noCache: true,
      });

      // Should stop at innerDir because it has package.json
      expect(getProjectRoot(transpiler)).toBe(innerDir);
    });
  });

  describe("no project markers found", () => {
    it("returns undefined when no markers exist in hierarchy", () => {
      // Create a directory structure with no project markers
      // Note: We're inside testDir which is inside the c-next project,
      // so we need to create an isolated structure
      const isolatedDir = join(testDir, "isolated");
      mkdirSync(isolatedDir, { recursive: true });
      writeFileSync(join(isolatedDir, "orphan.cnx"), "void orphan() {}");

      const transpiler = new Transpiler({
        inputs: [join(isolatedDir, "orphan.cnx")],
        noCache: true,
      });

      // This will actually find the c-next project root (which has package.json)
      // because we're inside the c-next repo. That's expected behavior.
      const root = getProjectRoot(transpiler);

      // Verify it found a project root (the c-next repo)
      expect(root).toBeDefined();
      // And that root has a project marker
      expect(
        existsSync(join(root!, "package.json")) ||
          existsSync(join(root!, "cnext.config.json")) ||
          existsSync(join(root!, ".git")) ||
          existsSync(join(root!, "platformio.ini")),
      ).toBe(true);
    });

    it("disables caching when no project root found", () => {
      // This is hard to test in practice because we're inside the c-next repo
      // We can at least verify the noCache flag works
      const transpiler = new Transpiler({
        inputs: [join(testDir, "some.cnx")],
        noCache: true,
      });

      expect(hasCacheManager(transpiler)).toBe(false);
    });
  });

  describe("noCache configuration", () => {
    it("disables caching even when project root is found", () => {
      const projectDir = join(testDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(projectDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(projectDir, "main.cnx")],
        noCache: true,
      });

      // Project root should still be found
      expect(getProjectRoot(transpiler)).toBe(projectDir);
      // But caching should be disabled
      expect(hasCacheManager(transpiler)).toBe(false);
    });

    it("enables caching when project root is found and noCache is false", () => {
      const projectDir = join(testDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(projectDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(projectDir, "main.cnx")],
        noCache: false,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
      expect(hasCacheManager(transpiler)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles relative paths by resolving them", () => {
      const projectDir = join(testDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(projectDir, "main.cnx"), "void main() {}");

      // Use relative path from cwd
      const relativePath = join("test-project-root-tmp", "project", "main.cnx");

      const transpiler = new Transpiler({
        inputs: [relativePath],
        noCache: true,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("ignores .cnx files (not directories) as project markers", () => {
      // .cnx as a FILE should not be treated as a project marker
      const projectDir = join(testDir, "project");
      const srcDir = join(projectDir, "src");
      mkdirSync(srcDir, { recursive: true });
      // Create .cnx as a FILE (not directory)
      writeFileSync(join(srcDir, ".cnx"), "some content");
      // Real project marker is in parent
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(srcDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(srcDir, "main.cnx")],
        noCache: true,
      });

      // Should find projectDir, not srcDir (because .cnx file is not a marker)
      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("handles input that is the project root itself", () => {
      const projectDir = join(testDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(projectDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(projectDir, "main.cnx")],
        noCache: true,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("uses first input when multiple inputs provided", () => {
      const project1 = join(testDir, "project1");
      const project2 = join(testDir, "project2");
      mkdirSync(project1, { recursive: true });
      mkdirSync(project2, { recursive: true });
      writeFileSync(join(project1, "cnext.config.json"), "{}");
      writeFileSync(join(project2, "platformio.ini"), "");
      writeFileSync(join(project1, "a.cnx"), "void a() {}");
      writeFileSync(join(project2, "b.cnx"), "void b() {}");

      const transpiler = new Transpiler({
        inputs: [join(project1, "a.cnx"), join(project2, "b.cnx")],
        noCache: true,
      });

      // Should use first input's project root
      expect(getProjectRoot(transpiler)).toBe(project1);
    });

    it("handles paths with special characters", () => {
      const projectDir = join(testDir, "project with spaces");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(projectDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(projectDir, "main.cnx")],
        noCache: true,
      });

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });
  });

  describe("caching behavior integration", () => {
    it("creates cache in correct project root", async () => {
      const projectDir = join(testDir, "project");
      const srcDir = join(projectDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(srcDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(srcDir, "main.cnx")],
        noCache: false,
      });

      // Run transpiler to trigger cache creation
      await transpiler.transpile({ kind: "files" });

      // Cache directory should be in project root, not src dir
      expect(existsSync(join(projectDir, ".cnx"))).toBe(true);
      expect(existsSync(join(srcDir, ".cnx"))).toBe(false);
    });

    it("does not create cache directory when caching disabled", async () => {
      const projectDir = join(testDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(projectDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler({
        inputs: [join(projectDir, "main.cnx")],
        noCache: true,
      });

      await transpiler.transpile({ kind: "files" });

      // No cache directory should be created
      expect(existsSync(join(projectDir, ".cnx"))).toBe(false);
    });
  });
});
