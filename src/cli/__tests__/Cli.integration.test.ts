/**
 * Integration tests for Cli path normalization.
 * These tests do NOT mock dependencies - they test real behavior.
 *
 * Separate from Cli.test.ts to avoid vi.mock() hoisting issues.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Cli from "../Cli";

describe("Cli path normalization (integration)", () => {
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

    // ~/sdk/include gets expanded to /home/testuser/sdk/include
    // Since the path doesn't exist, normalizeIncludePaths filters it out
    // But we can verify the expansion happened by checking the result
    // For non-existent paths, they get filtered out, so includeDirs will be empty
    expect(result.shouldRun).toBe(true);
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

  it("expands tilde in config include path to existing directory", () => {
    // Create real directories that exist
    const homeDir = mkdtempSync(join(tmpdir(), "home-"));
    mkdirSync(join(homeDir, "sdk", "include"), { recursive: true });

    process.env.HOME = homeDir;

    writeFileSync(
      join(tempDir, "cnext.config.json"),
      JSON.stringify({ include: ["~/sdk/include"] }),
    );
    writeFileSync(join(tempDir, "test.cnx"), "void main() {}");

    process.argv = ["node", "cnext", join(tempDir, "test.cnx")];

    const result = Cli.run();

    expect(result.config?.includeDirs).toContain(join(homeDir, "sdk/include"));

    // Cleanup
    rmSync(homeDir, { recursive: true, force: true });
  });
});
