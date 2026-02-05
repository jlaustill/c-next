import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";

// Mock vscode module before importing IncludeResolver
vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: () => [],
    }),
  },
}));

import IncludeResolver from "../workspace/IncludeResolver";

describe("IncludeResolver path boundary validation", () => {
  let tmpDir: string;
  let srcDir: string;
  let includeDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cnext-test-"));
    srcDir = path.join(tmpDir, "src");
    includeDir = path.join(tmpDir, "include");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(includeDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("blocks path traversal that escapes workspace root", () => {
    // Create a file outside workspace to prove it exists but should be blocked
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "cnext-outside-"));
    const outsideFile = path.join(outsideDir, "secret.h");
    fs.writeFileSync(outsideFile, "// secret");

    // Create a file inside the workspace for the fromFile parameter
    const fromFile = path.join(srcDir, "main.cnx");
    fs.writeFileSync(fromFile, "");

    const resolver = new IncludeResolver({
      workspaceRoot: tmpDir,
      localIncludePaths: [".", "include", "src"],
      sdkIncludePaths: [],
      excludePatterns: [],
    });

    // Calculate relative traversal path from srcDir to outsideFile
    const relativePath = path.relative(srcDir, outsideFile);

    // The file exists but should be blocked by boundary check
    const result = resolver.resolve(relativePath, fromFile, false);
    expect(result).toBeUndefined();

    fs.rmSync(outsideDir, { recursive: true });
  });

  it("allows normal relative includes within workspace", () => {
    // Create a header inside the workspace
    const headerFile = path.join(includeDir, "myheader.h");
    fs.writeFileSync(headerFile, "// header");

    // Create a source file
    const fromFile = path.join(srcDir, "main.cnx");
    fs.writeFileSync(fromFile, "");

    const resolver = new IncludeResolver({
      workspaceRoot: tmpDir,
      localIncludePaths: [".", "include", "src"],
      sdkIncludePaths: [],
      excludePatterns: [],
    });

    // Relative path from src/ to include/myheader.h
    const result = resolver.resolve("../include/myheader.h", fromFile, false);
    expect(result).toBe(path.resolve(headerFile));
  });

  it("allows includes from configured local include paths", () => {
    // Create a header inside the include directory
    const headerFile = path.join(includeDir, "types.h");
    fs.writeFileSync(headerFile, "// types");

    const fromFile = path.join(srcDir, "main.cnx");
    fs.writeFileSync(fromFile, "");

    const resolver = new IncludeResolver({
      workspaceRoot: tmpDir,
      localIncludePaths: [".", "include", "src"],
      sdkIncludePaths: [],
      excludePatterns: [],
    });

    // Should find via the "include" search path
    const result = resolver.resolve("types.h", fromFile, false);
    expect(result).toBe(path.resolve(headerFile));
  });

  it("blocks traversal via local include paths", () => {
    // Even with local include paths, traversal beyond workspace should be blocked
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "cnext-outside-"));
    const outsideFile = path.join(outsideDir, "evil.h");
    fs.writeFileSync(outsideFile, "// evil");

    const fromFile = path.join(srcDir, "main.cnx");
    fs.writeFileSync(fromFile, "");

    const resolver = new IncludeResolver({
      workspaceRoot: tmpDir,
      localIncludePaths: [".", "include", "src"],
      sdkIncludePaths: [],
      excludePatterns: [],
    });

    // Try traversal from include path
    const traversal = path.relative(includeDir, outsideFile);
    const result = resolver.resolve(
      `../include/${traversal}`,
      fromFile,
      false,
    );
    expect(result).toBeUndefined();

    fs.rmSync(outsideDir, { recursive: true });
  });

  it("allows SDK include paths without boundary checking", () => {
    // SDK paths are user-configured and trusted, no boundary check
    const sdkDir = fs.mkdtempSync(path.join(os.tmpdir(), "cnext-sdk-"));
    const sdkHeader = path.join(sdkDir, "Arduino.h");
    fs.writeFileSync(sdkHeader, "// Arduino SDK");

    const fromFile = path.join(srcDir, "main.cnx");
    fs.writeFileSync(fromFile, "");

    const resolver = new IncludeResolver({
      workspaceRoot: tmpDir,
      localIncludePaths: [".", "include", "src"],
      sdkIncludePaths: [sdkDir],
      excludePatterns: [],
    });

    // SDK paths should work even though they're outside workspace
    const result = resolver.resolve("Arduino.h", fromFile, true);
    expect(result).toBe(path.resolve(sdkHeader));

    fs.rmSync(sdkDir, { recursive: true });
  });

  it("blocks classic etc/passwd traversal attack", () => {
    const fromFile = path.join(srcDir, "main.cnx");
    fs.writeFileSync(fromFile, "");

    const resolver = new IncludeResolver({
      workspaceRoot: tmpDir,
      localIncludePaths: [".", "include", "src"],
      sdkIncludePaths: [],
      excludePatterns: [],
    });

    // Classic path traversal attack
    const result = resolver.resolve(
      "../../../../etc/passwd",
      fromFile,
      false,
    );
    expect(result).toBeUndefined();
  });

  it("blocks paths with workspace root as prefix but different directory", () => {
    // e.g., workspace is /tmp/cnext-test-XXX, attacker creates /tmp/cnext-test-XXX-evil/
    const evilDir = tmpDir + "-evil";
    fs.mkdirSync(evilDir, { recursive: true });
    const evilFile = path.join(evilDir, "evil.h");
    fs.writeFileSync(evilFile, "// evil");

    const fromFile = path.join(srcDir, "main.cnx");
    fs.writeFileSync(fromFile, "");

    const resolver = new IncludeResolver({
      workspaceRoot: tmpDir,
      localIncludePaths: [],
      sdkIncludePaths: [],
      excludePatterns: [],
    });

    // Calculate relative traversal path from srcDir to evilFile
    const relativePath = path.relative(srcDir, evilFile);

    // This should be blocked — the evil dir shares the workspace root prefix
    const result = resolver.resolve(relativePath, fromFile, false);
    expect(result).toBeUndefined();

    fs.rmSync(evilDir, { recursive: true });
  });

  it("handles empty workspace root gracefully", () => {
    const headerFile = path.join(srcDir, "local.h");
    fs.writeFileSync(headerFile, "// local");

    const fromFile = path.join(srcDir, "main.cnx");
    fs.writeFileSync(fromFile, "");

    // Empty workspaceRoot means boundary checks rely on localIncludePaths
    const resolver = new IncludeResolver({
      workspaceRoot: "",
      localIncludePaths: [srcDir],
      sdkIncludePaths: [],
      excludePatterns: [],
    });

    // Should resolve because srcDir is an absolute local include path
    const result = resolver.resolve("local.h", fromFile, false);
    expect(result).toBe(path.resolve(headerFile));
  });
});

describe("path boundary validation concept", () => {
  it("detects path traversal beyond workspace root", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cnext-test-"));
    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });

    // Path traversal resolves outside workspace
    const resolved = path.resolve(srcDir, "../../../../etc/passwd");
    expect(resolved.startsWith(tmpDir)).toBe(false);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("normal relative includes stay within workspace", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cnext-test-"));
    const srcDir = path.join(tmpDir, "src");
    const includeDir = path.join(tmpDir, "include");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(includeDir, { recursive: true });

    const resolved = path.resolve(srcDir, "../include/header.h");
    expect(resolved.startsWith(tmpDir)).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });
});
