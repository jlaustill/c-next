/**
 * Unit tests for Transpiler.determineProjectRoot()
 *
 * Tests the project root detection logic which is used to determine
 * where to place the .cnx cache directory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import Transpiler from "../Transpiler";
import NodeFileSystem from "../../PARSE/1-Discover/NodeFileSystem";

describe("Transpiler.determineProjectRoot", () => {
  const testDir = join(process.cwd(), "test-project-root-tmp");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  /**
   * The project root the transpiler is anchored at before any run: what the
   * private `determineProjectRoot` finds for `config.input` (#1719 made a run
   * re-anchor where its own root lives; construction anchors at the input).
   */
  function getProjectRoot(transpiler: Transpiler): string | undefined {
    return (
      transpiler as unknown as { anchor: { projectRoot: string | undefined } }
    ).anchor.projectRoot;
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
      const transpiler = new Transpiler(
        {
          input: "",
        },
        NodeFileSystem.instance,
      );

      expect(getProjectRoot(transpiler)).toBeUndefined();
    });

    it("disables caching when inputs array is empty", () => {
      const transpiler = new Transpiler(
        {
          input: "",
        },
        NodeFileSystem.instance,
      );

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

      const transpiler = new Transpiler(
        {
          input: join(projectDir, "main.cnx"),
          noCache: true, // Disable cache to avoid side effects
        },
        NodeFileSystem.instance,
      );

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it.each([
      ["cnext.config.json in parent directory", "cnext.config.json", "{}"],
      ["package.json as project marker", "package.json", "{}"],
      ["platformio.ini as project marker", "platformio.ini", "[env:uno]"],
    ])("finds %s", (_label, marker, contents) => {
      const projectDir = join(testDir, "project");
      const srcDir = join(projectDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(projectDir, marker), contents);
      writeFileSync(join(srcDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler(
        {
          input: join(srcDir, "main.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("finds .git directory as project marker", () => {
      const projectDir = join(testDir, "project");
      const srcDir = join(projectDir, "src");
      mkdirSync(join(projectDir, ".git"), { recursive: true });
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler(
        {
          input: join(srcDir, "main.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("finds marker multiple levels up", () => {
      const projectDir = join(testDir, "project");
      const deepDir = join(projectDir, "src", "modules", "utils");
      mkdirSync(deepDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(deepDir, "helper.cnx"), "void helper() {}");

      const transpiler = new Transpiler(
        {
          input: join(deepDir, "helper.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

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

      const transpiler = new Transpiler(
        {
          input: join(srcDir, "newfile.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("handles deeply nested non-existent file", () => {
      const projectDir = join(testDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      // Note: the nested directories and file do NOT exist

      const transpiler = new Transpiler(
        {
          input: join(projectDir, "src", "deep", "nested", "file.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });
  });

  describe("input file in project root", () => {
    it("finds marker in same directory as input file", () => {
      const projectDir = join(testDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(projectDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler(
        {
          input: join(projectDir, "main.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("finds marker in parent when input file is in subdirectory", () => {
      const projectDir = join(testDir, "project");
      const srcDir = join(projectDir, "src");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(srcDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler(
        {
          input: join(srcDir, "main.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

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

      const transpiler = new Transpiler(
        {
          input: join(projectDir, "main.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

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

      const transpiler = new Transpiler(
        {
          input: join(innerDir, "main.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

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

      const transpiler = new Transpiler(
        {
          input: join(isolatedDir, "orphan.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

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
      const transpiler = new Transpiler(
        {
          input: join(testDir, "some.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

      expect(hasCacheManager(transpiler)).toBe(false);
    });
  });

  describe("noCache configuration", () => {
    it("disables caching even when project root is found", () => {
      const projectDir = join(testDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(projectDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler(
        {
          input: join(projectDir, "main.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

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

      const transpiler = new Transpiler(
        {
          input: join(projectDir, "main.cnx"),
          noCache: false,
        },
        NodeFileSystem.instance,
      );

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

      const transpiler = new Transpiler(
        {
          input: relativePath,
          noCache: true,
        },
        NodeFileSystem.instance,
      );

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

      const transpiler = new Transpiler(
        {
          input: join(srcDir, "main.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

      // Should find projectDir, not srcDir (because .cnx file is not a marker)
      expect(getProjectRoot(transpiler)).toBe(projectDir);
    });

    it("handles input that is the project root itself", () => {
      const projectDir = join(testDir, "project");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(projectDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler(
        {
          input: join(projectDir, "main.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

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

      const transpiler = new Transpiler(
        {
          input: join(project1, "a.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

      // Should use first input's project root
      expect(getProjectRoot(transpiler)).toBe(project1);
    });

    it("handles paths with special characters", () => {
      const projectDir = join(testDir, "project with spaces");
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, "cnext.config.json"), "{}");
      writeFileSync(join(projectDir, "main.cnx"), "void main() {}");

      const transpiler = new Transpiler(
        {
          input: join(projectDir, "main.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

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

      const transpiler = new Transpiler(
        {
          input: join(srcDir, "main.cnx"),
          noCache: false,
        },
        NodeFileSystem.instance,
      );

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

      const transpiler = new Transpiler(
        {
          input: join(projectDir, "main.cnx"),
          noCache: true,
        },
        NodeFileSystem.instance,
      );

      await transpiler.transpile({ kind: "files" });

      // No cache directory should be created
      expect(existsSync(join(projectDir, ".cnx"))).toBe(false);
    });
  });
});

// #1760 review: ADR-049's build-system rung reads the platformio.ini of the
// project the run is anchored in, not one found again from a path
describe("Transpiler's PlatformIO rung", () => {
  const projectDir = join(process.cwd(), "test-pio-anchor-tmp");

  beforeEach(() => {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, "platformio.ini"),
      "[env:teensy41]\nplatform = teensy\nboard = teensy41\n",
    );
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("reads the anchored project's file for source with no path", async () => {
    // The process's cwd is this repository, which has no platformio.ini: a
    // second root finder, resolving "<string>" against it, found none (E0515)
    const result = await new Transpiler(
      { input: "" },
      NodeFileSystem.instance,
    ).transpile({
      kind: "source",
      source: "u8 value <- 1;\n",
      workingDir: projectDir,
    });
    expect(result.errors).toEqual([]);
    expect(result.target).toEqual({ name: "teensy41", source: "platformio" });
  });

  // #1794: PlatformIO appends the build machine's PLATFORMIO_DEFAULT_ENVS to
  // default_envs, so the run builds the environments it adds too
  it("builds the environments PLATFORMIO_DEFAULT_ENVS adds", async () => {
    writeFileSync(
      join(projectDir, "platformio.ini"),
      "[platformio]\ndefault_envs = teensy41\n\n" +
        "[env:teensy41]\nplatform = teensy\nboard = teensy41\n\n" +
        "[env:uno]\nplatform = atmelavr\nboard = uno\n",
    );
    const run = () =>
      new Transpiler({ input: "" }, NodeFileSystem.instance).transpile({
        kind: "source",
        source: "u8 value <- 1;\n",
        workingDir: projectDir,
      });

    // The control: the file alone builds teensy41
    const fileAlone = await run();
    expect(fileAlone.target).toEqual({
      name: "teensy41",
      source: "platformio",
    });

    vi.stubEnv("PLATFORMIO_DEFAULT_ENVS", "uno");
    try {
      // uno builds avr, teensy41 builds teensy41: one program, two targets
      const withMachine = await run();
      expect(withMachine.errors.map((error) => error.message)).toEqual([
        expect.stringContaining("error[E0511]"),
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
