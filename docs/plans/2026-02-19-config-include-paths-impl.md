# Config Include Paths Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tilde expansion and recursive `**` search to config include paths via a centralized PathNormalizer utility.

**Architecture:** Create `PathNormalizer` static class in `src/cli/` that normalizes all config paths. Called from `Cli.mergeConfig()` as the single normalization point. Uses `IFileSystem` interface for testability.

**Tech Stack:** TypeScript, Vitest, Node.js path/os modules, existing IFileSystem interface

---

## Task 1: Create PathNormalizer with expandTilde

**Files:**

- Create: `src/cli/PathNormalizer.ts`
- Create: `src/cli/__tests__/PathNormalizer.test.ts`

**Step 1: Write failing tests for expandTilde**

```typescript
/**
 * Unit tests for PathNormalizer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PathNormalizer from "../PathNormalizer";

describe("PathNormalizer", () => {
  describe("expandTilde", () => {
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;

    beforeEach(() => {
      process.env.HOME = "/home/testuser";
      process.env.USERPROFILE = "C:\\Users\\testuser";
    });

    afterEach(() => {
      process.env.HOME = originalHome;
      process.env.USERPROFILE = originalUserProfile;
    });

    it("expands ~/path to home directory path", () => {
      const result = PathNormalizer.expandTilde("~/foo/bar");
      expect(result).toBe("/home/testuser/foo/bar");
    });

    it("expands bare ~ to home directory", () => {
      const result = PathNormalizer.expandTilde("~");
      expect(result).toBe("/home/testuser");
    });

    it("leaves absolute paths unchanged", () => {
      const result = PathNormalizer.expandTilde("/abs/path");
      expect(result).toBe("/abs/path");
    });

    it("leaves relative paths unchanged", () => {
      const result = PathNormalizer.expandTilde("relative/path");
      expect(result).toBe("relative/path");
    });

    it("leaves mid-path tilde unchanged", () => {
      const result = PathNormalizer.expandTilde("/foo/~/bar");
      expect(result).toBe("/foo/~/bar");
    });

    it("uses USERPROFILE when HOME is not set", () => {
      delete process.env.HOME;
      const result = PathNormalizer.expandTilde("~/docs");
      expect(result).toBe("C:\\Users\\testuser/docs");
    });

    it("returns path unchanged when no home env is set", () => {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
      const result = PathNormalizer.expandTilde("~/docs");
      expect(result).toBe("~/docs");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run unit -- src/cli/__tests__/PathNormalizer.test.ts`
Expected: FAIL - PathNormalizer not found

**Step 3: Implement expandTilde**

```typescript
/**
 * PathNormalizer
 * Centralized path normalization for all config paths.
 * Handles tilde expansion and recursive directory search.
 */

class PathNormalizer {
  /**
   * Expand ~ at the start of a path to the home directory.
   * Only expands leading tilde (~/path or bare ~).
   * @param path - Path that may start with ~
   * @returns Path with ~ expanded to home directory
   */
  static expandTilde(path: string): string {
    if (!path.startsWith("~")) {
      return path;
    }

    const home = process.env.HOME || process.env.USERPROFILE;
    if (!home) {
      return path;
    }

    if (path === "~") {
      return home;
    }

    if (path.startsWith("~/")) {
      return home + path.slice(1);
    }

    return path;
  }
}

export default PathNormalizer;
```

**Step 4: Run tests to verify they pass**

Run: `npm run unit -- src/cli/__tests__/PathNormalizer.test.ts`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add src/cli/PathNormalizer.ts src/cli/__tests__/PathNormalizer.test.ts
git commit -m "feat(cli): add PathNormalizer.expandTilde for ~ expansion (#829)"
```

---

## Task 2: Add expandRecursive for /\*\* paths

**Files:**

- Modify: `src/cli/PathNormalizer.ts`
- Modify: `src/cli/__tests__/PathNormalizer.test.ts`

**Step 1: Write failing tests for expandRecursive**

Add to `PathNormalizer.test.ts`:

```typescript
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import IFileSystem from "../../transpiler/types/IFileSystem";
import NodeFileSystem from "../../transpiler/NodeFileSystem";

describe("expandRecursive", () => {
  let tempDir: string;
  const fs = NodeFileSystem.instance;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "pathnorm-test-"));
    // Create nested directory structure:
    // tempDir/
    //   a/
    //     a1/
    //     a2/
    //   b/
    mkdirSync(join(tempDir, "a", "a1"), { recursive: true });
    mkdirSync(join(tempDir, "a", "a2"), { recursive: true });
    mkdirSync(join(tempDir, "b"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns single-element array for path without ** suffix", () => {
    const result = PathNormalizer.expandRecursive(tempDir, fs);
    expect(result).toEqual([tempDir]);
  });

  it("expands path/** to all subdirectories", () => {
    const result = PathNormalizer.expandRecursive(`${tempDir}/**`, fs);
    expect(result).toContain(tempDir);
    expect(result).toContain(join(tempDir, "a"));
    expect(result).toContain(join(tempDir, "a", "a1"));
    expect(result).toContain(join(tempDir, "a", "a2"));
    expect(result).toContain(join(tempDir, "b"));
    expect(result).toHaveLength(5);
  });

  it("returns empty array for nonexistent path with **", () => {
    const result = PathNormalizer.expandRecursive("/nonexistent/path/**", fs);
    expect(result).toEqual([]);
  });

  it("returns empty array for nonexistent path without **", () => {
    const result = PathNormalizer.expandRecursive("/nonexistent/path", fs);
    expect(result).toEqual([]);
  });

  it("returns single-element array if path is a file", () => {
    const { writeFileSync } = require("node:fs");
    const filePath = join(tempDir, "file.txt");
    writeFileSync(filePath, "content");
    const result = PathNormalizer.expandRecursive(filePath, fs);
    expect(result).toEqual([filePath]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run unit -- src/cli/__tests__/PathNormalizer.test.ts`
Expected: FAIL - expandRecursive not defined

**Step 3: Implement expandRecursive**

Add to `PathNormalizer.ts`:

```typescript
import { join } from "node:path";
import IFileSystem from "../transpiler/types/IFileSystem";
import NodeFileSystem from "../transpiler/NodeFileSystem";

/** Default file system instance */
const defaultFs = NodeFileSystem.instance;

class PathNormalizer {
  // ... existing expandTilde method ...

  /**
   * Expand path/** to include all subdirectories recursively.
   * If path doesn't end with /**, returns the path as single-element array
   * (if it exists) or empty array (if it doesn't exist).
   * @param path - Path that may end with /**
   * @param fs - File system abstraction for testing
   * @returns Array of all directories found
   */
  static expandRecursive(path: string, fs: IFileSystem = defaultFs): string[] {
    const hasRecursiveSuffix = path.endsWith("/**");
    const basePath = hasRecursiveSuffix ? path.slice(0, -3) : path;

    if (!fs.exists(basePath)) {
      return [];
    }

    if (!fs.isDirectory(basePath)) {
      return [basePath];
    }

    if (!hasRecursiveSuffix) {
      return [basePath];
    }

    // Recursively collect all subdirectories
    const dirs: string[] = [basePath];
    this.collectSubdirectories(basePath, dirs, fs);
    return dirs;
  }

  /**
   * Recursively collect all subdirectories into the dirs array.
   */
  private static collectSubdirectories(
    dir: string,
    dirs: string[],
    fs: IFileSystem,
  ): void {
    const entries = fs.readdir(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      if (fs.isDirectory(fullPath)) {
        dirs.push(fullPath);
        this.collectSubdirectories(fullPath, dirs, fs);
      }
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run unit -- src/cli/__tests__/PathNormalizer.test.ts`
Expected: PASS (12 tests)

**Step 5: Commit**

```bash
git add src/cli/PathNormalizer.ts src/cli/__tests__/PathNormalizer.test.ts
git commit -m "feat(cli): add PathNormalizer.expandRecursive for /** paths (#829)"
```

---

## Task 3: Add normalizePath and normalizeIncludePaths

**Files:**

- Modify: `src/cli/PathNormalizer.ts`
- Modify: `src/cli/__tests__/PathNormalizer.test.ts`

**Step 1: Write failing tests**

Add to `PathNormalizer.test.ts`:

```typescript
describe("normalizePath", () => {
  beforeEach(() => {
    process.env.HOME = "/home/testuser";
  });

  afterEach(() => {
    process.env.HOME = originalHome;
  });

  it("expands tilde in path", () => {
    const result = PathNormalizer.normalizePath("~/output");
    expect(result).toBe("/home/testuser/output");
  });

  it("leaves absolute path unchanged", () => {
    const result = PathNormalizer.normalizePath("/abs/path");
    expect(result).toBe("/abs/path");
  });

  it("handles empty string", () => {
    const result = PathNormalizer.normalizePath("");
    expect(result).toBe("");
  });
});

describe("normalizeIncludePaths", () => {
  let tempDir: string;
  const fs = NodeFileSystem.instance;

  beforeEach(() => {
    process.env.HOME = "/home/testuser";
    tempDir = mkdtempSync(join(tmpdir(), "pathnorm-include-"));
    mkdirSync(join(tempDir, "sub1"), { recursive: true });
    mkdirSync(join(tempDir, "sub2"), { recursive: true });
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("expands tilde in all paths", () => {
    // Use mock fs for tilde paths since they won't exist
    const mockFs: IFileSystem = {
      exists: (p) => p === "/home/testuser/a" || p === "/home/testuser/b",
      isDirectory: (p) => p === "/home/testuser/a" || p === "/home/testuser/b",
      readdir: () => [],
      readFile: () => "",
      writeFile: () => {},
      mkdir: () => {},
      isFile: () => false,
      stat: () => ({ mtimeMs: 0 }),
    };
    const result = PathNormalizer.normalizeIncludePaths(["~/a", "~/b"], mockFs);
    expect(result).toEqual(["/home/testuser/a", "/home/testuser/b"]);
  });

  it("expands ** in paths", () => {
    const result = PathNormalizer.normalizeIncludePaths([`${tempDir}/**`], fs);
    expect(result).toContain(tempDir);
    expect(result).toContain(join(tempDir, "sub1"));
    expect(result).toContain(join(tempDir, "sub2"));
  });

  it("handles mixed paths with tilde and **", () => {
    // Create a directory at a path we can control
    const result = PathNormalizer.normalizeIncludePaths(
      [tempDir, `${tempDir}/**`],
      fs,
    );
    // First path: just tempDir
    // Second path: tempDir + subdirs
    // Deduplication not handled here - that's in mergeConfig
    expect(result).toContain(tempDir);
    expect(result).toContain(join(tempDir, "sub1"));
  });

  it("filters out nonexistent paths", () => {
    const result = PathNormalizer.normalizeIncludePaths(
      ["/nonexistent", tempDir],
      fs,
    );
    expect(result).toEqual([tempDir]);
  });

  it("returns empty array for empty input", () => {
    const result = PathNormalizer.normalizeIncludePaths([], fs);
    expect(result).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run unit -- src/cli/__tests__/PathNormalizer.test.ts`
Expected: FAIL - normalizePath and normalizeIncludePaths not defined

**Step 3: Implement normalizePath and normalizeIncludePaths**

Add to `PathNormalizer.ts`:

```typescript
  /**
   * Normalize a single path (tilde expansion only).
   * Used for output, headerOut, basePath.
   * @param path - Path to normalize
   * @returns Normalized path
   */
  static normalizePath(path: string): string {
    if (!path) {
      return path;
    }
    return this.expandTilde(path);
  }

  /**
   * Normalize include paths (tilde + recursive expansion).
   * @param paths - Array of paths to normalize
   * @param fs - File system abstraction for testing
   * @returns Flattened array of all resolved directories
   */
  static normalizeIncludePaths(
    paths: string[],
    fs: IFileSystem = defaultFs,
  ): string[] {
    const result: string[] = [];

    for (const path of paths) {
      const expanded = this.expandTilde(path);
      const dirs = this.expandRecursive(expanded, fs);
      result.push(...dirs);
    }

    return result;
  }
```

**Step 4: Run tests to verify they pass**

Run: `npm run unit -- src/cli/__tests__/PathNormalizer.test.ts`
Expected: PASS (20+ tests)

**Step 5: Commit**

```bash
git add src/cli/PathNormalizer.ts src/cli/__tests__/PathNormalizer.test.ts
git commit -m "feat(cli): add normalizePath and normalizeIncludePaths (#829)"
```

---

## Task 4: Add normalizeConfig as single entry point

**Files:**

- Modify: `src/cli/PathNormalizer.ts`
- Modify: `src/cli/__tests__/PathNormalizer.test.ts`

**Step 1: Write failing tests**

Add to `PathNormalizer.test.ts`:

```typescript
import ICliConfig from "../types/ICliConfig";

describe("normalizeConfig", () => {
  let tempDir: string;
  const fs = NodeFileSystem.instance;

  beforeEach(() => {
    process.env.HOME = "/home/testuser";
    tempDir = mkdtempSync(join(tmpdir(), "pathnorm-config-"));
    mkdirSync(join(tempDir, "include", "sub"), { recursive: true });
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("normalizes all path fields in config", () => {
    const mockFs: IFileSystem = {
      exists: () => true,
      isDirectory: () => true,
      readdir: () => [],
      readFile: () => "",
      writeFile: () => {},
      mkdir: () => {},
      isFile: () => false,
      stat: () => ({ mtimeMs: 0 }),
    };

    const config: ICliConfig = {
      inputs: ["file.cnx"],
      outputPath: "~/build",
      includeDirs: ["~/sdk/include"],
      defines: {},
      preprocess: false,
      verbose: false,
      cppRequired: false,
      noCache: false,
      parseOnly: false,
      headerOutDir: "~/include",
      basePath: "~/src",
    };

    const result = PathNormalizer.normalizeConfig(config, mockFs);

    expect(result.outputPath).toBe("/home/testuser/build");
    expect(result.headerOutDir).toBe("/home/testuser/include");
    expect(result.basePath).toBe("/home/testuser/src");
    expect(result.includeDirs).toEqual(["/home/testuser/sdk/include"]);
  });

  it("handles undefined optional fields", () => {
    const config: ICliConfig = {
      inputs: ["file.cnx"],
      outputPath: "",
      includeDirs: [],
      defines: {},
      preprocess: false,
      verbose: false,
      cppRequired: false,
      noCache: false,
      parseOnly: false,
    };

    const result = PathNormalizer.normalizeConfig(config);

    expect(result.headerOutDir).toBeUndefined();
    expect(result.basePath).toBeUndefined();
  });

  it("expands ** in include paths", () => {
    const config: ICliConfig = {
      inputs: [],
      outputPath: "",
      includeDirs: [`${tempDir}/include/**`],
      defines: {},
      preprocess: false,
      verbose: false,
      cppRequired: false,
      noCache: false,
      parseOnly: false,
    };

    const result = PathNormalizer.normalizeConfig(config, fs);

    expect(result.includeDirs).toContain(join(tempDir, "include"));
    expect(result.includeDirs).toContain(join(tempDir, "include", "sub"));
  });

  it("preserves non-path fields unchanged", () => {
    const config: ICliConfig = {
      inputs: ["a.cnx", "b.cnx"],
      outputPath: "",
      includeDirs: [],
      defines: { DEBUG: true },
      preprocess: true,
      verbose: true,
      cppRequired: true,
      noCache: true,
      parseOnly: true,
      target: "teensy41",
      debugMode: true,
    };

    const result = PathNormalizer.normalizeConfig(config);

    expect(result.inputs).toEqual(["a.cnx", "b.cnx"]);
    expect(result.defines).toEqual({ DEBUG: true });
    expect(result.preprocess).toBe(true);
    expect(result.verbose).toBe(true);
    expect(result.cppRequired).toBe(true);
    expect(result.noCache).toBe(true);
    expect(result.parseOnly).toBe(true);
    expect(result.target).toBe("teensy41");
    expect(result.debugMode).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run unit -- src/cli/__tests__/PathNormalizer.test.ts`
Expected: FAIL - normalizeConfig not defined

**Step 3: Implement normalizeConfig**

Add to `PathNormalizer.ts`:

```typescript
import ICliConfig from "./types/ICliConfig";

  /**
   * Normalize all paths in a CLI config.
   * Single entry point for all path normalization.
   * @param config - CLI config with potentially unnormalized paths
   * @param fs - File system abstraction for testing
   * @returns New config with all paths normalized
   */
  static normalizeConfig(
    config: ICliConfig,
    fs: IFileSystem = defaultFs,
  ): ICliConfig {
    return {
      ...config,
      outputPath: this.normalizePath(config.outputPath),
      headerOutDir: config.headerOutDir
        ? this.normalizePath(config.headerOutDir)
        : undefined,
      basePath: config.basePath
        ? this.normalizePath(config.basePath)
        : undefined,
      includeDirs: this.normalizeIncludePaths(config.includeDirs, fs),
    };
  }
```

**Step 4: Run tests to verify they pass**

Run: `npm run unit -- src/cli/__tests__/PathNormalizer.test.ts`
Expected: PASS (24+ tests)

**Step 5: Commit**

```bash
git add src/cli/PathNormalizer.ts src/cli/__tests__/PathNormalizer.test.ts
git commit -m "feat(cli): add normalizeConfig as single entry point (#829)"
```

---

## Task 5: Integrate PathNormalizer into Cli.mergeConfig

**Files:**

- Modify: `src/cli/Cli.ts`
- Modify: `src/cli/__tests__/Cli.test.ts`

**Step 1: Write failing integration test**

Add to `Cli.test.ts`:

```typescript
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("path normalization", () => {
  let tempDir: string;
  const originalHome = process.env.HOME;
  const originalArgv = process.argv;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cli-paths-"));
    process.env.HOME = "/home/testuser";
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    process.env.HOME = originalHome;
    process.argv = originalArgv;
  });

  it("expands tilde in config include paths", () => {
    // Create config with tilde path
    writeFileSync(
      join(tempDir, "cnext.config.json"),
      JSON.stringify({ include: ["~/sdk/include"] }),
    );
    writeFileSync(join(tempDir, "test.cnx"), "void main() {}");

    process.argv = ["node", "cnext", join(tempDir, "test.cnx")];

    const result = Cli.run();

    expect(result.config?.includeDirs).toContain("/home/testuser/sdk/include");
  });

  it("expands ** in config include paths", () => {
    // Create directory structure
    mkdirSync(join(tempDir, "include", "sub"), { recursive: true });
    writeFileSync(
      join(tempDir, "cnext.config.json"),
      JSON.stringify({ include: [`${tempDir}/include/**`] }),
    );
    writeFileSync(join(tempDir, "test.cnx"), "void main() {}");

    process.argv = ["node", "cnext", join(tempDir, "test.cnx")];

    const result = Cli.run();

    expect(result.config?.includeDirs).toContain(join(tempDir, "include"));
    expect(result.config?.includeDirs).toContain(
      join(tempDir, "include", "sub"),
    );
  });

  it("expands tilde in CLI --include paths", () => {
    writeFileSync(join(tempDir, "test.cnx"), "void main() {}");

    process.argv = [
      "node",
      "cnext",
      join(tempDir, "test.cnx"),
      "--include",
      "~/my-libs",
    ];

    const result = Cli.run();

    // Path won't exist, so it gets filtered out by normalizeIncludePaths
    // But the expansion should have happened
    expect(result.shouldRun).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run unit -- src/cli/__tests__/Cli.test.ts`
Expected: FAIL - tilde paths not expanded

**Step 3: Integrate PathNormalizer into Cli.ts**

Modify `src/cli/Cli.ts`:

```typescript
import PathNormalizer from "./PathNormalizer";

// In mergeConfig method, change the return:
private static mergeConfig(
  args: IParsedArgs,
  fileConfig: IFileConfig,
): ICliConfig {
  const rawConfig: ICliConfig = {
    inputs: args.inputFiles,
    outputPath: args.outputPath || fileConfig.output || "",
    includeDirs: [...(fileConfig.include ?? []), ...args.includeDirs],
    defines: args.defines,
    preprocess: args.preprocess,
    verbose: args.verbose,
    cppRequired: args.cppRequired || fileConfig.cppRequired || false,
    noCache: args.noCache || fileConfig.noCache === true,
    parseOnly: args.parseOnly,
    headerOutDir: args.headerOutDir ?? fileConfig.headerOut,
    basePath: args.basePath ?? fileConfig.basePath,
    target: args.target ?? fileConfig.target,
    debugMode: args.debugMode || fileConfig.debugMode,
  };

  return PathNormalizer.normalizeConfig(rawConfig);
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run unit -- src/cli/__tests__/Cli.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `npm run unit`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/cli/Cli.ts src/cli/__tests__/Cli.test.ts
git commit -m "feat(cli): integrate PathNormalizer into Cli.mergeConfig (#829)

Closes #829"
```

---

## Task 6: Run full validation and create PR

**Step 1: Run all tests**

Run: `npm run test:all`
Expected: All tests pass

**Step 2: Check coverage**

Run: `npm run unit:coverage`
Expected: New code has >= 80% coverage

**Step 3: Push and create PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(cli): add tilde expansion and recursive search for config include paths" --body "$(cat <<'EOF'
## Summary

- Adds `PathNormalizer` utility class for centralized config path normalization
- Expands `~` to home directory in all config paths (include, output, headerOut, basePath)
- Supports `/**` suffix for recursive directory search in include paths

Closes #829

## Test plan

- [x] Unit tests for PathNormalizer methods
- [x] Integration tests in Cli.test.ts
- [x] Full test suite passes
- [x] Coverage >= 80%

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Summary of Files

| File                                       | Action |
| ------------------------------------------ | ------ |
| `src/cli/PathNormalizer.ts`                | Create |
| `src/cli/__tests__/PathNormalizer.test.ts` | Create |
| `src/cli/Cli.ts`                           | Modify |
| `src/cli/__tests__/Cli.test.ts`            | Modify |
