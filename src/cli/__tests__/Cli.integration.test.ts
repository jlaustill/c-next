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
    // Create a real home directory structure to verify tilde expansion
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

    // Verify tilde was expanded to actual home directory path
    expect(result.config?.includeDirs).toContain(join(homeDir, "sdk/include"));
    // Verify the unexpanded tilde path is NOT present
    expect(result.config?.includeDirs).not.toContain("~/sdk/include");

    rmSync(homeDir, { recursive: true, force: true });
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
    // Create a real home directory structure to verify tilde expansion
    const homeDir = mkdtempSync(join(tmpdir(), "home-"));
    mkdirSync(join(homeDir, "my-libs"), { recursive: true });

    process.env.HOME = homeDir;

    writeFileSync(join(tempDir, "test.cnx"), "void main() {}");

    process.argv = [
      "node",
      "cnext",
      join(tempDir, "test.cnx"),
      "--include",
      "~/my-libs",
    ];

    const result = Cli.run();

    // Verify tilde was expanded to actual home directory path
    expect(result.config?.includeDirs).toContain(join(homeDir, "my-libs"));
    // Verify the unexpanded tilde path is NOT present
    expect(result.config?.includeDirs).not.toContain("~/my-libs");

    rmSync(homeDir, { recursive: true, force: true });
  });
});
