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

  /**
   * Issue #1547: the counterpart to config-path anchoring. A path typed at the
   * shell is relative to the shell, so `--header-out` must NOT be anchored to
   * the config file's directory the way `headerOut` in the config file is.
   *
   * Negative control: this passes before the #1547 fix as well as after. Its
   * job is to fail if anchoring is ever widened to cover CLI flags, which is
   * the obvious over-correction and the one the fix has to not make.
   */
  it("does not anchor a CLI --header-out path to the config file directory", () => {
    writeFileSync(
      join(tempDir, "cnext.config.json"),
      JSON.stringify({ headerOut: "include" }),
    );
    writeFileSync(join(tempDir, "test.cnx"), "void main() {}");

    process.argv = [
      "node",
      "cnext",
      join(tempDir, "test.cnx"),
      "--header-out",
      "cli-headers",
    ];

    const result = Cli.run();

    // The flag wins, and it stays exactly as typed -- relative to the CWD.
    expect(result.config?.headerOutDir).toBe("cli-headers");
    expect(result.config?.headerOutDir).not.toBe(join(tempDir, "cli-headers"));
  });

  it("anchors a config-file headerOut to the config file directory", () => {
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(tempDir, "cnext.config.json"),
      JSON.stringify({ headerOut: "include" }),
    );
    writeFileSync(join(srcDir, "test.cnx"), "void main() {}");

    process.argv = ["node", "cnext", join(srcDir, "test.cnx")];

    const result = Cli.run();

    expect(result.config?.headerOutDir).toBe(join(tempDir, "include"));
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
